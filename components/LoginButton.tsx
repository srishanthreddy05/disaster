'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, LogOut } from 'lucide-react';
import { UserRole } from '@/lib/types';

interface LoginButtonProps {
  variant?: 'default' | 'logout';
  selectedRole?: UserRole;
}

export function LoginButton({ variant = 'default', selectedRole }: LoginButtonProps) {
  const { user, loading, login, logout } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await login(selectedRole);
      // Redirect will happen automatically through ProtectedRoute
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || isLoading) {
    return (
      <button
        disabled
        className="px-6 py-2 bg-gray-600 text-white rounded-lg flex items-center gap-2 cursor-wait"
      >
        <Loader2 size={18} className="animate-spin" />
        Loading...
      </button>
    );
  }

  if (user && variant === 'logout') {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {user.photoURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-10 h-10 rounded-full"
            />
          )}
          <span className="text-sm">{user.displayName || user.email}</span>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition duration-300"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition duration-300 transform hover:scale-105"
    >
      Sign In with Google
    </button>
  );
}
