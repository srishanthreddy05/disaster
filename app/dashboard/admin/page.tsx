'use client';

import React from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart3,
  Users,
  AlertCircle,
  Settings,
  FileText,
} from 'lucide-react';
import DashboardLayout from '@/app/dashboard/layout-base';

export default function AdminDashboard() {
  const { user, role } = useAuth();

  return (
    <ProtectedRoute requiredRole="admin">
      <DashboardLayout adminPage>
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
                    Admin Panel - {user?.displayName || 'Administrator'}
                  </h2>
                  <p className="text-gray-400 mt-2">{user?.email}</p>
                  <p className="text-green-500 font-semibold mt-2">
                    Role: <span className="uppercase">{role}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* System Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-green-900 border border-green-700 rounded-xl p-6">
              <div className="text-3xl font-bold text-green-400 mb-2">0</div>
              <p className="text-green-200">Active Incidents</p>
            </div>
            <div className="bg-purple-900 border border-purple-700 rounded-xl p-6">
              <div className="text-3xl font-bold text-purple-400 mb-2">0</div>
              <p className="text-purple-200">Registered Users</p>
            </div>
            <div className="bg-yellow-900 border border-yellow-700 rounded-xl p-6">
              <div className="text-3xl font-bold text-yellow-400 mb-2">0</div>
              <p className="text-yellow-200">Active Volunteers</p>
            </div>
            <div className="bg-blue-900 border border-blue-700 rounded-xl p-6">
              <div className="text-3xl font-bold text-blue-400 mb-2">0</div>
              <p className="text-blue-200">Responses Coordinated</p>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Overview */}
            <div className="bg-green-900 border border-green-700 rounded-xl p-6 hover:border-green-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <BarChart3 size={32} className="text-green-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">System Overview</h3>
              <p className="text-green-200">
                View comprehensive analytics and system performance metrics.
              </p>
            </div>

            {/* User Management */}
            <div className="bg-purple-900 border border-purple-700 rounded-xl p-6 hover:border-purple-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <Users size={32} className="text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">User Management</h3>
              <p className="text-purple-200">
                Manage users, volunteers, roles, and access permissions.
              </p>
            </div>

            {/* Incident Management */}
            <div className="bg-red-900 border border-red-700 rounded-xl p-6 hover:border-red-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <AlertCircle size={32} className="text-red-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Incident Management</h3>
              <p className="text-red-200">
                Review, verify, and coordinate disaster response operations.
              </p>
            </div>

            {/* Reports */}
            <div className="bg-blue-900 border border-blue-700 rounded-xl p-6 hover:border-blue-500 transition duration-300 cursor-pointer transform hover:-translate-y-2">
              <FileText size={32} className="text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Reports</h3>
              <p className="text-blue-200">
                Generate and view detailed reports and historical data.
              </p>
            </div>
          </div>

          {/* System Settings */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition duration-300 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Settings size={32} className="text-gray-400" />
                <div>
                  <h3 className="text-2xl font-bold">System Settings</h3>
                  <p className="text-gray-400">Configure platform settings and integrations</p>
                </div>
              </div>
              <div className="text-gray-600">→</div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-6">Recent Activity</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg border-l-4 border-green-500">
                <p className="font-semibold">Admin Account Created</p>
                <p className="text-gray-400 text-sm">
                  Administrator access granted
                </p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
