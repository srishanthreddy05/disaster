'use client';

import { FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  DrawingManager,
  GoogleMap,
  Marker,
  Polygon,
  useJsApiLoader,
} from '@react-google-maps/api';
import { getDatabase, onValue, push, ref, set, update } from 'firebase/database';
import app from '@/lib/firebase';
import type { VolunteerAlert } from '@/lib/types';

type ZoneType = 'red' | 'orange' | 'green';
type PointType = 'shelter' | 'safe_location' | 'medical' | 'resource';
type Severity = 'low' | 'medium' | 'high';

type LatLng = {
  lat: number;
  lng: number;
};

type ZoneRecord = {
  id: string;
  type: ZoneType;
  coordinates: LatLng[];
};

type PointRecord = {
  id: string;
  name: string;
  type: PointType;
  lat: number;
  lng: number;
};

const ADMIN_ID = '1234';
const ADMIN_PASSWORD = '1234';
const AUTH_STORAGE_KEY = 'admin-control-auth';

const authStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    authStore.listeners.add(listener);
    return () => authStore.listeners.delete(listener);
  },
  emit() {
    authStore.listeners.forEach((listener) => listener());
  },
  getSnapshot() {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  },
  getServerSnapshot() {
    return false;
  },
};

const libraries: NonNullable<Parameters<typeof useJsApiLoader>[0]['libraries']> = ['drawing', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '100vh',
};

const chennaiCenter = {
  lat: 13.0827,
  lng: 80.2707,
};

const zoneStroke: Record<ZoneType, string> = {
  red: '#ef4444',
  orange: '#f97316',
  green: '#22c55e',
};

const zoneFill: Record<ZoneType, string> = {
  red: '#ef4444',
  orange: '#f97316',
  green: '#22c55e',
};

export default function AdminControlPage() {
  const isAuthenticated = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getServerSnapshot
  );
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [mapPoints, setMapPoints] = useState<PointRecord[]>([]);
  const [selectedZoneType, setSelectedZoneType] = useState<ZoneType>('red');

  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<Severity>('medium');

  const [volunteerAlerts, setVolunteerAlerts] = useState<VolunteerAlert[]>([]);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const [pointModeEnabled, setPointModeEnabled] = useState(false);
  const [pointModalOpen, setPointModalOpen] = useState(false);
  const [pendingPointCoords, setPendingPointCoords] = useState<LatLng | null>(null);
  const [pointName, setPointName] = useState('');
  const [pointType, setPointType] = useState<PointType>('shelter');
  const [adminLocation, setAdminLocation] = useState<LatLng>(() => chennaiCenter);
  const [adminLocationWarning, setAdminLocationWarning] = useState<string | null>(() => {
    if (typeof navigator === 'undefined') {
      return null;
    }
    return navigator.geolocation ? null : 'Geolocation is not supported. Using city center.';
  });

  const db = useMemo(() => getDatabase(app), []);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey,
    libraries,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAdminLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setAdminLocationWarning(null);
      },
      () => {
        setAdminLocation(chennaiCenter);
        setAdminLocationWarning('Location permission denied. Using city center.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const zonesRef = ref(db, 'zones');
    const pointsRef = ref(db, 'mapPoints');

    const unsubscribeZones = onValue(zonesRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<ZoneRecord, 'id'>> | null;
      if (!value) {
        setZones([]);
        return;
      }

      const parsedZones: ZoneRecord[] = Object.entries(value).map(([id, zone]) => ({
        id,
        type: zone.type,
        coordinates: Array.isArray(zone.coordinates) ? zone.coordinates : [],
      }));
      setZones(parsedZones);
    });

    const unsubscribePoints = onValue(pointsRef, (snapshot) => {
      const value = snapshot.val() as Record<string, Omit<PointRecord, 'id'>> | null;
      if (!value) {
        setMapPoints([]);
        return;
      }

      const parsedPoints: PointRecord[] = Object.entries(value).map(([id, point]) => ({
        id,
        name: point.name,
        type: point.type,
        lat: point.lat,
        lng: point.lng,
      }));
      setMapPoints(parsedPoints);
    });

    return () => {
      unsubscribeZones();
      unsubscribePoints();
    };
  }, [db, isAuthenticated]);

  // Listen to volunteer alerts
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const alertsRef = ref(db, 'volunteer_alerts');

    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setVolunteerAlerts([]);
        return;
      }

      const alerts: VolunteerAlert[] = Object.entries(data).map(([id, alert]: [string, any]) => ({
        id,
        ...alert,
      }));

      // Sort by status (pending first) then by createdAt descending
      alerts.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'pending' ? -1 : 1;
        }
        return b.createdAt - a.createdAt;
      });

      setVolunteerAlerts(alerts);
    });

    return () => unsubscribe();
  }, [db, isAuthenticated]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loginId === ADMIN_ID && loginPassword === ADMIN_PASSWORD) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      authStore.emit();
      setLoginError('');
      return;
    }

    setLoginError('Invalid ID or Password');
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    authStore.emit();
  };

  const handlePolygonComplete = async (polygon: google.maps.Polygon) => {
    const path = polygon
      .getPath()
      .getArray()
      .map((point) => ({ lat: point.lat(), lng: point.lng() }));

    polygon.setMap(null);

    if (path.length < 3) {
      return;
    }

    const zoneRef = push(ref(db, 'zones'));
    await set(zoneRef, {
      type: selectedZoneType,
      coordinates: path,
      createdAt: Date.now(),
    });
  };

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!pointModeEnabled || !event.latLng) {
      return;
    }

    setPendingPointCoords({
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    });
    setPointModalOpen(true);
  };

  const closePointModal = () => {
    setPointModalOpen(false);
    setPendingPointCoords(null);
    setPointName('');
    setPointType('shelter');
  };

  const handlePointSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingPointCoords || !pointName.trim()) {
      return;
    }

    const pointRef = push(ref(db, 'mapPoints'));
    await set(pointRef, {
      name: pointName.trim(),
      type: pointType,
      lat: pendingPointCoords.lat,
      lng: pendingPointCoords.lng,
      createdAt: Date.now(),
    });

    closePointModal();
  };

  const handleCreateAlert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!alertTitle.trim() || !alertMessage.trim()) {
      return;
    }

    const alertRef = push(ref(db, 'alerts'));
    await set(alertRef, {
      title: alertTitle.trim(),
      message: alertMessage.trim(),
      severity: alertSeverity,
      createdAt: Date.now(),
    });

    setAlertTitle('');
    setAlertMessage('');
    setAlertSeverity('medium');
  };

  const handleAcknowledgeVolunteerAlert = async (alertId: string) => {
    setAcknowledging(alertId);
    try {
      const alertRef = ref(db, `volunteer_alerts/${alertId}`);
      await update(alertRef, {
        status: 'acknowledged',
        acknowledgedBy: ADMIN_ID,
        acknowledgedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    } finally {
      setAcknowledging(null);
    }
  };

  const pendingAlerts = volunteerAlerts.filter((a) => a.status === 'pending');
  const acknowledgedAlerts = volunteerAlerts.filter((a) => a.status === 'acknowledged');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6 overflow-x-hidden">
        <div className="w-full max-w-md border border-gray-800 bg-gray-900 rounded-xl p-4 sm:p-6 lg:p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold mb-2">Admin Control Login</h1>
          <p className="text-sm text-gray-400 mb-6">Restricted access for emergency command center</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">ID</label>
              <input
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 outline-none focus:border-gray-500"
                placeholder="Enter ID"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 outline-none focus:border-gray-500"
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && <p className="text-sm text-red-400">{loginError}</p>}

            <button
              type="submit"
              className="w-full bg-gray-100 text-gray-950 font-medium py-2 rounded-lg hover:bg-white transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto w-full min-h-screen lg:h-screen p-4 sm:p-6 lg:p-8">
        <aside className="w-full border border-gray-800 bg-gray-900/80 backdrop-blur-sm overflow-y-auto rounded-xl p-4 sm:p-6 lg:p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Command Center</h1>
              <p className="text-xs text-gray-400 mt-1">Admin Disaster Control Panel</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs px-3 py-2 rounded-md border border-gray-700 hover:bg-gray-800"
            >
              Logout
            </button>
          </div>

          <section className="border border-gray-800 rounded-xl p-4 bg-gray-950/70">
            <h2 className="text-lg font-medium mb-4">Create Alert</h2>
            <form onSubmit={handleCreateAlert} className="space-y-3">
              <input
                value={alertTitle}
                onChange={(event) => setAlertTitle(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm"
                placeholder="Alert Title"
                required
              />

              <textarea
                value={alertMessage}
                onChange={(event) => setAlertMessage(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm min-h-24"
                placeholder="Alert Message"
                required
              />

              <select
                value={alertSeverity}
                onChange={(event) => setAlertSeverity(event.target.value as Severity)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>

              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm font-medium"
              >
                Send Alert
              </button>
            </form>
          </section>

          <section className="border border-gray-800 rounded-xl p-4 bg-gray-950/70 space-y-3">
            <h2 className="text-lg font-medium">Zone Controls</h2>
            <p className="text-xs text-gray-400">Select a zone type and draw polygon directly on map.</p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedZoneType('red')}
                className={`py-2 rounded-lg text-xs font-medium border ${
                  selectedZoneType === 'red'
                    ? 'bg-red-500/20 border-red-400 text-red-300'
                    : 'border-gray-700 hover:bg-gray-800'
                }`}
              >
                Red Zone
              </button>
              <button
                type="button"
                onClick={() => setSelectedZoneType('orange')}
                className={`py-2 rounded-lg text-xs font-medium border ${
                  selectedZoneType === 'orange'
                    ? 'bg-orange-500/20 border-orange-400 text-orange-300'
                    : 'border-gray-700 hover:bg-gray-800'
                }`}
              >
                Orange Zone
              </button>
              <button
                type="button"
                onClick={() => setSelectedZoneType('green')}
                className={`py-2 rounded-lg text-xs font-medium border ${
                  selectedZoneType === 'green'
                    ? 'bg-green-500/20 border-green-400 text-green-300'
                    : 'border-gray-700 hover:bg-gray-800'
                }`}
              >
                Green Zone
              </button>
            </div>
          </section>

          <section className="border border-gray-800 rounded-xl p-4 bg-gray-950/70 space-y-3">
            <h2 className="text-lg font-medium">Add Points</h2>
            <p className="text-xs text-gray-400">Enable point mode, then click map to add a point.</p>

            <button
              type="button"
              onClick={() => setPointModeEnabled((previous) => !previous)}
              className={`w-full py-2 rounded-lg text-sm font-medium border ${
                pointModeEnabled
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'border-gray-700 hover:bg-gray-800'
              }`}
            >
              {pointModeEnabled ? 'Point Mode Enabled' : 'Enable Point Mode'}
            </button>
          </section>

          <section className="border border-gray-800 rounded-xl p-4 bg-gray-950/70">
            <h2 className="text-lg font-medium mb-3">Live Status</h2>
            <div className="text-sm text-gray-300 space-y-2">
              <p>Zones: {zones.length}</p>
              <p>Map Points: {mapPoints.length}</p>
            </div>
          </section>

          <section className="border border-gray-800 rounded-xl p-4 bg-gray-950/70 space-y-3">
            <h2 className="text-lg font-medium">Face Verification</h2>
            <p className="text-xs text-gray-400">
              Verify uploaded face images against stored missing-person embeddings.
            </p>
            <Link
              href="/dashboard/admin/verify"
              className="block w-full text-center py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium"
            >
              Open Verification Portal
            </Link>
          </section>

          <section className="border border-gray-800 rounded-xl p-4 bg-gray-950/70 space-y-3">
            <h2 className="text-lg font-medium">Operations Center</h2>
            <p className="text-xs text-gray-400">
              Master dashboard with real-time visibility across all nodes.
            </p>
            <Link
              href="/admin-control/operations-center"
              className="block w-full text-center py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium"
            >
              Open Operations Center
            </Link>
          </section>

          {/* Volunteer Alerts Section */}
          <section className="border border-gray-800 rounded-xl p-4 bg-gray-950/70">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Volunteer Alerts</h2>
              {pendingAlerts.length > 0 && (
                <span className="bg-yellow-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {pendingAlerts.length}
                </span>
              )}
            </div>

            {volunteerAlerts.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No alerts yet</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {/* Pending Alerts */}
                {pendingAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-yellow-400 mb-1">⏱️ PENDING</p>
                        <p className="text-sm font-semibold text-gray-100 mb-1 truncate">
                          {alert.volunteerName}
                        </p>
                        <p className="text-xs text-gray-300 line-clamp-2 mb-1">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcknowledgeVolunteerAlert(alert.id)}
                      disabled={acknowledging === alert.id}
                      className="w-full mt-2 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                    >
                      {acknowledging === alert.id ? 'Processing...' : '✓ Acknowledge'}
                    </button>
                  </div>
                ))}

                {/* Acknowledged Alerts */}
                {acknowledgedAlerts.length > 0 && pendingAlerts.length > 0 && (
                  <div className="border-t border-gray-800 pt-3 mt-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Acknowledged</p>
                  </div>
                )}
                {acknowledgedAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 bg-green-900/10 border border-green-800/30 rounded-lg opacity-60"
                  >
                    <p className="text-xs font-semibold text-green-400 mb-1">✓ ACKNOWLEDGED</p>
                    <p className="text-sm font-semibold text-gray-100 mb-1 truncate">
                      {alert.volunteerName}
                    </p>
                    <p className="text-xs text-gray-300 line-clamp-2 mb-1">{alert.message}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>

        <main className="w-full relative h-[350px] sm:h-[400px] lg:h-full rounded-xl overflow-hidden">
          {adminLocationWarning && (
            <div className="absolute top-4 left-4 z-10 bg-yellow-200 text-yellow-900 text-xs px-3 py-2 rounded-lg shadow">
              {adminLocationWarning}
            </div>
          )}
          {!googleMapsApiKey && (
            <div className="h-full flex items-center justify-center text-sm text-red-300 bg-gray-950">
              Google Maps API key not configured.
            </div>
          )}

          {googleMapsApiKey && loadError && (
            <div className="h-full flex items-center justify-center text-sm text-red-300 bg-gray-950">
              Failed to load Google Maps.
            </div>
          )}

          {googleMapsApiKey && !loadError && !isLoaded && (
            <div className="h-full flex items-center justify-center text-sm text-gray-300 bg-gray-950">
              Loading map...
            </div>
          )}

          {googleMapsApiKey && !loadError && isLoaded && (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={adminLocation || chennaiCenter}
              zoom={13}
              onClick={handleMapClick}
              options={{
                disableDefaultUI: false,
                fullscreenControl: true,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                styles: [],
              }}
            >
              {adminLocation && (
                <Marker
                  position={adminLocation}
                  label="Admin Location"
                  icon="https://maps.google.com/mapfiles/ms/icons/purple-dot.png"
                />
              )}
              <DrawingManager
                onPolygonComplete={handlePolygonComplete}
                options={{
                  drawingMode: window.google.maps.drawing.OverlayType.POLYGON,
                  drawingControl: true,
                  drawingControlOptions: {
                    position: window.google.maps.ControlPosition.TOP_CENTER,
                    drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
                  },
                  polygonOptions: {
                    fillColor: zoneFill[selectedZoneType],
                    fillOpacity: 0.25,
                    strokeColor: zoneStroke[selectedZoneType],
                    strokeWeight: 2,
                    clickable: false,
                    draggable: false,
                    editable: false,
                  },
                }}
              />

              {zones.map((zone) => (
                <Polygon
                  key={zone.id}
                  path={zone.coordinates}
                  options={{
                    fillColor: zoneFill[zone.type],
                    fillOpacity: 0.25,
                    strokeColor: zoneStroke[zone.type],
                    strokeWeight: 2,
                    clickable: false,
                    draggable: false,
                    editable: false,
                  }}
                />
              ))}

              {mapPoints.map((point) => (
                <Marker
                  key={point.id}
                  position={{ lat: point.lat, lng: point.lng }}
                  title={`${point.name} (${point.type})`}
                />
              ))}
            </GoogleMap>
          )}
        </main>
      </div>

      {pointModalOpen && pendingPointCoords && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-6 lg:p-8">
            <h3 className="text-xl font-semibold mb-4">Add Map Point</h3>
            <p className="text-xs text-gray-400 mb-4">
              Lat: {pendingPointCoords.lat.toFixed(6)} | Lng: {pendingPointCoords.lng.toFixed(6)}
            </p>

            <form onSubmit={handlePointSave} className="space-y-3">
              <input
                value={pointName}
                onChange={(event) => setPointName(event.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm"
                placeholder="Point Name"
                required
              />

              <select
                value={pointType}
                onChange={(event) => setPointType(event.target.value as PointType)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm"
              >
                <option value="shelter">Shelter</option>
                <option value="safe_location">Safe Location</option>
                <option value="medical">Medical</option>
                <option value="resource">Resource</option>
              </select>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePointModal}
                  className="w-full py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-medium"
                >
                  Save Point
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
