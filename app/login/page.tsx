'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoginButton } from '@/components/LoginButton';
import { AlertCircle, Loader2, Users, Shield, User } from 'lucide-react';
import { UserRole } from '@/lib/types';

export default function LoginPage() {
  const { user, role, loading, error } = useAuth();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && role) {
      const redirectPaths: Record<string, string> = {
        admin: '/dashboard/admin',
        volunteer: '/dashboard/volunteer',
        user: '/dashboard/user',
      };

      const redirectPath = redirectPaths[role];
      if (redirectPath) {
        router.replace(redirectPath);
      }
    }
  }, [user, role, loading, router]);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        {/* Show UID if logged in */}
        {user && (
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4 mb-6">
            <p className="text-yellow-200 font-semibold mb-2">Your Firebase UID:</p>
            <code className="text-yellow-100 text-sm break-all bg-yellow-950 p-2 rounded block">
              {user.uid}
            </code>
            <p className="text-yellow-300 text-xs mt-2">
              Copy this UID to set your role in Firebase Console
            </p>
          </div>
        )}

        {/* Logo/Header */}
        <div className="text-center mb-12">
          <div className="inline-block bg-red-600 p-3 rounded-full mb-6">
            <AlertCircle size={32} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Disaster Response
          </h1>
          <p className="text-gray-400 text-lg">
            Sign in to your account
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 size={48} className="animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-gray-400">Checking authentication...</p>
          </div>
        ) : (
          <>
            {/* Login Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8">
              <p className="text-gray-300 text-center mb-6">
                Select your role and sign in
              </p>

              {/* Role Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  I am joining as:
                </label>
                <div className="space-y-3">
                  {/* User Role */}
                  <div
                    onClick={() => setSelectedRole('user')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      selectedRole === 'user'
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User className={`w-6 h-6 ${selectedRole === 'user' ? 'text-blue-400' : 'text-gray-400'}`} />
                      <div className="flex-1">
                        <h3 className={`font-semibold ${selectedRole === 'user' ? 'text-blue-300' : 'text-gray-300'}`}>
                          User
                        </h3>
                        <p className="text-sm text-gray-400">Request help and report your safety status</p>
                      </div>
                      {selectedRole === 'user' && (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Volunteer Role */}
                  <div
                    onClick={() => setSelectedRole('volunteer')}
                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                      selectedRole === 'volunteer'
                        ? 'border-purple-500 bg-purple-900/30'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className={`w-6 h-6 ${selectedRole === 'volunteer' ? 'text-purple-400' : 'text-gray-400'}`} />
                      <div className="flex-1">
                        <h3 className={`font-semibold ${selectedRole === 'volunteer' ? 'text-purple-300' : 'text-gray-300'}`}>
                          Volunteer
                        </h3>
                        <p className="text-sm text-gray-400">Respond to emergencies and help others</p>
                      </div>
                      {selectedRole === 'volunteer' && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <LoginButton variant="default" selectedRole={selectedRole} />

              <p className="text-gray-500 text-xs text-center mt-6">
                We use Google Sign-In to securely authenticate your account.
                Your role is determined by your account type in our system.
              </p>
            </div>

            {/* Info */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-2">
                <span className="font-semibold">New to the platform?</span>
              </p>
              <ul className="text-gray-500 text-sm space-y-2">
                <li>✓ Citizens can report disasters</li>
                <li>✓ Volunteers can join response efforts</li>
                <li>✓ Admins manage the platform</li>
              </ul>
            </div>

            {/* Back Link */}
            <div className="text-center mt-8">
              <button
                onClick={() => router.push('/')}
                className="text-red-500 hover:text-red-400 transition duration-300"
              >
                ← Back to Home
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
