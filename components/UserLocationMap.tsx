'use client';

import React, { useState, useEffect } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

interface UserLocation {
  lat: number;
  lng: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '12px',
};

const defaultCenter = {
  lat: 13.0827, // Chennai coordinates
  lng: 80.2707,
};

export function UserLocationMap() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Load Google Maps API using hook
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey,
  });

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
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            setPermissionStatus('denied');
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
    <div className="space-y-4">
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
        <div className="bg-white border border-gray-300 rounded-xl overflow-hidden shadow-lg">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={userLocation || defaultCenter}
            zoom={userLocation ? 15 : 12}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
              mapTypeId: 'roadmap',
            }}
          >
            {/* User Location Marker with Enhanced Styling */}
            {userLocation && (
              <>
                {/* Outer pulse ring */}
                <Marker
                  position={userLocation}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 20,
                    fillColor: '#EF4444',
                    fillOpacity: 0.15,
                    strokeColor: '#DC2626',
                    strokeWeight: 2,
                    strokeOpacity: 0.4,
                  }}
                />
                {/* Main marker */}
                <Marker
                  position={userLocation}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#DC2626',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 3,
                  }}
                  title="📍 You are here"
                />
              </>
            )}
          </GoogleMap>
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
