'use client';

import React, { createContext, ReactNode, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import { ref, get, set, getDatabase } from 'firebase/database';
import { auth, googleProvider, database } from '@/lib/firebase';
import { AuthContextType, UserRole, UserData } from '@/lib/types';

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check the user's role in the Realtime Database
   * Priority: admin > volunteer > user
   */
  const checkUserRole = async (uid: string): Promise<UserRole> => {
    try {
      // Check if admin
      const adminRef = ref(database, `admins/${uid}`);
      const adminSnapshot = await get(adminRef);
      if (adminSnapshot.exists()) {
        return 'admin';
      }

      // Check if volunteer
      const volunteerRef = ref(database, `volunteers/${uid}`);
      const volunteerSnapshot = await get(volunteerRef);
      if (volunteerSnapshot.exists()) {
        return 'volunteer';
      }

      // Default: user (but create entry if doesn't exist)
      return 'user';
    } catch (err) {
      console.error('Error checking user role:', err);
      throw err;
    }
  };

  /**
   * Create or update user entry in database based on role
   */
  const createOrUpdateUserEntry = async (
    uid: string,
    role: UserRole,
    userData: { name: string; email: string; photoURL: string }
  ): Promise<void> => {
    try {
      const userPayload: UserData = {
        uid,
        name: userData.name,
        email: userData.email,
        photoURL: userData.photoURL,
        createdAt: Date.now(),
      };

      // Determine which path to use based on role
      let dbPath = '';
      if (role === 'admin') {
        dbPath = `admins/${uid}`;
      } else if (role === 'volunteer') {
        dbPath = `volunteers/${uid}`;
      } else {
        dbPath = `users/${uid}`;
      }

      const userRef = ref(database, dbPath);
      const userSnapshot = await get(userRef);

      // If entry doesn't exist or exists as boolean, create/update with full data
      if (!userSnapshot.exists() || typeof userSnapshot.val() === 'boolean') {
        await set(userRef, userPayload);
      } else {
        // Update existing entry with latest info
        const existingData = userSnapshot.val();
        await set(userRef, {
          ...existingData,
          name: userData.name,
          email: userData.email,
          photoURL: userData.photoURL,
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('Error creating/updating user entry:', err);
      throw err;
    }
  };

  /**
   * Handle Google Sign-In with role selection
   */
  const login = async (selectedRole?: UserRole): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // If role is provided, use it; otherwise check database
      let userRole: UserRole;
      
      if (selectedRole) {
        // User selected a role - create account with that role
        userRole = selectedRole;
      } else {
        // No role selected - check existing role in database
        userRole = await checkUserRole(user.uid);
      }

      // Create or update entry in database based on role
      await createOrUpdateUserEntry(user.uid, userRole, {
        name: user.displayName || 'Unknown',
        email: user.email || '',
        photoURL: user.photoURL || '',
      });

      setUser(user);
      setRole(userRole);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle Sign-Out
   */
  const logout = async (): Promise<void> => {
    try {
      setError(null);
      setLoading(true);
      await signOut(auth);
      setUser(null);
      setRole(null);
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message || 'Failed to sign out');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Listen for auth state changes
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      try {
        setLoading(true);
        setError(null);

        if (authUser) {
          const userRole = await checkUserRole(authUser.uid);

          // Create or update entry in database based on role
          await createOrUpdateUserEntry(authUser.uid, userRole, {
            name: authUser.displayName || 'Unknown',
            email: authUser.email || '',
            photoURL: authUser.photoURL || '',
          });

          setUser(authUser);
          setRole(userRole);
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err: any) {
        console.error('Auth state change error:', err);
        setError(err.message || 'Auth error');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    role,
    loading,
    error,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
