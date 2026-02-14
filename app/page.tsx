'use client';

import Link from 'next/link';
import {
  AlertCircle,
  MapPin,
  Users,
  Brain,
  ImageIcon,
  Wifi,
  Bell,
  Zap,
  CheckCircle,
  ArrowRight,
  Heart,
  Shield,
} from 'lucide-react';

export default function Home() {
  return (
    <main className="bg-black text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20 overflow-hidden">
        {/* Background gradient effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-96 h-96 bg-red-600 opacity-20 blur-3xl rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-900 opacity-10 blur-3xl rounded-full"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            AI-Powered <span className="text-red-500">Disaster Response</span> Platform
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-12 leading-relaxed">
            Report incidents. Get help. Coordinate rescue — even offline.
          </p>

          {/* Single Login Button */}
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/login"
              className="px-12 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-red-600 hover:from-blue-700 hover:via-purple-700 hover:to-red-700 text-white font-bold rounded-lg transition duration-300 transform hover:scale-105 flex items-center gap-3 text-xl shadow-lg"
            >
              <Shield size={28} />
              Sign In with Google
            </Link>

            <p className="text-gray-400 text-sm">
              Select your role after signing in
            </p>
          </div>
        </div>
      </section>

      {/* Live Map Preview Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">Real-Time Disaster Tracking</h2>
          <p className="text-gray-400 text-center text-lg mb-12">
            Monitor incidents as they happen with our AI-powered real-time tracking system
          </p>

          {/* Map Preview Card */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-800 h-96 bg-gray-950">
            {/* Map background placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-80"></div>

            {/* Incident pins */}
            <div className="absolute top-1/4 left-1/3 flex items-center gap-2 z-20">
              <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-500 text-sm font-semibold">Critical Flood</span>
            </div>

            <div className="absolute top-1/3 right-1/4 flex items-center gap-2 z-20">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
              <span className="text-orange-500 text-sm font-semibold">Landslide Risk</span>
            </div>

            <div className="absolute bottom-1/4 left-1/4 flex items-center gap-2 z-20">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
              <span className="text-yellow-500 text-sm font-semibold">High Wind Alert</span>
            </div>

            <div className="absolute bottom-1/3 right-1/3 flex items-center gap-2 z-20">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.9s'}}></div>
              <span className="text-green-500 text-sm font-semibold">Safe Zone</span>
            </div>

            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255,0,0,.05) 25%, rgba(255,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(255,0,0,.05) 75%, rgba(255,0,0,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,0,0,.05) 25%, rgba(255,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(255,0,0,.05) 75%, rgba(255,0,0,.05) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px'}}></div>

            {/* Center marker */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-1 h-1 bg-white rounded-full"></div>
              <div className="absolute w-12 h-12 border-2 border-white rounded-full animate-ping opacity-75"></div>
              <div className="absolute w-12 h-12 border-2 border-white rounded-full"></div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-6 bg-black">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-red-500 transition duration-300 transform hover:-translate-y-2">
              <div className="bg-red-600 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-center mb-4">Report Incident</h3>
              <p className="text-gray-400 text-center">
                Users quickly report disasters with location, photos, and crisis details through our mobile app or web platform.
              </p>
              <div className="flex justify-center mt-6">
                <div className="text-red-500 text-3xl font-bold">01</div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-yellow-500 transition duration-300 transform hover:-translate-y-2">
              <div className="bg-yellow-500 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Brain size={32} className="text-black" />
              </div>
              <h3 className="text-2xl font-bold text-center mb-4">AI Verification</h3>
              <p className="text-gray-400 text-center">
                Our AI engine verifies incidents, classifies damage, and prioritizes responses based on urgency and risk assessment.
              </p>
              <div className="flex justify-center mt-6">
                <div className="text-yellow-500 text-3xl font-bold">02</div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-green-500 transition duration-300 transform hover:-translate-y-2">
              <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Users size={32} />
              </div>
              <h3 className="text-2xl font-bold text-center mb-4">Coordinated Response</h3>
              <p className="text-gray-400 text-center">
                Volunteers and government agencies receive alerts and coordinate rescue operations in real-time on the map.
              </p>
              <div className="flex justify-center mt-6">
                <div className="text-green-500 text-3xl font-bold">03</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">AI-Powered Features</h2>
          <p className="text-gray-400 text-center text-lg mb-16">
            Cutting-edge technology for faster, smarter disaster response
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-red-500 transition duration-300 group">
              <div className="bg-gradient-to-br from-red-600 to-red-700 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300">
                <Brain size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Risk Prediction</h3>
              <p className="text-gray-400">
                Predictive analytics to forecast disaster impacts and help communities prepare in advance.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-yellow-500 transition duration-300 group">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300">
                <ImageIcon size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Image Damage Assessment</h3>
              <p className="text-gray-400">
                Automatically classify damage severity from photos using computer vision AI.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-blue-500 transition duration-300 group">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300">
                <Wifi size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Offline Sync Mode</h3>
              <p className="text-gray-400">
                Progressive Web App that works completely offline and syncs when connection returns.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-purple-500 transition duration-300 group">
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300">
                <Bell size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Smart Alerts</h3>
              <p className="text-gray-400">
                Intelligent notifications based on user location, role, and disaster type.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-cyan-500 transition duration-300 group">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300">
                <Zap size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Resource Allocation</h3>
              <p className="text-gray-400">
                Optimize deployment of rescue teams and resources using machine learning algorithms.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 hover:border-green-500 transition duration-300 group">
              <div className="bg-gradient-to-br from-green-600 to-green-700 w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition duration-300">
                <MapPin size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-Time Coordination</h3>
              <p className="text-gray-400">
                Live map updates showing incident locations, volunteer positions, and safe routes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Access Section */}
      <section className="py-20 px-6 bg-black">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">Tailored for Every Role</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* User Card */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 border border-gray-700 hover:border-red-500 transition duration-300 transform hover:-translate-y-2">
              <Heart className="text-red-500 mb-4" size={32} />
              <h3 className="text-2xl font-bold mb-6">Citizen / User</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-red-500 mt-1 flex-shrink-0" />
                  <span>Report incidents in real-time</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-red-500 mt-1 flex-shrink-0" />
                  <span>Receive personalized alerts</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-red-500 mt-1 flex-shrink-0" />
                  <span>Access safe evacuation routes</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-red-500 mt-1 flex-shrink-0" />
                  <span>Share location with responders</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-red-500 mt-1 flex-shrink-0" />
                  <span>Works offline and syncs later</span>
                </li>
              </ul>
            </div>

            {/* Volunteer Card */}
            <div className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-xl p-8 border border-yellow-700 hover:border-yellow-500 transition duration-300 transform hover:-translate-y-2">
              <Users className="text-yellow-500 mb-4" size={32} />
              <h3 className="text-2xl font-bold mb-6">Volunteer</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-yellow-500 mt-1 flex-shrink-0" />
                  <span>Receive emergency notifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-yellow-500 mt-1 flex-shrink-0" />
                  <span>View real-time incident map</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-yellow-500 mt-1 flex-shrink-0" />
                  <span>Coordinate with other volunteers</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-yellow-500 mt-1 flex-shrink-0" />
                  <span>Track resource availability</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-yellow-500 mt-1 flex-shrink-0" />
                  <span>Submit status updates</span>
                </li>
              </ul>
            </div>

            {/* Government Card */}
            <div className="bg-gradient-to-br from-blue-900 to-green-900 rounded-xl p-8 border border-blue-700 hover:border-green-500 transition duration-300 transform hover:-translate-y-2">
              <Shield className="text-green-500 mb-4" size={32} />
              <h3 className="text-2xl font-bold mb-6">Government / Admin</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-500 mt-1 flex-shrink-0" />
                  <span>Advanced incident analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-500 mt-1 flex-shrink-0" />
                  <span>Manage authorized responders</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-500 mt-1 flex-shrink-0" />
                  <span>Resource allocation dashboard</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-500 mt-1 flex-shrink-0" />
                  <span>Historical data & reporting</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-500 mt-1 flex-shrink-0" />
                  <span>System administration tools</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Join Our Platform?</h2>
          <p className="text-xl text-gray-400 mb-12">
            Sign in with your Google account and help make a difference in disaster response.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-blue-600 via-yellow-600 to-green-600 hover:from-blue-700 hover:via-yellow-700 hover:to-green-700 text-white font-bold rounded-lg transition duration-300 transform hover:scale-105 text-lg"
          >
            <span>Sign In Now</span>
            <ArrowRight size={24} />
          </Link>
          
          <p className="text-gray-500 text-sm mt-6">
            Your role (User, Volunteer, or Admin) is automatically assigned
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black border-t border-gray-800 py-12 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500">
            Built for Hackathon <span className="text-red-500">|</span> AI-Powered Disaster Response Platform
          </p>
          <p className="text-gray-600 text-sm mt-3">
            © 2026 Disaster Response AI. Saving lives through technology.
          </p>
        </div>
      </footer>
    </main>
  );
}
