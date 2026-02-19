'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  DrawingManager,
  GoogleMap,
  Marker,
  Polygon,
  useJsApiLoader,
} from '@react-google-maps/api';
import { getDatabase, onValue, push, ref, set } from 'firebase/database';
import app from '@/lib/firebase';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  });
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [mapPoints, setMapPoints] = useState<PointRecord[]>([]);
  const [selectedZoneType, setSelectedZoneType] = useState<ZoneType>('red');

  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<Severity>('medium');

  const [pointModeEnabled, setPointModeEnabled] = useState(false);
  const [pointModalOpen, setPointModalOpen] = useState(false);
  const [pendingPointCoords, setPendingPointCoords] = useState<LatLng | null>(null);
  const [pointName, setPointName] = useState('');
  const [pointType, setPointType] = useState<PointType>('shelter');

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

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (loginId === ADMIN_ID && loginPassword === ADMIN_PASSWORD) {
      localStorage.setItem(AUTH_STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      setLoginError('');
      return;
    }

    setLoginError('Invalid ID or Password');
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
        <div className="w-full max-w-md border border-gray-800 bg-gray-900 rounded-xl p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold mb-2">Admin Control Login</h1>
          <p className="text-sm text-gray-400 mb-6">Restricted access for emergency command center</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">ID</label>
              <input
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 outline-none focus:border-gray-500"
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
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 outline-none focus:border-gray-500"
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
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="flex h-screen">
        <aside className="w-[30%] min-w-[360px] max-w-[460px] border-r border-gray-800 bg-gray-900/80 backdrop-blur-sm overflow-y-auto p-6 space-y-8">
          <div className="flex items-center justify-between">
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
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Alert Title"
                required
              />

              <textarea
                value={alertMessage}
                onChange={(event) => setAlertMessage(event.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm min-h-24"
                placeholder="Alert Message"
                required
              />

              <select
                value={alertSeverity}
                onChange={(event) => setAlertSeverity(event.target.value as Severity)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
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
        </aside>

        <main className="w-[70%] h-full relative">
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
              center={chennaiCenter}
              zoom={12}
              onClick={handleMapClick}
              options={{
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                styles: [
                  {
                    elementType: 'geometry',
                    stylers: [{ color: '#1f2937' }],
                  },
                  {
                    elementType: 'labels.text.stroke',
                    stylers: [{ color: '#111827' }],
                  },
                  {
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#9ca3af' }],
                  },
                ],
              }}
            >
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
          <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-xl font-semibold mb-4">Add Map Point</h3>
            <p className="text-xs text-gray-400 mb-4">
              Lat: {pendingPointCoords.lat.toFixed(6)} | Lng: {pendingPointCoords.lng.toFixed(6)}
            </p>

            <form onSubmit={handlePointSave} className="space-y-3">
              <input
                value={pointName}
                onChange={(event) => setPointName(event.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Point Name"
                required
              />

              <select
                value={pointType}
                onChange={(event) => setPointType(event.target.value as PointType)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="shelter">Shelter</option>
                <option value="safe_location">Safe Location</option>
                <option value="medical">Medical</option>
                <option value="resource">Resource</option>
              </select>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePointModal}
                  className="w-1/2 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-medium"
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
