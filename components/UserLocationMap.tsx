'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { AlertCircle, Loader2, MapPin, X } from 'lucide-react';
import { off, onValue, ref } from 'firebase/database';
import { database } from '@/lib/firebase';

interface UserLocation {
  lat: number;
  lng: number;
}

type ZoneType = 'red' | 'orange' | 'green';
type PointType = 'shelter' | 'safe_location' | 'medical' | 'resource';
type AlertSeverity = 'low' | 'medium' | 'high';

interface ZoneItem {
  type: ZoneType;
  coordinates: Array<{ lat: number; lng: number }>;
}

interface MapPointItem {
  name: string;
  type: PointType;
  lat: number;
  lng: number;
}

interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  createdAt: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '12px',
};

const defaultCenter = {
  lat: 17.385,
  lng: 78.486,
};

const polygonColors: Record<ZoneType, string> = {
  red: '#ff0000',
  orange: '#ffa500',
  green: '#00ff00',
};

const pointIconUrl: Record<PointType, string> = {
  shelter: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
  safe_location: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
  medical: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  resource: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
};

const severityColors: Record<AlertSeverity, string> = {
  high: 'bg-red-600',
  medium: 'bg-orange-500',
  low: 'bg-yellow-500',
};

export function UserLocationMap() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [latestAlert, setLatestAlert] = useState<AlertItem | null>(null);
  const [alertClosed, setAlertClosed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef<google.maps.Map | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const libraries: NonNullable<Parameters<typeof useJsApiLoader>[0]['libraries']> = useMemo(
    () => ['drawing', 'geometry'],
    []
  );

  // Load Google Maps API using hook
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey,
    libraries,
  });

  const clearPolygons = useCallback(() => {
    polygonsRef.current.forEach((polygon) => {
      google.maps.event.clearInstanceListeners(polygon);
      polygon.setMap(null);
    });
    polygonsRef.current = [];
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => {
      google.maps.event.clearInstanceListeners(marker);
      marker.setMap(null);
    });
    markersRef.current = [];
  }, []);

  const renderZones = useCallback(
    (zonesData: Record<string, ZoneItem> | null) => {
      if (!mapRef.current) {
        return;
      }

      clearPolygons();

      if (!zonesData) {
        return;
      }

      Object.values(zonesData).forEach((zone) => {
        if (!zone?.type || !Array.isArray(zone.coordinates) || zone.coordinates.length < 3) {
          return;
        }

        const validPath = zone.coordinates.filter(
          (point) => typeof point?.lat === 'number' && typeof point?.lng === 'number'
        );

        if (validPath.length < 3) {
          return;
        }

        const fillColor = polygonColors[zone.type] || polygonColors.red;

        const polygon = new google.maps.Polygon({
          paths: validPath,
          fillColor,
          fillOpacity: 0.35,
          strokeColor: fillColor,
          strokeWeight: 2,
          map: mapRef.current,
        });

        polygonsRef.current.push(polygon);
      });
    },
    [clearPolygons]
  );

  const renderMapPoints = useCallback(
    (pointsData: Record<string, MapPointItem> | null) => {
      if (!mapRef.current) {
        return;
      }

      clearMarkers();

      if (!pointsData) {
        return;
      }

      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow();
      }

      Object.values(pointsData).forEach((point) => {
        if (
          !point?.name ||
          !point?.type ||
          typeof point?.lat !== 'number' ||
          typeof point?.lng !== 'number'
        ) {
          return;
        }

        const marker = new google.maps.Marker({
          position: { lat: point.lat, lng: point.lng },
          map: mapRef.current,
          icon: pointIconUrl[point.type] || pointIconUrl.shelter,
          title: point.name,
        });

        marker.addListener('click', () => {
          infoWindowRef.current?.setContent(
            `<div style="min-width:140px;color:#111827;"><strong>${point.name}</strong><br/><span style="text-transform:capitalize;">${point.type.replace('_', ' ')}</span></div>`
          );
          infoWindowRef.current?.open({
            map: mapRef.current,
            anchor: marker,
          });
        });

        markersRef.current.push(marker);
      });
    },
    [clearMarkers]
  );

  const resolveLatestAlert = useCallback((alertsData: Record<string, Omit<AlertItem, 'id'>> | null) => {
    if (!alertsData) {
      setLatestAlert(null);
      return;
    }

    const latest = Object.entries(alertsData)
      .map(([id, alert]) => ({
        id,
        title: String(alert.title || ''),
        message: String(alert.message || ''),
        severity: (alert.severity as AlertSeverity) || 'low',
        createdAt: Number(alert.createdAt || 0),
      }))
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!latest) {
      setLatestAlert(null);
      return;
    }

    setLatestAlert((previous) => {
      if (!previous || previous.id !== latest.id || previous.createdAt !== latest.createdAt) {
        setAlertClosed(false);
      }
      return latest;
    });
  }, []);

  // Request location permission
  const requestLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        setPermissionStatus('granted');
        setLoading(false);
      },
      (error) => {
        let errorMessage = 'Unable to retrieve your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Showing default location.';
            setPermissionStatus('denied');
            setUserLocation(defaultCenter);
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get your location timed out.';
            break;
        }
        
        setError(errorMessage);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Auto-request location on component mount
  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapReady || !mapRef.current || !userLocation) {
      return;
    }

    if (!userMarkerRef.current) {
      userMarkerRef.current = new google.maps.Marker({
        position: userLocation,
        map: mapRef.current,
        label: {
          text: 'You',
          color: '#1e3a8a',
          fontWeight: '600',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
    } else {
      userMarkerRef.current.setPosition(userLocation);
    }
  }, [isLoaded, mapReady, userLocation]);

  useEffect(() => {
    if (!isLoaded || !mapReady || !mapRef.current) {
      return;
    }

    const zonesRef = ref(database, 'zones');
    const mapPointsRef = ref(database, 'mapPoints');
    const alertsRef = ref(database, 'alerts');

    const zonesListener = (snapshot: { val: () => Record<string, ZoneItem> | null }) => {
      renderZones(snapshot.val());
    };

    const mapPointsListener = (snapshot: { val: () => Record<string, MapPointItem> | null }) => {
      renderMapPoints(snapshot.val());
    };

    const alertsListener = (snapshot: {
      val: () => Record<string, Omit<AlertItem, 'id'>> | null;
    }) => {
      resolveLatestAlert(snapshot.val());
    };

    onValue(zonesRef, zonesListener);
    onValue(mapPointsRef, mapPointsListener);
    onValue(alertsRef, alertsListener);

    return () => {
      off(zonesRef, 'value', zonesListener);
      off(mapPointsRef, 'value', mapPointsListener);
      off(alertsRef, 'value', alertsListener);

      clearPolygons();
      clearMarkers();
      infoWindowRef.current?.close();
    };
  }, [clearMarkers, clearPolygons, isLoaded, mapReady, renderMapPoints, renderZones, resolveLatestAlert]);

  useEffect(() => {
    return () => {
      clearPolygons();
      clearMarkers();
      userMarkerRef.current?.setMap(null);
      infoWindowRef.current?.close();
      mapRef.current = null;
    };
  }, [clearMarkers, clearPolygons]);

  const showAlertBanner = Boolean(latestAlert && !alertClosed);

  const bannerBackground = latestAlert ? severityColors[latestAlert.severity] || severityColors.low : severityColors.low;

  if (loadError) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-xl p-6">
        <AlertCircle size={24} className="text-red-400 mb-2" />
        <p className="text-red-200">Error loading Google Maps</p>
      </div>
    );
  }

  if (!googleMapsApiKey) {
    return (
      <div className="bg-red-900 border border-red-700 rounded-xl p-6">
        <AlertCircle size={24} className="text-red-400 mb-2" />
        <p className="text-red-200">Google Maps API key is not configured</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-gray-800 rounded-xl p-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-red-600 mx-auto mb-3" />
          <p className="text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <div
        className={`fixed top-0 left-0 right-0 z-40 transform transition-transform duration-300 ${
          showAlertBanner ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        {latestAlert && (
          <div className={`${bannerBackground} text-black px-4 py-3 shadow-lg`}>
            <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-sm">{latestAlert.title}</p>
                <p className="text-sm">{latestAlert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setAlertClosed(true)}
                className="p-1 rounded hover:bg-black/10"
                aria-label="Close alert"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Location Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-red-500" />
          <h3 className="text-xl font-bold">Your Location</h3>
        </div>
        
        {permissionStatus === 'denied' && (
          <button
            onClick={requestLocation}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition duration-300 text-sm"
          >
            Request Location Again
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-semibold mb-1">Location Access Issue</p>
              <p className="text-yellow-300 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-gray-800 rounded-xl p-12 flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-red-600 mx-auto mb-3" />
            <p className="text-gray-400">Requesting location permission...</p>
          </div>
        </div>
      )}

      {/* Map */}
      {!loading && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg relative">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={userLocation || defaultCenter}
            zoom={14}
            onLoad={(map) => {
              mapRef.current = map;
              setMapReady(true);
            }}
            onUnmount={() => {
              setMapReady(false);
              mapRef.current = null;
            }}
            options={{
              disableDefaultUI: false,
              fullscreenControl: true,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              styles: [],
            }}
          />

          <div className="absolute bottom-3 right-3 bg-gray-950/90 border border-gray-700 rounded-lg p-3 text-xs text-gray-200 w-52 space-y-1">
            <p className="font-semibold mb-1">Legend</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2" />Red Zone → Danger</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2" />Orange Zone → Warning</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2" />Green Zone → Safe</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2" />Blue → Shelter</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-red-600 mr-2" />Red Marker → Medical</p>
            <p><span className="inline-block w-3 h-3 rounded-full bg-orange-400 mr-2" />Orange Marker → Resource</p>
          </div>
        </div>
      )}

      {/* Location Coordinates */}
      {userLocation && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-2">Current Coordinates:</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-500 text-xs">Latitude</p>
              <p className="text-white font-mono">{userLocation.lat.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Longitude</p>
              <p className="text-white font-mono">{userLocation.lng.toFixed(6)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
