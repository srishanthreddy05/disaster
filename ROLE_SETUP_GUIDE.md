# How to Set User Roles in Firebase

## Important: Roles Must Be Set BEFORE First Login

The authentication system checks your role in Firebase Realtime Database. If your UID is not found in `volunteers/` or `admins/`, you will be created as a regular user.

---

## Step 1: Get Your Firebase UID

1. Go to the login page: http://localhost:3000/login
2. Click "Sign In with Google"
3. After logging in, you'll see a yellow box displaying your **Firebase UID**
4. **Copy this UID** (it looks like: `xYz123AbC456...`)

---

## Step 2: Set Your Role in Firebase Console

### Open Firebase Console:
1. Go to https://console.firebase.google.com
2. Select your project: **disaster2k26**
3. Go to **Build** → **Realtime Database**

### Add Volunteer Role:
1. Click the **+** button next to the root
2. For **Name**, enter: `volunteers`
3. For **Value**, leave it empty (will add child)
4. Click **Add**
5. Now click the **+** next to `volunteers`
6. For **Name**, paste your **UID** (from Step 1)
7. For **Value**, enter: `true`
8. Click **Add**

### Add Admin Role:
1. Click the **+** button next to the root
2. For **Name**, enter: `admins`
3. For **Value**, leave it empty
4. Click **Add**
5. Click the **+** next to `admins`
6. For **Name**, paste your **UID**
7. For **Value**, enter: `true`
8. Click **Add**

---

## Step 3: Logout and Login Again

1. Go back to the app and logout
2. Clear your browser cache (optional but recommended)
3. Login again with Google
4. You should now be redirected to the correct dashboard:
   - **Admin** → `/dashboard/admin`
   - **Volunteer** → `/dashboard/volunteer`
   - **User** → `/dashboard/user`

---

## Firebase Database Structure (Example)

```
disaster2k26/
  ├── admins/
  │   └── abc123xyz456uid/
  │       ├── uid: "abc123xyz456uid"
  │       ├── name: "Admin Name"
  │       ├── email: "admin@example.com"
  │       ├── photoURL: "..."
  │       └── createdAt: 1707926400000
  │
  ├── volunteers/
  │   └── def789uvw012uid/
  │       ├── uid: "def789uvw012uid"
  │       ├── name: "Volunteer Name"
  │       ├── email: "volunteer@example.com"
  │       ├── photoURL: "..."
  │       └── createdAt: 1707926400000
  │
  ├── users/
  │   └── ghi345rst678uid/
  │       ├── uid: "ghi345rst678uid"
  │       ├── name: "User Name"
  │       ├── email: "user@example.com"
  │       ├── photoURL: "..."
  │       └── createdAt: 1707926400000
  │
  ├── volunteer_status/
  │   └── def789uvw012uid/
  │       ├── uid: "def789uvw012uid"
  │       ├── status: "available"
  │       ├── location: { latitude: 13.0827, longitude: 80.2707 }
  │       └── timestamp: 1707926400000
  │
  └── user_status/
      └── ghi345rst678uid/
          ├── uid: "ghi345rst678uid"
          ├── status: "safe"
          ├── location: { latitude: 13.0827, longitude: 80.2707 }
          └── timestamp: 1707926400000
```

---

## Quick Setup (Firebase Console)

### Method 1: Manual Entry (Recommended for Single User)
Follow Step 2 above

### Method 2: Import JSON (For Multiple Users)
1. In Firebase Console → Realtime Database
2. Click the **⋮** (three dots menu)
3. Select **Import JSON**
4. Paste this template (replace UIDs):

```json
{
  "admins": {
    "YOUR_ADMIN_UID_HERE": true
  },
  "volunteers": {
    "YOUR_VOLUNTEER_UID_1": true,
    "YOUR_VOLUNTEER_UID_2": true
  }
}
```

5. Click **Import**

---

## Troubleshooting

### "I'm still being created as a user"
- ✅ Check that your UID is exactly correct in Firebase
- ✅ Make sure you added it under `volunteers/` or `admins/`
- ✅ Logout completely and login again
- ✅ Clear browser cache and cookies

### "I can't see my UID"
- Make sure you're logged in
- Refresh the /login page
- Check browser console for errors

### "Role not updating"
- The role is checked on every login
- If you change your role in Firebase, you must logout and login again
- Clear browser cache if needed

---

## Security Note

⚠️ **Important:** Only database administrators should have access to the Firebase Console. Regular users cannot change their own roles - this prevents unauthorized privilege escalation.
