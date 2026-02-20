'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getDatabase, onValue, ref } from 'firebase/database';
import app from '@/lib/firebase';

const formatTimestamp = (value: unknown) => {
  if (!value) return '—';
  if (typeof value === 'number') return new Date(value).toLocaleString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
  }
  return '—';
};

const asList = <T extends Record<string, any>>(data: Record<string, T> | null) => {
  if (!data) return [] as Array<T & { id: string }>;
  return Object.entries(data).map(([id, value]) => ({ id, ...value }));
};

const SectionShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
    <h2 className="text-xl font-bold mb-4">{title}</h2>
    {children}
  </section>
);

const EmptyState = ({ text }: { text: string }) => (
  <p className="text-sm text-gray-400">{text}</p>
);

const StatCard = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
    <div className="text-2xl font-bold text-gray-100 mb-1">{value}</div>
    <div className="text-sm text-gray-400">{label}</div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const classes =
    status === 'safe'
      ? 'bg-green-900/40 text-green-300 border-green-700'
      : status === 'assigned'
      ? 'bg-blue-900/40 text-blue-300 border-blue-700'
      : 'bg-red-900/40 text-red-300 border-red-700';

  return <span className={`text-xs px-2 py-1 rounded-full border ${classes}`}>{status}</span>;
};

export default function OperationsCenterPage() {
  const db = useMemo(() => getDatabase(app), []);

  const [mapPoints, setMapPoints] = useState<any[]>([]);
  const [missingPersons, setMissingPersons] = useState<any[]>([]);
  const [userStatus, setUserStatus] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [volunteerAlerts, setVolunteerAlerts] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);

  const [loading, setLoading] = useState({
    mapPoints: true,
    missingPersons: true,
    userStatus: true,
    users: true,
    volunteerAlerts: true,
    volunteers: true,
    zones: true,
  });

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    const attach = (
      path: string,
      setter: React.Dispatch<React.SetStateAction<any[]>>,
      key: keyof typeof loading
    ) => {
      const nodeRef = ref(db, path);
      const unsubscribe = onValue(nodeRef, (snapshot) => {
        setter(asList(snapshot.val()));
        setLoading((prev) => ({ ...prev, [key]: false }));
      });
      unsubscribers.push(unsubscribe);
    };

    attach('mapPoints', setMapPoints, 'mapPoints');
    attach('missing_persons', setMissingPersons, 'missingPersons');
    attach('user_status', setUserStatus, 'userStatus');
    attach('users', setUsers, 'users');
    attach('volunteer_alerts', setVolunteerAlerts, 'volunteerAlerts');
    attach('volunteers', setVolunteers, 'volunteers');
    attach('zones', setZones, 'zones');

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [db]);

  const pendingVolunteerAlerts = volunteerAlerts.filter((alert) => alert.status === 'pending');
  const missingPersonsCount = missingPersons.length;
  const redZonesCount = zones.filter((zone) => zone.type === 'red').length;
  const activeUserAlerts = userStatus.filter((status) => status.status === 'need_help').length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Disaster Operations Center</h1>
          <p className="text-sm text-gray-400">
            Real-time operational overview across all system nodes.
          </p>
        </header>

        {/* Overview Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Users" value={users.length} />
          <StatCard label="Total Volunteers" value={volunteers.length} />
          <StatCard label="Active Volunteer Alerts" value={pendingVolunteerAlerts.length} />
          <StatCard label="Missing Persons" value={missingPersonsCount} />
          <StatCard label="Active Red Zones" value={redZonesCount} />
        </section>

        {/* Missing Persons */}
        <SectionShell title="Missing Persons">
          {loading.missingPersons ? (
            <EmptyState text="Loading missing persons..." />
          ) : missingPersons.length === 0 ? (
            <EmptyState text="No missing persons reported." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {missingPersons.map((person) => (
                <div
                  key={person.id}
                  className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex gap-4"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                    {person.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.imageUrl}
                        alt={person.name || 'Missing person'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-100 truncate">
                      {person.name || 'Unknown'}
                    </h3>
                    <p className="text-xs text-gray-400">Age: {person.age ?? '—'}</p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-2">
                      {person.description || 'No description provided.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        {/* Volunteer Alerts */}
        <SectionShell title="Volunteer Alerts">
          {loading.volunteerAlerts ? (
            <EmptyState text="Loading volunteer alerts..." />
          ) : volunteerAlerts.length === 0 ? (
            <EmptyState text="No volunteer alerts yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="py-2">Volunteer</th>
                    <th className="py-2">Message</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Created</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {volunteerAlerts.map((alert) => (
                    <tr key={alert.id} className="border-t border-gray-800">
                      <td className="py-3 text-gray-200">{alert.volunteerName || 'Unknown'}</td>
                      <td className="py-3 text-gray-300 max-w-md truncate">
                        {alert.message || '—'}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={alert.status || 'pending'} />
                      </td>
                      <td className="py-3 text-gray-400">
                        {formatTimestamp(alert.createdAt)}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          disabled
                          className="text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 cursor-not-allowed"
                        >
                          Acknowledge
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionShell>

        {/* User Status */}
        <SectionShell title="User Status">
          {loading.userStatus ? (
            <EmptyState text="Loading user status..." />
          ) : userStatus.length === 0 ? (
            <EmptyState text="No user status updates yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userStatus.map((user) => (
                <div
                  key={user.id}
                  className="bg-gray-950 border border-gray-800 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">{user.name || 'User'}</h3>
                    <StatusBadge status={user.status || 'unknown'} />
                  </div>
                  <p className="text-xs text-gray-400">Lat: {user.location?.latitude ?? '—'}</p>
                  <p className="text-xs text-gray-400">Lng: {user.location?.longitude ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-2">Updated: {formatTimestamp(user.updatedAt || user.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        {/* Map Points */}
        <SectionShell title="Map Points">
          {loading.mapPoints ? (
            <EmptyState text="Loading map points..." />
          ) : mapPoints.length === 0 ? (
            <EmptyState text="No map points available." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="py-2">Name</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Latitude</th>
                    <th className="py-2">Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {mapPoints.map((point) => (
                    <tr key={point.id} className="border-t border-gray-800">
                      <td className="py-3 text-gray-200">{point.name || '—'}</td>
                      <td className="py-3 text-gray-300">{point.type || '—'}</td>
                      <td className="py-3 text-gray-400">{point.lat ?? '—'}</td>
                      <td className="py-3 text-gray-400">{point.lng ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionShell>

        {/* Zones Overview */}
        <SectionShell title="Zones Overview">
          {loading.zones ? (
            <EmptyState text="Loading zones..." />
          ) : zones.length === 0 ? (
            <EmptyState text="No zones defined." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['red', 'orange', 'green'].map((type) => {
                const count = zones.filter((zone) => zone.type === type).length;
                const colorClass =
                  type === 'red'
                    ? 'bg-red-900/30 border-red-700 text-red-300'
                    : type === 'orange'
                    ? 'bg-orange-900/30 border-orange-700 text-orange-300'
                    : 'bg-green-900/30 border-green-700 text-green-300';

                return (
                  <div key={type} className={`border rounded-lg p-4 ${colorClass}`}>
                    <div className="text-sm font-semibold uppercase">{type} Zone</div>
                    <div className="text-2xl font-bold mt-2">{count}</div>
                    <div className="text-xs mt-2">Active alerts: {activeUserAlerts}</div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionShell>

        {/* Users List */}
        <SectionShell title="Users">
          {loading.users ? (
            <EmptyState text="Loading users..." />
          ) : users.length === 0 ? (
            <EmptyState text="No users found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-400">
                  <tr>
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-gray-800">
                      <td className="py-3 text-gray-200">{user.name || '—'}</td>
                      <td className="py-3 text-gray-300">{user.email || '—'}</td>
                      <td className="py-3 text-gray-400">{formatTimestamp(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionShell>

      </div>
    </div>
  );
}
