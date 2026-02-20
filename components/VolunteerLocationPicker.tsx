'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { MapPin, Crosshair, Search, Loader2, AlertCircle } from 'lucide-react';

const libraries: ('places' | 'geometry')[] = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '450px',
  borderRadius: '12px',
};

const defaultCenter = {
  lat: 13.0827, // Chennai center
  lng: 80.2707,
};

interface VolunteerLocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address?: string) => void;
  initialLocation?: { lat: number; lng: number };
}

export function VolunteerLocationPicker({
  onLocationSelect,
  initialLocation,
}: VolunteerLocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<google.maps.LatLngLiteral>(
    initialLocation || defaultCenter
  );
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(
    initialLocation || defaultCenter
  );
  const [mapZoom, setMapZoom] = useState(initialLocation ? 15 : 12);
  const [searchValue, setSearchValue] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script',
    googleMapsApiKey,
    libraries,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const handlePlaceSelect = useCallback(() => {
    if (!autocompleteRef.current) return;

    const place = autocompleteRef.current.getPlace();

    if (!place.geometry || !place.geometry.location) {
      setLocationError('No location data found for this place');
      return;
    }

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || place.name || '';

    setSelectedLocation({ lat, lng });
    setMapCenter({ lat, lng });
    setMapZoom(16);
    setSelectedAddress(address);
    setLocationError(null);

    onLocationSelect(lat, lng, address);
  }, [onLocationSelect]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;

      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      setSelectedLocation({ lat, lng });
      setLocationError(null);

      // Reverse geocode to get address
      if (window.google && window.google.maps) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const address = results[0].formatted_address;
            setSelectedAddress(address);
            onLocationSelect(lat, lng, address);
          } else {
            onLocationSelect(lat, lng);
          }
        });
      } else {
        onLocationSelect(lat, lng);
      }
    },
    [onLocationSelect]
  );

  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setSelectedLocation({ lat, lng });
        setMapCenter({ lat, lng });
        setMapZoom(16);
        setDetectingLocation(false);

        // Reverse geocode to get address
        if (window.google && window.google.maps) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const address = results[0].formatted_address;
              setSelectedAddress(address);
              setSearchValue(address);
              onLocationSelect(lat, lng, address);
            } else {
              onLocationSelect(lat, lng);
            }
          });
        } else {
          onLocationSelect(lat, lng);
        }
      },
      (error) => {
        setDetectingLocation(false);
        let errorMessage = 'Unable to detect your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        
        setLocationError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [onLocationSelect]);

  // Notify parent of initial location if provided
  useEffect(() => {
    if (initialLocation) {
      onLocationSelect(initialLocation.lat, initialLocation.lng);
    }
  }, []);

  if (loadError) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 text-center">
        <AlertCircle className="mx-auto mb-3 text-red-400" size={32} />
        <p className="text-red-300 font-semibold">Failed to load Google Maps</p>
        <p className="text-red-400 text-sm mt-2">
          Please check your API key configuration
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Loader2 className="mx-auto mb-3 text-blue-400 animate-spin" size={32} />
        <p className="text-gray-300">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Detect Location Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input with Autocomplete */}
        <div className="flex-1 relative">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <Autocomplete
              onLoad={onAutocompleteLoad}
              onPlaceChanged={handlePlaceSelect}
              options={{
                componentRestrictions: { country: 'in' },
                fields: ['formatted_address', 'geometry', 'name'],
              }}
            >
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search for a location..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-11 pr-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </Autocomplete>
          </div>
        </div>

        {/* Detect My Location Button */}
        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={detectingLocation}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
        >
          {detectingLocation ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Detecting...
            </>
          ) : (
            <>
              <Crosshair size={18} />
              Detect My Location
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {locationError && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
          <p className="text-red-300 text-sm">{locationError}</p>
        </div>
      )}

      {/* Selected Address Display */}
      {selectedAddress && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 flex items-start gap-3">
          <MapPin className="text-green-400 flex-shrink-0 mt-0.5" size={18} />
          <div className="flex-1 min-w-0">
            <p className="text-green-300 text-sm font-semibold mb-1">Selected Location:</p>
            <p className="text-gray-300 text-sm break-words">{selectedAddress}</p>
            <p className="text-gray-500 text-xs mt-1">
              Lat: {selectedLocation.lat.toFixed(6)}, Lng: {selectedLocation.lng.toFixed(6)}
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="border border-gray-700 rounded-xl overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={mapZoom}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            styles: [
              {
                featureType: 'all',
                elementType: 'geometry',
                stylers: [{ color: '#242f3e' }],
              },
              {
                featureType: 'all',
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#242f3e' }],
              },
              {
                featureType: 'all',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#746855' }],
              },
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#17263c' }],
              },
            ],
          }}
        >
          {/* Marker at selected location */}
          <Marker
            position={selectedLocation}
            draggable={true}
            onDragEnd={(e) => {
              if (e.latLng) {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                setSelectedLocation({ lat, lng });
                
                // Reverse geocode on drag end
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                  if (status === 'OK' && results && results[0]) {
                    const address = results[0].formatted_address;
                    setSelectedAddress(address);
                    onLocationSelect(lat, lng, address);
                  } else {
                    onLocationSelect(lat, lng);
                  }
                });
              }
            }}
            icon={{
              url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            }}
          />
        </GoogleMap>
      </div>

      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <p className="text-blue-300 text-sm">
          <span className="font-semibold">💡 Tip:</span> You can search for a location, use your
          current location, click on the map, or drag the marker to set your position.
        </p>
      </div>
    </div>
  );
}
