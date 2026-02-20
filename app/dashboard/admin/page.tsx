'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart3,
  Users,
  AlertCircle,
  Settings,
  FileText,
  Bell,
  CheckCircle,
  Clock,
} from 'lucide-react';
import DashboardLayout from '@/app/dashboard/layout-base';
import { ref, onValue, update } from 'firebase/database';
import { database } from '@/lib/firebase';
import type { VolunteerAlert } from '@/lib/types';

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const [volunteerAlerts, setVolunteerAlerts] = useState<VolunteerAlert[]>([]);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  // Listen to all volunteer alerts
  useEffect(() => {
    const alertsRef = ref(database, 'volunteer_alerts');

    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setVolunteerAlerts([]);
        return;
      }

      const alerts: VolunteerAlert[] = Object.entries(data).map(([id, alert]: [string, any]) => ({
        id,
        ...alert,
      }));

      // Sort by status (pending first) then by createdAt descending
      alerts.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'pending' ? -1 : 1;
        }
        return b.createdAt - a.createdAt;
      });

      setVolunteerAlerts(alerts);
    });

    return () => unsubscribe();
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    if (!user?.uid) return;

    setAcknowledging(alertId);
    try {
      const alertRef = ref(database, `volunteer_alerts/${alertId}`);
      await update(alertRef, {
        status: 'acknowledged',
        acknowledgedBy: user.uid,
        acknowledgedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    } finally {
      setAcknowledging(null);
    }
  };

  const pendingAlerts = volunteerAlerts.filter((a) => a.status === 'pending');
  const acknowledgedAlerts = volunteerAlerts.filter((a) => a.status === 'acknowledged');

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

          {/* Volunteer Alerts Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bell className="text-yellow-400" size={24} />
                <h3 className="text-2xl font-bold">Volunteer Alerts</h3>
              </div>
              {pendingAlerts.length > 0 && (
                <span className="bg-yellow-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {pendingAlerts.length} Pending
                </span>
              )}
            </div>

            {volunteerAlerts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No volunteer alerts yet</p>
            ) : (
              <div className="space-y-4">
                {/* Pending Alerts */}
                {pendingAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-5 bg-yellow-900/20 border border-yellow-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock size={16} className="text-yellow-400" />
                          <span className="text-xs font-semibold text-yellow-400">PENDING</span>
                        </div>
                        <p className="font-semibold text-gray-100 mb-1">{alert.volunteerName}</p>
                        <p className="text-sm text-gray-300 mb-2">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={acknowledging === alert.id}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {acknowledging === alert.id ? (
                          'Processing...'
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            Acknowledge
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Acknowledged Alerts */}
                {acknowledgedAlerts.length > 0 && (
                  <>
                    {pendingAlerts.length > 0 && (
                      <div className="border-t border-gray-800 my-4 pt-4">
                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Acknowledged</h4>
                      </div>
                    )}
                    {acknowledgedAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="p-5 bg-green-900/10 border border-green-800/50 rounded-lg opacity-75"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle size={16} className="text-green-400" />
                              <span className="text-xs font-semibold text-green-400">ACKNOWLEDGED</span>
                            </div>
                            <p className="font-semibold text-gray-100 mb-1">{alert.volunteerName}</p>
                            <p className="text-sm text-gray-300 mb-2">{alert.message}</p>
                            <p className="text-xs text-gray-500">
                              Submitted: {new Date(alert.createdAt).toLocaleString()}
                            </p>
                            {alert.acknowledgedAt && (
                              <p className="text-xs text-green-500">
                                Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
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
