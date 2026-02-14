'use client';

import React, { ReactNode } from 'react';
import { LoginButton } from '@/components/LoginButton';

interface DashboardLayoutProps {
  children: ReactNode;
  userPage?: boolean;
  adminPage?: boolean;
  volunteerPage?: boolean;
}

export default function DashboardLayout({
  children,
  userPage,
  adminPage,
  volunteerPage,
}: DashboardLayoutProps) {
  const getRoleLabel = (): string => {
    if (adminPage) return 'Admin Dashboard';
    if (volunteerPage) return 'Volunteer Dashboard';
    if (userPage) return 'User Dashboard';
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-red-600">{getRoleLabel()}</h1>
          </div>
          <LoginButton variant="logout" />
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}
