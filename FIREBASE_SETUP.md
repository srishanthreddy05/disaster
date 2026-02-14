# Firebase Authentication Setup Guide

This guide explains how to set up Firebase authentication for the Disaster Response Platform.

## Prerequisites

- Firebase Project (create at https://console.firebase.google.com)
- Google OAuth 2.0 credentials configured
- Node.js 18+ installed

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Enter a project name (e.g., "Disaster-Response")
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Firebase Services

### Authentication
1. In Firebase Console, go to **Build > Authentication**
2. Click **Get started**
3. Select **Google** as the sign-in provider
4. Enable it and add your support email
5. Click **Save**

### Realtime Database
1. In Firebase Console, go to **Build > Realtime Database**
2. Click **Create Database**
3. Choose **Start in test mode** (for development)
4. Select preferred region
5. Click **Enable**
6. The database will be created with URL like: `https://your-project.firebaseio.com`

## Step 3: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click the Web app icon (`</>`)
4. Register app (give it a name)
5. Copy the Firebase config

## Step 4: Update Environment Variables

Create/update `.env.local` in your project root with the config from Step 3:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
```

## Step 5: Configure Realtime Database Rules

Set up database security rules to allow authenticated users:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "volunteers": {
      ".read": true,
      ".write": false
    },
    "admins": {
      ".read": true,
      ".write": false
    }
  }
}
```

In Firebase Console:
1. Go to **Realtime Database > Rules**
2. Replace the default rules with the above
3. Click **Publish**

## Step 6: Create Test Data (Optional)

### Create a Volunteer (in Firebase Console):

1. Go to **Realtime Database**
2. Click the **+** next to `volunteers`
3. Add new child:
   - Key: `your-user-uid` (get from authentication tab)
   - Value: `true`

### Create an Admin (in Firebase Console):

1. Go to **Realtime Database**
2. Click the **+** next to `admins`
3. Add new child:
   - Key: `your-user-uid`
   - Value: `true`

## Step 7: Run the Application

```bash
npm install
npm run dev
```

Visit http://localhost:3000 and test the login flow.

## Role-Based Access Flow

1. **User clicks "Sign In with Google"** on any dashboard link
2. **Redirected to /login** → Google Sign-In popup appears
3. **User authenticates** with Google account
4. **System checks role in Realtime Database**:
   - If UID in `admins/{uid}` → redirects to `/dashboard/admin`
   - Else if UID in `volunteers/{uid}` → redirects to `/dashboard/volunteer`
   - Else → creates entry in `users/{uid}` and redirects to `/dashboard/user`
5. **Loading spinner** shown while checking role
6. **Protected routes** restrict access based on role

## File Structure

```
lib/
  firebase.ts          # Firebase initialization
  types.ts             # TypeScript types

context/
  AuthContext.tsx      # Authentication context with role logic

hooks/
  useAuth.ts          # useAuth hook

components/
  LoginButton.tsx     # Google Sign-In button
  ProtectedRoute.tsx  # Route protection wrapper

app/
  login/
    page.tsx          # Login page
  dashboard/
    layout-base.tsx   # Shared dashboard layout
    user/
      page.tsx        # User dashboard
    volunteer/
      page.tsx        # Volunteer dashboard
    admin/
      page.tsx        # Admin dashboard
  unauthorized/
    page.tsx          # Unauthorized access page
```

## Important Security Notes

⚠️ **Frontend role assignment is DISABLED**
- Admin and Volunteer roles must be manually set in Firebase Realtime Database
- Users can only be created as regular "users" - they cannot assign themselves admin/volunteer roles
- Only the admin with database write access can promote users to volunteer/admin status

## Troubleshooting

### "Firebase config error"
- Check .env.local variables match exactly
- Ensure NEXT_PUBLIC_ prefix on all environment variables

### "Sign-in popup blocked"
- Some browsers block popups - check browser settings
- Ensure domain is whitelisted in Firebase OAuth settings

### "User created but can't access dashboard"
- Check role detection logic in AuthContext
- Verify database structure matches code (users/, volunteers/, admins/)

### "Role not updating"
- Database rules might be blocking reads
- Check Firebase Realtime Database rules are published

## Next Steps

- Hook up incident reporting functionality
- Connect live map with real incident data
- Implement volunteer coordination features
- Add AI incident verification
