'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { off, onValue, ref, runTransaction, set } from 'firebase/database';
import { database } from '@/lib/firebase';
import { AlertCircle, CheckCircle, Loader2, Lock } from 'lucide-react';

type UserStatus = 'safe' | 'need_help' | 'assigned';

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
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  assignedAt?: string;
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
  assigned: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
};

// Transaction-based assignment function
async function assignUserToVolunteer(
  userUid: string,
  volunteerUid: string,
  volunteerName: string | null | undefined
): Promise<boolean> {
  try {
    const statusRef = ref(database, `user_status/${userUid}`);
    const result = await runTransaction(statusRef, (current: any) => {
      if (!current) {
        return current;
      }

      // Only assign if currently need_help (prevent overwriting existing assignments)
      if (current.status === 'need_help') {
        return {
          ...current,
          status: 'assigned',
          assignedVolunteerId: volunteerUid,
          assignedVolunteerName: volunteerName || 'Volunteer',
          assignedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      // Return unchanged if already assigned (no overwrite)
      return current;
    });

    return result.committed;
  } catch (error) {
    console.error('[Assignment] Transaction failed:', error);
    return false;
  }
}

export function VolunteerRescueMap({ user }: VolunteerRescueMapProps) {
  const [volunteerLocation, setVolunteerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(() => {
    if (typeof navigator === 'undefined') {
      return null;
    }
    return navigator.geolocation ? null : 'Geolocation is not supported by your browser.';
  });
  const [userStatuses, setUserStatuses] = useState<UserStatusRecord[]>([]);
  const [assigningUserIds, setAssigningUserIds] = useState<Set<string>>(new Set());

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
              assignedVolunteerId?: string;
              assignedVolunteerName?: string;
              assignedAt?: string;
            }
          >
        | null;
      if (!value) {
        setUserStatuses([]);
        return;
      }

      const parsed: UserStatusRecord[] = Object.entries(value)
        .map(([uid, record]): UserStatusRecord | null => {
          const rawLocation = record?.location || {};
          const lat = typeof rawLocation.lat === 'number' ? rawLocation.lat : rawLocation.latitude;
          const lng = typeof rawLocation.lng === 'number' ? rawLocation.lng : rawLocation.longitude;

          if (typeof lat !== 'number' || typeof lng !== 'number') {
            return null;
          }

          const status = record?.status === 'need_help' || record?.status === 'assigned' || record?.status === 'safe'
            ? record.status
            : 'safe';

          return {
            uid,
            name: String(record?.name || 'Unknown'),
            status,
            location: { lat, lng },
            assignedVolunteerId: record?.assignedVolunteerId,
            assignedVolunteerName: record?.assignedVolunteerName,
            assignedAt: record?.assignedAt,
          };
        })
        .filter((item): item is UserStatusRecord => item !== null);

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

    mapRef.current.setCenter(volunteerLocation);
    mapRef.current.setZoom(14);
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

    // Show both "need_help" and "assigned" in Need Help list
    const needHelp = withMetrics
      .filter((item) => item.status === 'need_help' || item.status === 'assigned')
      .sort((a, b) => a.etaMinutes - b.etaMinutes);
    const safe = withMetrics
      .filter((item) => item.status === 'safe')
      .sort((a, b) => a.etaMinutes - b.etaMinutes);

    return { needHelpList: needHelp, safeList: safe };
  }, [isLoaded, user, userStatuses, volunteerLocation]);

  const handleAcknowledge = async (userUid: string) => {
    if (!user?.uid || !user?.displayName) {
      return;
    }

    setAssigningUserIds((prev) => new Set(prev).add(userUid));

    try {
      await assignUserToVolunteer(userUid, user.uid, user.displayName);
    } catch (error) {
      console.error('[UI] Acknowledge failed:', error);
    } finally {
      setAssigningUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userUid);
        return next;
      });
    }
  };

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
              zoom={14}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              onUnmount={() => {
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
              {needHelpList.map((item, index) => {
                const isYourMission = item.status === 'assigned' && item.assignedVolunteerId === user?.uid;
                const isAlreadyAssigned = item.status === 'assigned' && item.assignedVolunteerId !== user?.uid;
                const isLoading = assigningUserIds.has(item.uid);

                return (
                  <div
                    key={item.uid}
                    className="bg-gray-950 border border-gray-800 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${index === 0 ? 'font-bold' : 'font-medium'} flex-1`}>{item.name}</p>
                      {isYourMission && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-900/40 border border-green-700 text-green-300 white-space-nowrap">
                          <span>🟢</span>
                          Your Mission
                        </span>
                      )}
                      {isAlreadyAssigned && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 whitespace-nowrap">
                          <Lock size={12} />
                          Assigned
                        </span>
                      )}
                    </div>

                    {item.status === 'assigned' && item.assignedVolunteerName && (
                      <p className="text-xs text-gray-400 mt-2">
                        🚑 Assigned to {item.assignedVolunteerName}
                      </p>
                    )}

                    <div className="text-xs text-gray-400 mt-2 space-y-1">
                      <p>Distance: {item.distanceKm.toFixed(1)} km</p>
                      <p>ETA: {item.etaMinutes.toFixed(0)} mins</p>
                    </div>

                    <button
                      onClick={() => handleAcknowledge(item.uid)}
                      disabled={isYourMission || isAlreadyAssigned || isLoading}
                      className={`w-full mt-3 py-2 rounded-lg text-xs font-semibold transition ${
                        isYourMission
                          ? 'bg-green-900/40 border border-green-700 text-green-300 cursor-not-allowed'
                          : isAlreadyAssigned
                            ? 'bg-gray-800 border border-gray-700 text-gray-400 cursor-not-allowed'
                            : isLoading
                              ? 'bg-blue-900/40 border border-blue-700 text-blue-300 cursor-wait'
                              : 'bg-blue-600 hover:bg-blue-500 border border-blue-600 text-white cursor-pointer'
                      }`}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          Acknowledging...
                        </span>
                      ) : isYourMission ? (
                        'Mission Active'
                      ) : isAlreadyAssigned ? (
                        'Already Assigned'
                      ) : (
                        'Acknowledge'
                      )}
                    </button>
                  </div>
                );
              })}
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
