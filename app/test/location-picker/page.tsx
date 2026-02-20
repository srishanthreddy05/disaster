'use client';

import React, { useState } from 'react';
import { VolunteerLocationPicker } from '@/components/VolunteerLocationPicker';
import { MapPin, Save } from 'lucide-react';

export default function LocationPickerDemo() {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);

  const handleLocationSelect = (lat: number, lng: number, address?: string) => {
    setSelectedLocation({ lat, lng, address });
    setSaved(false);
  };

  const handleSave = () => {
    if (!selectedLocation) return;
    
    console.log('Saving location:', selectedLocation);
    // Here you would save to Firebase:
    // await saveToFirebase(selectedLocation);
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <MapPin className="text-blue-400" size={32} />
            <h1 className="text-3xl sm:text-4xl font-bold">Volunteer Location Picker</h1>
          </div>
          <p className="text-gray-400">
            Select your location using search, current location, or by clicking on the map
          </p>
        </div>

        {/* Location Picker Component */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
          <VolunteerLocationPicker
            onLocationSelect={handleLocationSelect}
            // initialLocation={{ lat: 13.0827, lng: 80.2707 }} // Optional: Chennai center
          />
        </div>

        {/* Selected Location Display */}
        {selectedLocation && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <MapPin className="text-green-400" size={20} />
                  Selected Location Details
                </h2>
                
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-gray-500 font-semibold w-24">Latitude:</span>
                    <span className="text-gray-200 font-mono">{selectedLocation.lat.toFixed(6)}</span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <span className="text-gray-500 font-semibold w-24">Longitude:</span>
                    <span className="text-gray-200 font-mono">{selectedLocation.lng.toFixed(6)}</span>
                  </div>
                  
                  {selectedLocation.address && (
                    <div className="flex items-start gap-3">
                      <span className="text-gray-500 font-semibold w-24">Address:</span>
                      <span className="text-gray-200">{selectedLocation.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
                disabled={saved}
              >
                <Save size={18} />
                {saved ? 'Saved!' : 'Save Location'}
              </button>
            </div>

            {saved && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3 text-green-300 text-sm">
                ✓ Location saved successfully! (This is a demo - implement Firebase save)
              </div>
            )}
          </div>
        )}

        {/* Usage Instructions */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-3 text-blue-300">How to Use:</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              <span>Type an address or place name in the search bar to get suggestions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              <span>Click "Detect My Location" to use your current GPS location</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              <span>Click anywhere on the map to manually select a location</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">4.</span>
              <span>Drag the red marker to fine-tune your position</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">5.</span>
              <span>Click "Save Location" to store the selected coordinates</span>
            </li>
          </ul>
        </div>

        {/* Code Example */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-3">Component Usage:</h3>
          <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm">
            <code className="text-green-400">{`import { VolunteerLocationPicker } from '@/components/VolunteerLocationPicker';

function MyComponent() {
  const handleLocationSelect = (lat, lng, address) => {
    console.log('Location:', { lat, lng, address });
    // Save to Firebase or state
  };

  return (
    <VolunteerLocationPicker
      onLocationSelect={handleLocationSelect}
      initialLocation={{ lat: 13.0827, lng: 80.2707 }}
    />
  );
}`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
