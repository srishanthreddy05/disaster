import React from 'react';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <AlertCircle size={64} className="text-red-600 mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
        <p className="text-gray-400 text-lg mb-8">
          You don't have permission to access this page. Your current role doesn't
          grant access to this resource.
        </p>

        <div className="space-y-4">
          <Link
            href="/"
            className="block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition duration-300"
          >
            Back to Home
          </Link>
          <Link
            href="/login"
            className="block px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition duration-300"
          >
            Sign In Again
          </Link>
        </div>

        <p className="text-gray-500 text-sm mt-8">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </main>
  );
}
