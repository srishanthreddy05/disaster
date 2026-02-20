'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/app/dashboard/layout-base';
import { VolunteerRescueMap } from '@/components/VolunteerRescueMap';
import { ref, push, set, onValue, query, orderByChild, equalTo } from 'firebase/database';
import { database } from '@/lib/firebase';
import { AlertCircle, Send, CheckCircle, Clock } from 'lucide-react';
import type { VolunteerAlert } from '@/lib/types';

export default function VolunteerDashboard() {
  const { user, role } = useAuth();
  const [alertMessage, setAlertMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [myAlerts, setMyAlerts] = useState<VolunteerAlert[]>([]);

  // Listen to volunteer's own alerts
  useEffect(() => {
    if (!user?.uid) return;

    const alertsRef = ref(database, 'volunteer_alerts');
    const myAlertsQuery = query(alertsRef, orderByChild('volunteerId'), equalTo(user.uid));

    const unsubscribe = onValue(myAlertsQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMyAlerts([]);
        return;
      }

      const alerts: VolunteerAlert[] = Object.entries(data).map(([id, alert]: [string, any]) => ({
        id,
        ...alert,
      }));

      // Sort by createdAt descending (newest first)
      alerts.sort((a, b) => b.createdAt - a.createdAt);
      setMyAlerts(alerts);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSubmitAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !alertMessage.trim()) return;

    setSubmitting(true);
    try {
      const alertsRef = ref(database, 'volunteer_alerts');
      const newAlertRef = push(alertsRef);

      await set(newAlertRef, {
        volunteerId: user.uid,
        volunteerName: user.displayName || 'Unknown Volunteer',
        message: alertMessage.trim(),
        status: 'pending',
        acknowledgedBy: null,
        acknowledgedAt: null,
        createdAt: Date.now(),
      });

      setAlertMessage('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (error) {
      console.error('Error submitting alert:', error);
    } finally {
      setSubmitting(false);
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

          {/* Alert to Admin Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-yellow-400" size={24} />
              <h3 className="text-xl font-bold">Send Alert to Admin</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Report urgent issues or request admin assistance
            </p>
            
            <form onSubmit={handleSubmitAlert} className="space-y-4">
              <textarea
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="Describe the situation or issue that needs admin attention..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 min-h-[120px] focus:outline-none focus:border-yellow-500"
                required
              />
              
              <button
                type="submit"
                disabled={submitting || !alertMessage.trim()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                <Send size={18} />
                {submitting ? 'Sending...' : 'Send Alert to Admin'}
              </button>
              
              {submitSuccess && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle size={16} />
                  Alert sent successfully!
                </div>
              )}
            </form>
          </div>

          {/* My Alerts Status */}
          {myAlerts.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4">My Alert Status</h3>
              <div className="space-y-3">
                {myAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${
                      alert.status === 'acknowledged'
                        ? 'bg-green-900/20 border-green-700'
                        : 'bg-yellow-900/20 border-yellow-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm text-gray-300 mb-2">{alert.message}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {alert.status === 'acknowledged' ? (
                          <>
                            <CheckCircle size={16} className="text-green-400" />
                            <span className="text-xs text-green-400 font-semibold">Acknowledged</span>
                          </>
                        ) : (
                          <>
                            <Clock size={16} className="text-yellow-400" />
                            <span className="text-xs text-yellow-400 font-semibold">Pending</span>
                          </>
                        )}
                      </div>
                    </div>
                    {alert.status === 'acknowledged' && alert.acknowledgedAt && (
                      <p className="text-xs text-green-500 mt-2">
                        Acknowledged {new Date(alert.acknowledgedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
