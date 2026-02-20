'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Volume2, VolumeX } from 'lucide-react';

// Point-in-Polygon algorithm (Ray casting)
const isPointInPolygon = (
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean => {
  if (!point || !polygon || polygon.length < 3) return false;

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
};

interface Zone {
  id: string;
  type: 'red' | 'orange' | 'green';
  coordinates: Array<{ lat: number; lng: number }>;
  createdAt: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface UserStatus {
  uid: string;
  name: string;
  email: string;
  location?: UserLocation;
  status: string;
  timestamp: number;
  updatedAt: string;
}

export function RedZoneAlertSystem() {
  const { user } = useAuth();
  const [alertActive, setAlertActive] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [redZones, setRedZones] = useState<Zone[]>([]);
  const [userInRedZone, setUserInRedZone] = useState(false);
  const [debug, setDebug] = useState({ userLocationLoaded: false, zonesLoaded: false });
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alertAcknowledgedRef = useRef(false); // Track if alert was acknowledged by user
  const prevZonesRef = useRef<Zone[]>([]);
  const isMountedRef = useRef(true);

  // Mount debug log
  useEffect(() => {
    console.log('[RedZone] Component mounted');
    console.log('[RedZone] User ID:', user?.uid);
    console.log('[RedZone] Database ref:', database);
    return () => {
      console.log('[RedZone] Component unmounting');
    };
  }, [user?.uid]);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio('/alarm.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Listen to user location
  useEffect(() => {
    if (!user?.uid) {
      console.log('[RedZone] User UID not available yet:', user?.uid);
      return;
    }

    console.log('[RedZone] Setting up user location listener for UID:', user.uid);
    const userStatusRef = ref(database, `user_status/${user.uid}`);

    const unsubscribe = onValue(
      userStatusRef,
      (snapshot) => {
        console.log('[RedZone] User status listener triggered');
        const data = snapshot.val() as UserStatus | null;
        console.log('[RedZone] Raw user status from DB:', data);

        if (!data?.location) {
          console.log('[RedZone] User location not available in DB');
          setDebug((prev) => ({ ...prev, userLocationLoaded: false }));
          return;
        }

        if (!isMountedRef.current) {
          console.log('[RedZone] Component unmounted, ignoring location update');
          return;
        }

        const location = {
          latitude: Number(data.location.latitude),
          longitude: Number(data.location.longitude),
        };

        console.log('[RedZone] Raw location from DB:', data.location);
        console.log('[RedZone] Converted location:', location);
        console.log(`  Latitude: ${location.latitude} (type: ${typeof location.latitude})`);
        console.log(`  Longitude: ${location.longitude} (type: ${typeof location.longitude})`);

        setUserLocation(location);
        setDebug((prev) => ({ ...prev, userLocationLoaded: true }));
      },
      (error) => {
        console.error('[RedZone] User status listener ERROR:', error);
      }
    );

    return () => {
      console.log('[RedZone] Cleaning up user location listener');
      unsubscribe();
    };
  }, [user?.uid]);

  // Listen to zones
  useEffect(() => {
    console.log('[RedZone] Setting up zones listener...');
    const zonesRef = ref(database, 'zones');

    const unsubscribe = onValue(
      zonesRef,
      (snapshot) => {
        console.log('[RedZone] Zones listener triggered');
        const data = snapshot.val();
        console.log('[RedZone] Raw zones data from DB:', data);

        if (!data) {
          console.log('[RedZone] Zones data is empty/null');
          setRedZones([]);
          setDebug((prev) => ({ ...prev, zonesLoaded: true }));
          return;
        }

        if (!isMountedRef.current) {
          console.log('[RedZone] Component unmounted, ignoring zones update');
          return;
        }

        const zones: Zone[] = Object.entries(data).map(([id, zone]: [string, any]) => {
          console.log(`[RedZone] Processing zone ${id}:`, zone);

          // Convert coordinates object to array
          let coordArray: Array<{ lat: number; lng: number }> = [];

          if (zone.coordinates) {
            console.log(`  Coordinates type:`, typeof zone.coordinates, 'IsArray:', Array.isArray(zone.coordinates));

            if (Array.isArray(zone.coordinates)) {
              // Already an array
              coordArray = zone.coordinates;
              console.log(`  Already array: ${coordArray.length} coords`);
            } else if (typeof zone.coordinates === 'object') {
              // Object with numeric keys - convert to array
              coordArray = Object.values(zone.coordinates).map((coord: any) => {
                const converted = {
                  lat: Number(coord.lat),
                  lng: Number(coord.lng),
                };
                console.log(`    Raw coord:`, coord, `→ Converted:`, converted);
                return converted;
              });
              console.log(`  Object converted: ${coordArray.length} coords`);
            }
          }

          const zoneObj = {
            id,
            type: zone.type || 'unknown',
            coordinates: coordArray,
            createdAt: zone.createdAt,
          };

          console.log(`[RedZone] Final zone object:`, zoneObj);
          console.log(
            `  Type: "${zoneObj.type}" (isRed=${zoneObj.type === 'red'}), Coords: ${zoneObj.coordinates.length}`
          );

          return zoneObj;
        });

        console.log('[RedZone] All zones processed:', zones);
        console.log(`[RedZone] Total zones: ${zones.length}, Red zones: ${zones.filter((z) => z.type === 'red').length}`);
        setRedZones(zones);
        setDebug((prev) => ({ ...prev, zonesLoaded: true }));
        prevZonesRef.current = zones;
      },
      (error) => {
        console.error('[RedZone] Zones listener ERROR:', error);
      }
    );

    return () => {
      console.log('[RedZone] Cleaning up zones listener');
      unsubscribe();
    };
  }, []);

  // Check if user is in red zone and trigger alert
  useEffect(() => {
    console.log('[RedZone] Detection effect triggered');
    console.log('[RedZone] State:', {
      userLocation,
      redZonesCount: redZones.length,
      alertActive,
      userInRedZone,
      userAcknowledged: alertAcknowledgedRef.current,
    });

    if (!userLocation) {
      console.log('[RedZone] ⚠️ User location is NULL - waiting');
      return;
    }

    if (redZones.length === 0) {
      console.log('[RedZone] ⚠️ No zones loaded - waiting');
      return;
    }

    console.log('[RedZone] ✓ Both location and zones available - running detection');
    console.log(`[RedZone] Checking ${redZones.length} zones against user location:`, userLocation);

    // Find any red zone containing user
    let inRedZone = false;
    let triggeringZoneId = '';

    redZones.forEach((zone, index) => {
      console.log(`\n[RedZone] === ZONE ${index + 1}/${redZones.length} (${zone.id}) ===`);
      console.log(`  Type: "${zone.type}"`);
      console.log(`  Type === "red": ${zone.type === 'red'}`);
      console.log(`  Coordinates: ${zone.coordinates?.length || 0} vertices`);

      if (zone.type !== 'red') {
        console.log(`  → SKIP: Not a red zone`);
        return;
      }

      if (!zone.coordinates || zone.coordinates.length < 3) {
        console.log(`  → SKIP: Invalid polygon (needs 3+ vertices, has ${zone.coordinates?.length || 0})`);
        return;
      }

      console.log(`  Polygon coordinates:`);
      zone.coordinates.forEach((coord, i) => {
        console.log(`    ${i}: lat=${coord.lat}, lng=${coord.lng}`);
      });

      console.log(`  Testing point: lat=${userLocation.latitude}, lng=${userLocation.longitude}`);

      const isInside = isPointInPolygon(
        { lat: userLocation.latitude, lng: userLocation.longitude },
        zone.coordinates
      );

      console.log(`  → Point-in-polygon result: ${isInside ? '✓ INSIDE' : '✗ OUTSIDE'}`);

      if (isInside) {
        inRedZone = true;
        triggeringZoneId = zone.id;
        console.log(`  🔥 TRIGGERING ZONE FOUND!`);
      }
    });

    console.log(`\n[RedZone] === DETECTION COMPLETE ==`);
    console.log(`[RedZone] Final result: inRedZone = ${inRedZone}`);
    if (inRedZone) {
      console.log(`[RedZone] Triggering zone ID: ${triggeringZoneId}`);
    }

    setUserInRedZone(inRedZone);

    // Only trigger alarm if:
    // 1. User is in red zone
    // 2. Alert is not already active
    // 3. Alert was not already acknowledged
    if (inRedZone && !alertActive && !alertAcknowledgedRef.current && isMountedRef.current) {
      console.log('[RedZone] ✓✓✓ ALARM SHOULD TRIGGER NOW ✓✓✓');
      setAlertActive(true);

      // Play alarm with slight delay to ensure DOM is ready
      setTimeout(() => {
        if (audioRef.current && isMountedRef.current) {
          console.log('[RedZone] Playing audio alarm...');
          console.log('[RedZone] Audio element:', audioRef.current);
          console.log('[RedZone] Audio loop:', audioRef.current.loop);
          console.log('[RedZone] Audio src:', audioRef.current.src);

          audioRef.current.currentTime = 0;
          audioRef.current.play().catch((err) => {
            console.error('[RedZone] ❌ Alarm play failed:', err);
            console.error('  Error name:', err.name);
            console.error('  Error message:', err.message);
          });
        }
      }, 100);
    } else if (!inRedZone && alertActive) {
      // User left red zone - stop alarm and reset acknowledge flag
      console.log('[RedZone] User left red zone - stopping alarm and resetting acknowledge flag');
      setAlertActive(false);
      alertAcknowledgedRef.current = false; // Reset so alarm can trigger again if they re-enter
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } else if (!inRedZone && !alertActive) {
      console.log('[RedZone] User not in red zone - no alarm needed');
    } else if (inRedZone && alertActive) {
      console.log('[RedZone] Already in alert state - no change');
    }
  }, [userLocation, redZones, alertActive]);

  const handleAcknowledge = useCallback(() => {
    console.log('[RedZone] ✓ Acknowledge button clicked');
    console.log('[RedZone] Stopping audio...');

    // Stop audio completely
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      console.log('[RedZone] Audio paused and reset to 0');
      console.log('[RedZone] Audio paused state:', audioRef.current.paused);
    }

    // Mark alert as acknowledged by user
    alertAcknowledgedRef.current = true;
    console.log('[RedZone] Alert acknowledged flag set to true');

    // Close modal
    setAlertActive(false);
    console.log('[RedZone] Alert state set to false - modal should close');
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Modal should show ONLY when alertActive is true
  if (!alertActive) {
    // Return collapsible debug panel when not in alert
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b-2 border-yellow-500 overflow-hidden">
        {/* Toggle Button - Always Visible */}
        <button
          onClick={() => setDebugPanelOpen(!debugPanelOpen)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 font-bold">🔍 RedZoneAlertSystem Debug Panel</span>
            <span className="text-xs text-yellow-300 bg-gray-700 px-2 py-1 rounded">
              {debugPanelOpen ? 'Click to collapse' : 'Click to expand'}
            </span>
          </div>
          <span className="text-xl text-yellow-400 transition-transform duration-300" style={{
            transform: debugPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </span>
        </button>

        {/* Expandable Content - Smooth Animation */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: debugPanelOpen ? '800px' : '0px',
          }}
        >
          <div className="px-4 py-3 bg-gray-900 space-y-3">
            {/* Status Grid */}
            <div className="grid grid-cols-3 gap-4 text-sm text-yellow-200 font-mono">
              <div>
                User Location: {debug.userLocationLoaded ? '✓ Loaded' : '✗ Waiting'}
                {userLocation && (
                  <div className="text-xs text-yellow-300 ml-4 mt-1">
                    {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                  </div>
                )}
              </div>
              <div>
                Zones: {debug.zonesLoaded ? '✓ Loaded' : '✗ Waiting'}
                {redZones.length > 0 && (
                  <div className="text-xs text-yellow-300 ml-4 mt-1">
                    Total: {redZones.length}, Red: {redZones.filter((z) => z.type === 'red').length}
                  </div>
                )}
              </div>
              <div>
                Status: {userInRedZone ? '🔴 IN RED ZONE' : '✓ Safe'}
                <div className="text-xs text-yellow-300 ml-4 mt-1">
                  Alert Active: {alertActive ? '🔊 Yes' : '✓ No'}
                </div>
              </div>
            </div>

            {/* Info Text */}
            <div className="text-xs text-yellow-300 border-t border-yellow-600 pt-2">
              Check browser console (F12) for detailed logs
            </div>

            {/* Red Zones List */}
            {redZones.filter((z) => z.type === 'red').length > 0 && (
              <div className="border-t border-yellow-600 pt-2">
                <div className="text-xs font-bold text-yellow-400 mb-2">Red Zones ({redZones.filter((z) => z.type === 'red').length}):</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {redZones
                    .filter((z) => z.type === 'red')
                    .map((zone) => (
                      <div key={zone.id} className="p-2 bg-red-950 border border-red-700 rounded">
                        <div className="text-red-400 font-bold text-xs">Zone {zone.id}</div>
                        <div className="text-xs text-red-300 mt-1">
                          Polygon: {zone.coordinates.length} vertices
                          <div className="ml-2 mt-1 space-y-1">
                            {zone.coordinates.map((coord, i) => (
                              <div key={i} className="text-red-400">
                                {i}: {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Red Emergency Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-b-4 border-red-600 px-4 py-3 animate-pulse">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Volume2 className="text-red-200 animate-bounce" size={24} />
            <div>
              <h2 className="text-lg font-bold text-red-100">🚨 RED ZONE ALERT 🚨</h2>
              <p className="text-sm text-red-200">You are in a restricted danger zone. Emergency services notified.</p>
            </div>
          </div>
          <button
            onClick={handleAcknowledge}
            className="flex items-center gap-2 bg-white hover:bg-gray-100 text-red-900 font-bold px-6 py-2 rounded-lg transition-colors"
          >
            <VolumeX size={18} />
            Acknowledge Alert
          </button>
        </div>
      </div>

      {/* Emergency Modal */}
      <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-gray-900 border-4 border-red-600 rounded-2xl p-8 max-w-md shadow-2xl">
          <div className="flex justify-center mb-6">
            <AlertTriangle className="text-red-500 animate-bounce" size={64} />
          </div>

          <h1 className="text-3xl font-bold text-red-400 text-center mb-3">DANGER ZONE</h1>

          <p className="text-gray-200 text-center mb-6 leading-relaxed">
            You have entered a <span className="font-bold text-red-400">RED ZONE</span>. This area is currently
            marked as unsafe or restricted.
          </p>

          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-200 font-semibold">
              ⚠️ Emergency services have been notified of your location.
            </p>
            <p className="text-xs text-red-300 mt-2">Please proceed with caution and follow official guidance.</p>
          </div>

          <ul className="space-y-2 mb-8 text-sm text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">•</span>
              <span>Alarm will sound continuously until acknowledged</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">•</span>
              <span>Your location is being monitored in real-time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">•</span>
              <span>Contact emergency services if you need help</span>
            </li>
          </ul>

          <button
            onClick={handleAcknowledge}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors text-lg"
          >
            I Understand - Acknowledge Alert
          </button>
        </div>
      </div>
    </>
  );
}
