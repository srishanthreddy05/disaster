'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/app/dashboard/layout-base';
import { VolunteerRescueMap } from '@/components/VolunteerRescueMap';

export default function VolunteerDashboard() {
  const { user, role } = useAuth();

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

          <div className="space-y-3">
            <h3 className="text-2xl font-bold">Live Rescue Coordination</h3>
            <p className="text-sm text-gray-400">
              Real-time user status tracking with distance and ETA estimates.
            </p>
          </div>

          <VolunteerRescueMap
            user={user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
