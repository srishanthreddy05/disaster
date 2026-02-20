# VolunteerLocationPicker Component Usage

## Overview
A production-ready Google Maps location picker component with Places Autocomplete, geolocation detection, and manual selection.

## Features
✅ Google Places Autocomplete search (real-time suggestions)
✅ Detect My Location button (browser geolocation)
✅ Click-to-select on map
✅ Draggable marker
✅ Reverse geocoding for addresses
✅ Dark theme map styling
✅ Responsive design
✅ Error handling
✅ Loading states

## Installation

The component uses `@react-google-maps/api`. Make sure it's installed:

```bash
npm install @react-google-maps/api
```

## Environment Setup

Add to `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**Required Google APIs:**
- Maps JavaScript API
- Places API

Enable these in Google Cloud Console.

## Basic Usage

```tsx
'use client';

import { useState } from 'react';
import { VolunteerLocationPicker } from '@/components/VolunteerLocationPicker';

export default function MyPage() {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);

  const handleLocationSelect = (lat: number, lng: number, address?: string) => {
    setSelectedLocation({ lat, lng, address });
    console.log('Selected:', { lat, lng, address });
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Select Your Location</h1>
      
      <VolunteerLocationPicker
        onLocationSelect={handleLocationSelect}
      />

      {selectedLocation && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h2 className="font-semibold mb-2">Selected Location:</h2>
          <p>Latitude: {selectedLocation.lat}</p>
          <p>Longitude: {selectedLocation.lng}</p>
          {selectedLocation.address && (
            <p>Address: {selectedLocation.address}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Usage with Initial Location

```tsx
<VolunteerLocationPicker
  onLocationSelect={handleLocationSelect}
  initialLocation={{ lat: 13.0827, lng: 80.2707 }}
/>
```

## Usage in a Form

```tsx
'use client';

import { useState } from 'react';
import { VolunteerLocationPicker } from '@/components/VolunteerLocationPicker';

export default function VolunteerRegistrationForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    location: { lat: 0, lng: 0, address: '' },
  });

  const handleLocationSelect = (lat: number, lng: number, address?: string) => {
    setFormData(prev => ({
      ...prev,
      location: { lat, lng, address: address || '' },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting:', formData);
    
    // Save to Firebase
    // await saveVolunteerData(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold mb-2">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-4">Your Location</label>
        <VolunteerLocationPicker
          onLocationSelect={handleLocationSelect}
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg"
      >
        Register as Volunteer
      </button>
    </form>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onLocationSelect` | `(lat: number, lng: number, address?: string) => void` | Yes | Callback fired when location is selected |
| `initialLocation` | `{ lat: number; lng: number }` | No | Initial map center and marker position |

## How It Works

### 1. Search (Autocomplete)
- User types in search box
- Google Places Autocomplete shows real-time suggestions
- On selection:
  - Map centers to location
  - Marker is placed
  - Callback fires with lat, lng, address

### 2. Detect My Location
- Uses `navigator.geolocation`
- Requests high accuracy position
- Reverse geocodes to get address
- Updates map, marker, and fires callback

### 3. Map Click
- User clicks anywhere on map
- Marker moves to clicked position
- Reverse geocodes to get address
- Fires callback with coordinates

### 4. Marker Drag
- Marker is draggable
- On drag end:
  - Position updates
  - Reverse geocodes
  - Fires callback

## Error Handling

The component handles:
- ❌ Geolocation permission denied
- ❌ Location unavailable
- ❌ Request timeout
- ❌ Google Maps API load failure
- ❌ No search results

## Styling

The component uses:
- Tailwind CSS for styling
- Dark theme (customizable)
- Responsive design (mobile-first)
- Lucide React icons

## Map Customization

To change map style, edit the `styles` array in the `GoogleMap` options:

```tsx
styles: [
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{ color: '#242f3e' }],
  },
  // Add more styles...
]
```

## Notes

- Component is fully client-side (`'use client'`)
- Works with Next.js 13+ App Router
- Requires Google Maps API key with Places API enabled
- India-specific autocomplete (change `componentRestrictions` for other countries)
- Default center: Chennai (13.0827, 80.2707)

## Troubleshooting

### "Failed to load Google Maps"
- ✅ Check API key is in `.env.local`
- ✅ Variable is named `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- ✅ API key has Maps JavaScript API enabled
- ✅ API key has Places API enabled

### "Location access denied"
- User must grant location permission
- Works only on HTTPS (or localhost)

### Autocomplete not working
- Check Places API is enabled in Google Cloud Console
- Verify API key has proper restrictions
