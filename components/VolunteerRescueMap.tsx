'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { off, onValue, ref, set } from 'firebase/database';
import { database } from '@/lib/firebase';

type UserStatus = 'safe' | 'need_help';

type VolunteerUser = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};

type UserStatusRecord = {
  uid: string;
  name: string;
  status: UserStatus;
  location: { lat: number; lng: number };
};

type UserStatusView = UserStatusRecord & {
  distanceKm: number;
  etaMinutes: number;
};

type VolunteerRescueMapProps = {
  user: VolunteerUser | null;
};

const libraries: NonNullable<Parameters<typeof useJsApiLoader>[0]['libraries']> = ['drawing', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 13.0827,
  lng: 80.2707,
};

const markerIconUrl: Record<UserStatus, string> = {
  need_help: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
  safe: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
};

export function VolunteerRescueMap({ user }: VolunteerRescueMapProps) {
  const [volunteerLocation, setVolunteerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(() => {
    if (typeof navigator === 'undefined') {
      return null;
    }
    return navigator.geolocation ? null : 'Geolocation is not supported by your browser.';
  });
  const [userStatuses, setUserStatuses] = useState<UserStatusRecord[]>([]);

  const mapRef = useRef<google.maps.Map | null>(null);
  const volunteerMarkerRef = useRef<google.maps.Marker | null>(null);
  const userMarkersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey,
    libraries,
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setVolunteerLocation(nextLocation);
        setLocationError(null);

        const volunteerRef = ref(database, `volunteers/${user.uid}`);
        await set(volunteerRef, {
          name: user.displayName || 'Volunteer',
          email: user.email || '',
          location: nextLocation,
          updatedAt: Date.now(),
        });
      },
      (error) => {
        setLocationError(error.message || 'Unable to watch location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const statusRef = ref(database, 'user_status');
    const listener = onValue(statusRef, (snapshot) => {
      const value = snapshot.val() as
        | Record<
            string,
            {
              name?: string;
              status?: string;
              location?: {
                lat?: number;
                lng?: number;
                latitude?: number;
                longitude?: number;
              };
            }
          >
        | null;
      if (!value) {
        setUserStatuses([]);
        return;
      }

      const parsed: UserStatusRecord[] = Object.entries(value)
        .map(([uid, record]) => {
          const rawLocation = record?.location || {};
          const lat = typeof rawLocation.lat === 'number' ? rawLocation.lat : rawLocation.latitude;
          const lng = typeof rawLocation.lng === 'number' ? rawLocation.lng : rawLocation.longitude;

          if (typeof lat !== 'number' || typeof lng !== 'number') {
            return null;
          }

          return {
            uid,
            name: String(record?.name || 'Unknown'),
            status: record?.status === 'need_help' ? 'need_help' : 'safe',
            location: { lat, lng },
          } satisfies UserStatusRecord;
        })
        .filter((item): item is UserStatusRecord => Boolean(item));

      setUserStatuses(parsed);
    });

    return () => {
      off(statusRef, 'value', listener);
    };
  }, [user]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) {
      return;
    }

    if (!user) {
      userMarkersRef.current.forEach((marker) => {
        google.maps.event.clearInstanceListeners(marker);
        marker.setMap(null);
      });
      userMarkersRef.current = [];
      return;
    }

    if (!volunteerLocation) {
      return;
    }

    if (!volunteerMarkerRef.current) {
      volunteerMarkerRef.current = new google.maps.Marker({
        position: volunteerLocation,
        map: mapRef.current,
        label: 'You',
        icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      });
    } else {
      volunteerMarkerRef.current.setPosition(volunteerLocation);
    }
  }, [isLoaded, user, volunteerLocation]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) {
      return;
    }

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    userMarkersRef.current.forEach((marker) => {
      google.maps.event.clearInstanceListeners(marker);
      marker.setMap(null);
    });
    userMarkersRef.current = [];

    userStatuses.forEach((record) => {
      const marker = new google.maps.Marker({
        position: record.location,
        map: mapRef.current,
        icon: markerIconUrl[record.status],
      });

      marker.addListener('click', () => {
        infoWindowRef.current?.setContent(
          `<div style="min-width:140px;color:#111827;"><strong>${record.name}</strong><br/><span style="text-transform:capitalize;">${record.status.replace('_', ' ')}</span></div>`
        );
        infoWindowRef.current?.open({ map: mapRef.current, anchor: marker });
      });

      userMarkersRef.current.push(marker);
    });
  }, [isLoaded, user, userStatuses]);

  useEffect(() => {
    return () => {
      userMarkersRef.current.forEach((marker) => marker.setMap(null));
      userMarkersRef.current = [];
      volunteerMarkerRef.current?.setMap(null);
      infoWindowRef.current?.close();
      mapRef.current = null;
    };
  }, []);

  const { needHelpList, safeList } = useMemo(() => {
    if (!user || !isLoaded || !volunteerLocation || !window.google?.maps?.geometry?.spherical) {
      return { needHelpList: [] as UserStatusView[], safeList: [] as UserStatusView[] };
    }

    const origin = new google.maps.LatLng(volunteerLocation.lat, volunteerLocation.lng);

    const withMetrics = userStatuses.map((record) => {
      const destination = new google.maps.LatLng(record.location.lat, record.location.lng);
      const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(origin, destination);
      const distanceKm = distanceMeters / 1000;
      const etaMinutes = (distanceKm / 40) * 60;

      return {
        ...record,
        distanceKm,
        etaMinutes,
      } satisfies UserStatusView;
    });

    const needHelp = withMetrics
      .filter((item) => item.status === 'need_help')
      .sort((a, b) => a.etaMinutes - b.etaMinutes);
    const safe = withMetrics
      .filter((item) => item.status === 'safe')
      .sort((a, b) => a.etaMinutes - b.etaMinutes);

    return { needHelpList: needHelp, safeList: safe };
  }, [isLoaded, user, userStatuses, volunteerLocation]);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex flex-col lg:flex-row h-[720px]">
        <div className="w-full lg:w-[70%] h-full relative">
          {loadError && (
            <div className="h-full flex items-center justify-center text-sm text-red-300 bg-gray-950">
              Failed to load Google Maps.
            </div>
          )}

          {!googleMapsApiKey && (
            <div className="h-full flex items-center justify-center text-sm text-red-300 bg-gray-950">
              Google Maps API key not configured.
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
              center={volunteerLocation || defaultCenter}
              zoom={volunteerLocation ? 13 : 11}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              onUnmount={() => {
                mapRef.current = null;
              }}
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
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#9ca3af' }],
                  },
                  {
                    elementType: 'labels.text.stroke',
                    stylers: [{ color: '#111827' }],
                  },
                ],
              }}
            />
          )}

          {locationError && (
            <div className="absolute bottom-4 left-4 bg-red-900/80 border border-red-700 text-red-200 text-xs px-3 py-2 rounded-lg">
              {locationError}
            </div>
          )}
        </div>

        <aside className="w-full lg:w-[30%] h-full border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-900/80 px-5 py-6 overflow-y-auto">
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-red-400">Need Help</h3>
              <p className="text-xs text-gray-400">Sorted by fastest ETA</p>
            </div>
            <div className="space-y-3">
              {needHelpList.length === 0 && (
                <div className="text-xs text-gray-500">No active rescue requests.</div>
              )}
              {needHelpList.map((item, index) => (
                <div
                  key={item.uid}
                  className="bg-gray-950 border border-gray-800 rounded-xl p-3"
                >
                  <p className={`text-sm ${index === 0 ? 'font-bold' : 'font-medium'}`}>{item.name}</p>
                  <div className="text-xs text-gray-400 mt-2 space-y-1">
                    <p>Distance: {item.distanceKm.toFixed(1)} km</p>
                    <p>ETA: {item.etaMinutes.toFixed(0)} mins</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4 mt-8">
            <div>
              <h3 className="text-lg font-semibold text-green-400">Safe</h3>
              <p className="text-xs text-gray-400">Sorted by fastest ETA</p>
            </div>
            <div className="space-y-3">
              {safeList.length === 0 && (
                <div className="text-xs text-gray-500">No safe users reporting currently.</div>
              )}
              {safeList.map((item, index) => (
                <div
                  key={item.uid}
                  className="bg-gray-950 border border-gray-800 rounded-xl p-3"
                >
                  <p className={`text-sm ${index === 0 ? 'font-bold' : 'font-medium'}`}>{item.name}</p>
                  <div className="text-xs text-gray-400 mt-2 space-y-1">
                    <p>Distance: {item.distanceKm.toFixed(1)} km</p>
                    <p>ETA: {item.etaMinutes.toFixed(0)} mins</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
