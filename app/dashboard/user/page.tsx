'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { UserCircle, AlertCircle, MapPin, Heart, CheckCircle, Loader2, Users, Mic, MicOff } from 'lucide-react';
import DashboardLayout from '@/app/dashboard/layout-base';
import { UserLocationMap } from '@/components/UserLocationMap';
import { ref, set, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

type UserStatusData = {
  uid: string;
  name: string;
  email: string | null;
  status: 'safe' | 'need_help' | 'assigned';
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  updatedAt: string;
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  assignedAt?: string;
  triggeredBy?: string;
};

// Voice keywords for emergency detection
const EMERGENCY_KEYWORDS = ['help', 'need help', 'emergency', 'save me'];

export default function UserDashboard() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatusData | null>(null);

  // Voice recognition states
  const [isListening, setIsListening] = useState(false);
  const [emergencyDetected, setEmergencyDetected] = useState(false);
  const [hasSpokenResponse, setHasSpokenResponse] = useState(false);
  const [hasAnnouncedVolunteer, setHasAnnouncedVolunteer] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Voice synthesis helper
  const speak = (text: string) => {
    if (!window.speechSynthesis) {
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  // Voice-triggered emergency function
  const triggerVoiceEmergency = async () => {
    if (!user || emergencyDetected) {
      return; // Prevent duplicate triggers
    }

    setEmergencyDetected(true);
    setLoading(true);

    try {
      // Get user's current location
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

      // Save to Firebase with voice trigger indicator
      const statusRef = ref(database, `user_status/${user.uid}`);
      const statusData = {
        uid: user.uid,
        name: user.displayName || 'Unknown',
        email: user.email,
        status: 'need_help',
        triggeredBy: 'voice',
        location: {
          latitude: location.lat,
          longitude: location.lng,
        },
        timestamp: Date.now(),
        updatedAt: new Date().toISOString(),
      };

      await set(statusRef, statusData);

      // Speak confirmation
      if (!hasSpokenResponse) {
        speak('Emergency request sent. Finding volunteer.');
        setHasSpokenResponse(true);
      }

      setMessage({
        type: 'success',
        text: '🎙️ Voice emergency detected! Help request sent to volunteers.',
      });
    } catch (error: any) {
      console.error('Voice emergency error:', error);
      setMessage({
        type: 'error',
        text: 'Failed to send voice emergency. Please use the button.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Voice recognition setup
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.uid) {
      return;
    }

    // Check for speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser');
      setVoiceSupported(false);
      return;
    }

    setVoiceSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log('[Voice] Recognition started');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
      console.log('[Voice] Recognized:', transcript);

      // Check for emergency keywords
      const isEmergency = EMERGENCY_KEYWORDS.some((keyword) => transcript.includes(keyword));

      if (isEmergency && !emergencyDetected) {
        console.log('[Voice] Emergency keyword detected!');
        triggerVoiceEmergency();
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setVoiceSupported(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log('[Voice] Recognition ended');

      // Auto-restart if still mounted and supported
      if (isMountedRef.current && voiceSupported) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.error('[Voice] Failed to restart:', error);
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    // Start recognition
    try {
      recognition.start();
    } catch (error) {
      console.error('[Voice] Failed to start recognition:', error);
    }

    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error('[Voice] Cleanup error:', error);
        }
      }
      window.speechSynthesis?.cancel();
    };
  }, [user?.uid, voiceSupported, emergencyDetected]);

  // Realtime listener for user's own status
  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    const statusRef = ref(database, `user_status/${user.uid}`);

    const listener = onValue(statusRef, (snapshot) => {
      const data = snapshot.val() as UserStatusData | null;
      setUserStatus(data);

      // Announce volunteer assignment
      if (
        data?.status === 'assigned' &&
        data.assignedVolunteerName &&
        !hasAnnouncedVolunteer
      ) {
        const announcement = `Volunteer ${data.assignedVolunteerName} is on the way. Please stay calm.`;
        speak(announcement);
        setHasAnnouncedVolunteer(true);
      }

      // Reset announcement flag if status changes away from assigned
      if (data?.status !== 'assigned' && hasAnnouncedVolunteer) {
        setHasAnnouncedVolunteer(false);
      }

      // Reset emergency detection if status becomes safe
      if (data?.status === 'safe' && emergencyDetected) {
        setEmergencyDetected(false);
        setHasSpokenResponse(false);
      }
    });

    return () => {
      off(statusRef, 'value', listener);
    };
  }, [user?.uid, hasAnnouncedVolunteer, emergencyDetected]);

  const saveUserStatus = async (status: 'safe' | 'need_help') => {
    if (!user) return;

    setLoading(true);
    setMessage(null);

    try {
      // Get user's current location
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
      const statusRef = ref(database, `user_status/${user.uid}`);
      const statusData = {
        uid: user.uid,
        name: user.displayName || 'Unknown',
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

      setMessage({
        type: 'success',
        text: status === 'safe' 
          ? '✓ Status updated: You are marked as SAFE' 
          : '✓ Help request sent! Volunteers will be notified.',
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
    <ProtectedRoute requiredRole="user">
      <DashboardLayout userPage>
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
                    Welcome, {user?.displayName || 'User'}!
                  </h2>
                  <p className="text-gray-400 mt-2">{user?.email}</p>
                  <p className="text-red-500 font-semibold mt-2">
                    Role: <span className="uppercase">{role}</span>
                  </p>
                </div>
              </div>
              {/* Voice indicators */}
              {voiceSupported && (
                <div className="flex items-center gap-2">
                  {isListening && !emergencyDetected && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/40 border border-blue-700">
                      <Mic size={16} className="text-blue-400 animate-pulse" />
                      <span className="text-xs text-blue-300">Listening...</span>
                    </div>
                  )}
                  {emergencyDetected && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/60 border border-red-700">
                      <AlertCircle size={16} className="text-red-400" />
                      <span className="text-xs text-red-300 font-semibold">Emergency Detected</span>
                    </div>
                  )}
                  {!voiceSupported && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 border border-gray-700">
                      <MicOff size={16} className="text-gray-500" />
                      <span className="text-xs text-gray-500">Voice Disabled</span>
                    </div>
                  )}
                </div>
              )}
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

          {/* Realtime Status Display */}
          {userStatus && (
            <div
              className={`border rounded-xl p-4 ${
                userStatus.status === 'safe'
                  ? 'bg-green-900 border-green-700'
                  : userStatus.status === 'assigned'
                    ? 'bg-blue-900 border-blue-700'
                    : 'bg-yellow-900 border-yellow-700'
              }`}
            >
              <div
                className={`font-semibold ${
                  userStatus.status === 'safe'
                    ? 'text-green-200'
                    : userStatus.status === 'assigned'
                      ? 'text-blue-200'
                      : 'text-yellow-200'
                }`}
              >
                {userStatus.status === 'safe' && '✅ You are marked safe.'}
                {userStatus.status === 'need_help' && '🆘 Help request sent. Waiting for volunteer...'}
                {userStatus.status === 'assigned' && (
                  <div>
                    <p>🚑 Volunteer {userStatus.assignedVolunteerName || 'Unknown'} is on the way!</p>
                    {userStatus.assignedAt && (
                      <p className="text-sm mt-2 opacity-90">
                        Assigned: {new Date(userStatus.assignedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions - Status Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* I'm Safe Button */}
            <button
              onClick={() => saveUserStatus('safe')}
              disabled={loading}
              className="bg-green-900 border border-green-700 rounded-xl p-6 hover:border-green-500 transition duration-300 transform hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <CheckCircle size={32} className="text-green-400" />
                {loading && <Loader2 size={24} className="animate-spin text-green-400" />}
              </div>
              <h3 className="text-2xl font-bold mb-2">I'm Safe</h3>
              <p className="text-green-200">
                Mark yourself as safe and let others know you're okay.
              </p>
            </button>

            {/* Need Help Button */}
            <button
              onClick={() => saveUserStatus('need_help')}
              disabled={loading}
              className="bg-red-900 border border-red-700 rounded-xl p-6 hover:border-red-500 transition duration-300 transform hover:-translate-y-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <AlertCircle size={32} className="text-red-400" />
                {loading && <Loader2 size={24} className="animate-spin text-red-400" />}
              </div>
              <h3 className="text-2xl font-bold mb-2">Need Help</h3>
              <p className="text-red-200">
                Send an emergency alert to volunteers and rescue teams.
              </p>
            </button>

            {/* Report Missing Person Button */}
            <Link href="/dashboard/user/missing">
              <div className="bg-purple-900 border border-purple-700 rounded-xl p-6 hover:border-purple-500 transition duration-300 transform hover:-translate-y-2 cursor-pointer h-full text-left">
                <div className="flex items-center mb-4">
                  <Users size={32} className="text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Report Missing</h3>
                <p className="text-purple-200">
                  Help find missing persons with photo matching.
                </p>
              </div>
            </Link>
          </div>

          {/* Live Location Map */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <UserLocationMap />
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h3 className="text-2xl font-bold mb-6">Your Activity</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg border-l-4 border-red-500">
                <p className="font-semibold">Account Created</p>
                <p className="text-gray-400 text-sm">
                  Welcome to the Disaster Response Platform
                </p>
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="bg-blue-900 border border-blue-700 rounded-xl p-6">
            <div className="flex gap-4">
              <Heart size={24} className="text-blue-400 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-lg mb-2">How to Use</h4>
                <ul className="text-blue-200 space-y-2 text-sm">
                  <li>• Click "I'm Safe" to let others know you're okay during a disaster</li>
                  <li>• Click "Need Help" to send an emergency alert to volunteers</li>
                  <li>• Say "help", "need help", "emergency", or "save me" for voice-activated emergency</li>
                  <li>• Enable location services for accurate status tracking</li>
                  <li>• Check the map regularly for near-real-time updates</li>
                  <li>• Your location and status are saved when you update</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}