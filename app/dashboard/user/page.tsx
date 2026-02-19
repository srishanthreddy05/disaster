'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { UserCircle, AlertCircle, MapPin, Heart, CheckCircle, Loader2, Users } from 'lucide-react';
import DashboardLayout from '@/app/dashboard/layout-base';
import { UserLocationMap } from '@/components/UserLocationMap';
import { ref, set } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function UserDashboard() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const saveUserStatus = async (status: 'safe' | 'need_help') => {
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      // Get user's current location
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      });

      // Save to Firebase Realtime Database
      const statusRef = ref(database, `user_status/${user.uid}`);
      const statusData = {
        uid: user.uid,
        name: user.displayName || 'Unknown',
        email: user.email,
        status: status,
        location: {
          latitude: location.lat,
          longitude: location.lng,
        },
        timestamp: Date.now(),
        updatedAt: new Date().toISOString(),
      };

      await set(statusRef, statusData);

      setMessage({
        type: 'success',
        text: status === 'safe' 
          ? '✓ Status updated: You are marked as SAFE' 
          : '✓ Help request sent! Volunteers will be notified.',
      });
    } catch (error: any) {
      console.error('Error saving status:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to update status. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="user">
      <DashboardLayout userPage>
        <div className="space-y-8">
          {/* Welcome Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {user?.photoURL && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={user?.displayName || 'User'}
                    className="w-16 h-16 rounded-full"
                  />
                )}
                <div>
                  <h2 className="text-3xl font-bold">
                    Welcome, {user?.displayName || 'User'}!
                  </h2>
                  <p className="text-gray-400 mt-2">{user?.email}</p>
                  <p className="text-red-500 font-semibold mt-2">
                    Role: <span className="uppercase">{role}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`${
                message.type === 'success'
                  ? 'bg-green-900 border-green-700'
                  : 'bg-red-900 border-red-700'
              } border rounded-xl p-4`}
            >
              <p
                className={`${
                  message.type === 'success' ? 'text-green-200' : 'text-red-200'
                } font-semibold`}
              >
                {message.text}
              </p>
            </div>
          )}

          {/* Quick Actions - Status Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* I'm Safe Button */}
            <button
              onClick={() => saveUserStatus('safe')}
              disabled={loading}
              className="bg-green-900 border border-green-700 rounded-xl p-6 hover:border-green-500 transition duration-300 transform hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <CheckCircle size={32} className="text-green-400" />
                {loading && <Loader2 size={24} className="animate-spin text-green-400" />}
              </div>
              <h3 className="text-2xl font-bold mb-2">I'm Safe</h3>
              <p className="text-green-200">
                Mark yourself as safe and let others know you're okay.
              </p>
            </button>

            {/* Need Help Button */}
            <button
              onClick={() => saveUserStatus('need_help')}
              disabled={loading}
              className="bg-red-900 border border-red-700 rounded-xl p-6 hover:border-red-500 transition duration-300 transform hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <AlertCircle size={32} className="text-red-400" />
                {loading && <Loader2 size={24} className="animate-spin text-red-400" />}
              </div>
              <h3 className="text-2xl font-bold mb-2">Need Help</h3>
              <p className="text-red-200">
                Send an emergency alert to volunteers and rescue teams.
              </p>
            </button>

            {/* Report Missing Person Button */}
            <Link href="/dashboard/user/missing">
              <div className="bg-purple-900 border border-purple-700 rounded-xl p-6 hover:border-purple-500 transition duration-300 transform hover:-translate-y-2 cursor-pointer h-full text-left">
                <div className="flex items-center mb-4">
                  <Users size={32} className="text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Report Missing</h3>
                <p className="text-purple-200">
                  Help find missing persons with photo matching.
                </p>
              </div>
            </Link>
          </div>

          {/* Live Location Map */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <UserLocationMap />
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-6">Your Activity</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg border-l-4 border-red-500">
                <p className="font-semibold">Account Created</p>
                <p className="text-gray-400 text-sm">
                  Welcome to the Disaster Response Platform
                </p>
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="bg-blue-900 border border-blue-700 rounded-xl p-6">
            <div className="flex gap-4">
              <Heart size={24} className="text-blue-400 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-2">How to Use</h4>
                <ul className="text-blue-200 space-y-2 text-sm">
                  <li>• Click "I'm Safe" to let others know you're okay during a disaster</li>
                  <li>• Click "Need Help" to send an emergency alert to volunteers</li>
                  <li>• Enable location services for accurate status tracking</li>
                  <li>• Check the map regularly for near-real-time updates</li>
                  <li>• Your location and status are saved when you update</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
