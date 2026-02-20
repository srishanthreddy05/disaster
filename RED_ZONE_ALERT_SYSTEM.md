# Red Zone Alert System

## Overview

A real-time geofencing solution that monitors users' locations against admin-defined red zones and triggers emergency alerts when users enter dangerous areas.

## How It Works

### 1. **Real-Time Monitoring**
- Listens to user's current location from `user_status/{uid}/location`
- Listens to all zones from `zones/`
- Monitors both updates in real-time using Firebase listeners

### 2. **Point-in-Polygon Detection**
- Uses ray-casting algorithm to determine if user is inside a polygon
- Calculates efficiently: O(n) where n = number of polygon vertices
- Triggers immediately when user enters/exits zone

### 3. **Red Zone Alert Trigger**
When a zone type becomes "red" AND user is inside:
- ✅ Alarm sound starts (loops from `/public/alarm.mp3`)
- ✅ Red emergency banner appears at top
- ✅ Modal popup shows danger warning
- ✅ "Acknowledge Alert" button to stop alarm

### 4. **User Acknowledgement**
- User clicks "Acknowledge Alert"
- Alarm stops immediately
- Banner and modal disappear
- Alert won't re-trigger unless user exits and re-enters zone

---

## Component: RedZoneAlertSystem

**Location:** `components/RedZoneAlertSystem.tsx`

### Props
None - component is self-contained and uses `useAuth()` hook internally.

### Exports
```tsx
export function RedZoneAlertSystem()
```

### Usage

Add to user dashboard (already integrated in `app/dashboard/user/page.tsx`):

```tsx
import { RedZoneAlertSystem } from '@/components/RedZoneAlertSystem';

export default function UserDashboard() {
  return (
    <ProtectedRoute requiredRole="user">
      <DashboardLayout userPage>
        <RedZoneAlertSystem />
        {/* Rest of dashboard */}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
```

---

## Setup Requirements

### 1. Audio File
Place alarm sound at: `public/alarm.mp3`

- Format: MP3, WAV, or OGG
- Duration: 3-5 seconds (will loop)
- Volume: Clear, attention-grabbing

### 2. Firebase Structure

**User Status:**
```json
/user_status/{uid}
{
  "uid": "user123",
  "name": "John Doe",
  "email": "john@example.com",
  "location": {
    "latitude": 13.0843,
    "longitude": 80.2705
  },
  "status": "safe",
  "timestamp": 1708396800000,
  "updatedAt": "2026-02-20T10:30:00Z"
}
```

**Zones:**
```json
/zones/{zoneId}
{
  "type": "red",
  "coordinates": [
    { "lat": 13.083, "lng": 80.270 },
    { "lat": 13.085, "lng": 80.270 },
    { "lat": 13.085, "lng": 80.272 },
    { "lat": 13.083, "lng": 80.272 }
  ],
  "createdAt": 1708396800000
}
```

### 3. Environment Variables
Ensure `.env.local` has Firebase config:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

---

## Algorithm Details

### Point-in-Polygon (Ray Casting)

Determines if a point (latitude, longitude) is inside a polygon:

```
1. Cast a ray from the point to infinity (rightward along longitude axis)
2. Count how many polygon edges the ray crosses
3. If odd → point is inside
4. If even → point is outside
```

**Complexity:** O(n) where n = polygon vertices

**Example:**
```
Zone coordinates: [(13.0, 80.0), (13.5, 80.0), (13.5, 80.5), (13.0, 80.5)]
User location: (13.2, 80.2)
Result: Inside → Alert triggers
```

---

## Real-Time Flow

```
1. Admin changes zone type to "red" in database
   ↓
2. Component listens to zones/{zoneId} change
   ↓
3. Component fetches user location from user_status/{uid}
   ↓
4. Point-in-polygon check:
   - Is user inside this red zone?
   ↓
5. If YES:
   - Set alertActive = true
   - Start audio playback
   - Show banner + modal
   ↓
6. User clicks "Acknowledge Alert"
   - Stop audio
   - Hide UI
   - Set alertActive = false
   ↓
7. If user exits zone → alert auto-clears
   (user can re-enter and alert will trigger again)
```

---

## State Management

| State | Type | Purpose |
|-------|------|---------|
| `alertActive` | boolean | Is alert currently showing |
| `userLocation` | UserLocation | Current user lat/lng |
| `redZones` | Zone[] | All red zones in system |
| `userInRedZone` | boolean | Is user inside a red zone |

---

## Lifecycle & Cleanup

### Component Mount
- ✅ Initialize audio element
- ✅ Set up Firebase listeners
- ✅ Start real-time monitoring

### Component Unmount
- ✅ Cleanup Firebase unsubscribes
- ✅ Pause audio playback
- ✅ Clear all refs to prevent memory leaks

---

## Edge Cases Handled

1. **User location unavailable**
   - Alert doesn't trigger
   - Listeners keep waiting for location update

2. **No zones defined**
   - Alert doesn't trigger
   - Waits for zones to be created

3. **User exits red zone**
   - Alert auto-dismisses
   - `setAlertActive = false`

4. **Audio file missing**
   - Caught in try-catch
   - Error logged to console
   - Alert still shows (just no sound)

5. **Multiple zones**
   - Checks all red zones
   - Triggers if user in ANY red zone

6. **Zone type changes**
   - Automatically detects change
   - Triggers alert only on change, not continuously

---

## Security & Privacy

✅ **No device geolocation used** - only Firebase database location
✅ **No location tracking without user status update** - relies on existing user-reported location
✅ **Respects user authentication** - component requires valid user session
✅ **Real-time only** - no storage of alert history

---

## Performance Optimization

- **Ray-casting algorithm:** O(n) - extremely fast
- **Firebase listeners:** Indexed paths, real-time updates
- **Audio preload:** `preload="auto"` set on audio element
- **No re-renders on every coord check:** Batched via React state

---

## Troubleshooting

### Alarm not playing
- Check `/public/alarm.mp3` exists and is valid
- Check browser console for audio errors
- Verify audio permissions granted
- Try different audio format (WAV, OGG)

### Alert not triggering
- Verify user location saved in `user_status/{uid}/location`
- Verify zone type is exactly "red" (case-sensitive)
- Check zone has valid coordinates array (minimum 3 points)
- Verify coordinates are valid lat/lng (±90°, ±180°)

### Alert triggering incorrectly
- Verify polygon coordinates are in correct order
- Check for self-intersecting polygons (use admin UI to draw correctly)
- Verify point-in-polygon logic with known test case

### Memory leaks
- Check browser DevTools → Memory tab
- Listeners should unsubscribe on unmount
- Audio element should pause on cleanup

---

## Testing

Test with mock zones and locations:

```tsx
// Manually add test zone to Firebase
/zones/test-zone
{
  "type": "red",
  "coordinates": [
    { "lat": 13.0, "lng": 80.0 },
    { "lat": 13.1, "lng": 80.0 },
    { "lat": 13.1, "lng": 80.1 },
    { "lat": 13.0, "lng": 80.1 }
  ]
}

// Update user location to be inside
/user_status/user123/location
{
  "latitude": 13.05,
  "longitude": 80.05
}

// Should:
// 1. Alarm plays
// 2. Red banner appears
// 3. Modal shows
// 4. Click acknowledge → all clears
```

---

## Future Enhancements

- [ ] Multiple alert levels (yellow/orange zones)
- [ ] Custom alert sounds per zone type
- [ ] SMS/push notification integration
- [ ] Alert history/logging
- [ ] Zone-specific warning messages
- [ ] Estimated time inside zone
- [ ] Admin dashboard for real-time alert monitoring

---

## Files Modified

- ✅ `components/RedZoneAlertSystem.tsx` - New component
- ✅ `app/dashboard/user/page.tsx` - Added component import and usage

---

## References

- **Point-in-Polygon Algorithm:** Ray Casting Method
- **Audio API:** HTML5 Audio Element
- **Real-Time Updates:** Firebase Realtime Database (`onValue`, `ref`)
