import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

import SplashScreenPage from './pages/SplashScreen';
import RoleSelection from './pages/RoleSelection';
import Auth from './pages/Auth'; 
import Home from './pages/Home'; 
import Explore from './pages/Explore';
import Meetings from './pages/Meetings';
import ProfileEdit from './pages/ProfileEdit';
import Notifications from './pages/Notifications'; 
import ProDashboard from './pages/ProDashboard';
import ProBookings from './pages/ProBookings';
import ProDetails from './pages/ProDetails';
import BookingPage from './pages/BookingPage';
import CheckoutPage from './pages/CheckoutPage';
import UserMessages from './pages/UserMessages'; 
import ProMessages from './pages/ProMessages'; 
import ProWallet from './pages/ProWallet';
import ProProfileEdit from './pages/ProProfileEdit';
import ProNotifications from './pages/ProNotifications'; // <-- NEW IMPORT
import BottomNav from './components/BottomNav';

const UserRoute = ({ children }: { children: React.ReactNode }) => {
  const userPhone = localStorage.getItem('sb_user_phone');
  const role = localStorage.getItem('user_role');
  if (!userPhone) return <Navigate to="/select-role" replace />;
  if (role === 'pro') return <Navigate to="/pro-dashboard" replace />;
  return <>{children}</>;
};

const ProRoute = ({ children }: { children: React.ReactNode }) => {
  const userPhone = localStorage.getItem('sb_user_phone');
  const role = localStorage.getItem('user_role');
  if (!userPhone) return <Navigate to="/select-role" replace />;
  if (role === 'user') return <Navigate to="/home" replace />;
  return <>{children}</>;
};

function AnimatedRoutes() {
  const location = useLocation();
  const path = location.pathname;
  const userRole = localStorage.getItem('user_role');

  useEffect(() => {
    const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      const exitPaths = ['/home', '/pro-dashboard', '/select-role', '/'];
      
      if (exitPaths.includes(location.pathname)) {
        CapApp.exitApp();
      } 
      else if (
        location.pathname === '/profile-edit' || 
        location.pathname === '/pro-profile-edit' || 
        location.pathname.startsWith('/checkout/')
      ) {
        return;
      } 
      else {
        window.history.back();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [location.pathname]);

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  const isChatOpen = new URLSearchParams(location.search).has('chat');
  const userPaths = ['/home', '/explore', '/meetings', '/messages'];
  const showUserNav = userPaths.includes(path) && !isChatOpen && userRole === 'user';

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] overflow-x-hidden font-sans">
      <AnimatePresence mode="popLayout">
        <Routes location={location} key={path}>
          <Route path="/" element={<SplashScreenPage />} />
          <Route path="/select-role" element={<RoleSelection />} />
          <Route path="/auth/:role" element={<Auth />} />
          
          {/* USER ROUTES */}
          <Route path="/home" element={<UserRoute><Home /></UserRoute>} />
          <Route path="/explore" element={<UserRoute><Explore /></UserRoute>} />
          <Route path="/meetings" element={<UserRoute><Meetings /></UserRoute>} />
          <Route path="/messages" element={<UserRoute><UserMessages /></UserRoute>} />
          <Route path="/notifications" element={<UserRoute><Notifications /></UserRoute>} />
          <Route path="/pro/:id" element={<UserRoute><ProDetails /></UserRoute>} />
          <Route path="/book/:id" element={<UserRoute><BookingPage /></UserRoute>} /> 
          <Route path="/checkout/:proId" element={<UserRoute><CheckoutPage /></UserRoute>} />
          <Route path="/profile-edit" element={<UserRoute><ProfileEdit /></UserRoute>} />

          {/* PRO ROUTES */}
          <Route path="/pro-dashboard" element={<ProRoute><ProDashboard /></ProRoute>} />
          <Route path="/pro-bookings" element={<ProRoute><ProBookings /></ProRoute>} />
          <Route path="/pro-messages" element={<ProRoute><ProMessages /></ProRoute>} />
          <Route path="/wallet" element={<ProRoute><ProWallet /></ProRoute>} />
          <Route path="/pro-profile-edit" element={<ProRoute><ProProfileEdit /></ProRoute>} />
          <Route path="/pro-notifications" element={<ProRoute><ProNotifications /></ProRoute>} /> {/* <-- NEW ROUTE */}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      {showUserNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}