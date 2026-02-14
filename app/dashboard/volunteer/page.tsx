'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { Users, AlertCircle, MapPin, Zap, CheckCircle, Loader2 } from 'lucide-react';
import DashboardLayout from '@/app/dashboard/layout-base';
import { ref, set, get } from 'firebase/database';
import { database } from '@/lib/firebase';

export default function VolunteerDashboard() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [volunteerStatus, setVolunteerStatus] = useState<'available' | 'on_mission' | null>(null);

  // Load current volunteer status
  useEffect(() => {
    const loadVolunteerStatus = async () => {
      if (!user) return;

      try {
        const statusRef = ref(database, `volunteer_status/${user.uid}`);
        const snapshot = await get(statusRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          setVolunteerStatus(data.status);
        }
      } catch (error) {
        console.error('Error loading volunteer status:', error);
      }
    };

    loadVolunteerStatus();
  }, [user]);

  const saveVolunteerStatus = async (status: 'available' | 'on_mission') => {
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      // Get volunteer's current location
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
      const statusRef = ref(database, `volunteer_status/${user.uid}`);
      const statusData = {
        uid: user.uid,
        name: user.displayName || 'Unknown Volunteer',
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
      setVolunteerStatus(status);

      setMessage({
        type: 'success',
        text: status === 'available' 
          ? '✓ Status updated: You are now AVAILABLE for rescue missions' 
          : '✓ Status updated: Currently ON MISSION',
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
    <ProtectedRoute requiredRole="volunteer">
      <DashboardLayout volunteerPage>
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
                    Welcome, {user?.displayName || 'Volunteer'}!
                  </h2>
                  <p className="text-gray-400 mt-2">{user?.email}</p>
                  <p className="text-yellow-500 font-semibold mt-2">
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

          {/* Volunteer Status Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Available for Response */}
            <button
              onClick={() => saveVolunteerStatus('available')}
              disabled={loading}
              className={`${
                volunteerStatus === 'available' 
                  ? 'bg-green-800 border-green-600' 
                  : 'bg-green-900 border-green-700'
              } border rounded-xl p-6 hover:border-green-500 transition duration-300 transform hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-left`}
            >
              <div className="flex items-center justify-between mb-4">
                <CheckCircle size={32} className="text-green-400" />
                {loading && <Loader2 size={24} className="animate-spin text-green-400" />}
              </div>
              <h3 className="text-2xl font-bold mb-2">
                Available for Response
                {volunteerStatus === 'available' && ' ✓'}
              </h3>
              <p className="text-green-200">
                Mark yourself as available to respond to emergencies in your area.
              </p>
            </button>

            {/* On Mission */}
            <button
              onClick={() => saveVolunteerStatus('on_mission')}
              disabled={loading}
              className={`${
                volunteerStatus === 'on_mission' 
                  ? 'bg-orange-800 border-orange-600' 
                  : 'bg-orange-900 border-orange-700'
              } border rounded-xl p-6 hover:border-orange-500 transition duration-300 transform hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-left`}
            >
              <div className="flex items-center justify-between mb-4">
                <AlertCircle size={32} className="text-orange-400" />
                {loading && <Loader2 size={24} className="animate-spin text-orange-400" />}
              </div>
              <h3 className="text-2xl font-bold mb-2">
                On Mission
                {volunteerStatus === 'on_mission' && ' ✓'}
              </h3>
              <p className="text-orange-200">
                Update status to show you're currently on a rescue mission.
              </p>
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-yellow-900 border border-yellow-700 rounded-xl p-6">
              <div className="text-3xl font-bold text-yellow-400 mb-2">0</div>
              <p className="text-yellow-200">Active Emergencies</p>
            </div>
            <div className="bg-red-900 border border-red-700 rounded-xl p-6">
              <div className="text-3xl font-bold text-red-400 mb-2">0</div>
              <p className="text-red-200">Assisted People</p>
            </div>
            <div className="bg-green-900 border border-green-700 rounded-xl p-6">
              <div className="text-3xl font-bold text-green-400 mb-2">0</div>
              <p className="text-green-200">Missions Completed</p>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* View Active Incidents */}
            <div className="bg-red-900 border border-red-700 rounded-xl p-6 hover:border-red-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <AlertCircle size={32} className="text-red-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Active Incidents</h3>
              <p className="text-red-200">
                View and respond to current emergency situations in your area.
              </p>
            </div>

            {/* Coordinate Response */}
            <div className="bg-blue-900 border border-blue-700 rounded-xl p-6 hover:border-blue-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <Users size={32} className="text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Team Coordination</h3>
              <p className="text-blue-200">
                Coordinate with other volunteers and track team locations.
              </p>
            </div>

            {/* Map View */}
            <div className="bg-green-900 border border-green-700 rounded-xl p-6 hover:border-green-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <MapPin size={32} className="text-green-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Live Map</h3>
              <p className="text-green-200">
                Track incidents, resources, and volunteer locations in real-time.
              </p>
            </div>

            {/* Resources */}
            <div className="bg-purple-900 border border-purple-700 rounded-xl p-6 hover:border-purple-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <Zap size={32} className="text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Resources</h3>
              <p className="text-purple-200">
                Access tools, guidelines, and support materials for volunteers.
              </p>
            </div>
          </div>

          {/* Recent Missions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-6">Recent Activity</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg border-l-4 border-yellow-500">
                <p className="font-semibold">Volunteer Account Activated</p>
                <p className="text-gray-400 text-sm">
                  Ready to respond to emergencies in your area
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
