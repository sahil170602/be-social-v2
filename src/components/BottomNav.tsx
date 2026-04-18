import { LayoutGrid, Search, Calendar, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { id: 'home', icon: LayoutGrid, label: 'Home', path: '/home' },
    { id: 'explore', icon: Search, label: 'Explore', path: '/explore' },
    { id: 'meetings', icon: Calendar, label: 'Meetings', path: '/meetings' },
    { id: 'messages', icon: MessageSquare, label: 'Message', path: '/messages' },
  ];

  return (
    <div className="fixed bottom-1 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
      <div className="bg-black/30 backdrop-blur-2xl border border-white/10 rounded-[32px] p-3 flex justify-between items-center shadow-2xl shadow-black/50">
        {navItems.map((item) => {
          // Syncs isActive with the actual URL from react-router
          const isActive = currentPath === item.path;

          return (
            <Link
              key={item.id}
              to={item.path}
              className="relative p-4 rounded-[24px] transition-all duration-300 group flex-1 flex justify-center"
            >
              {/* Active Background Glow - layoutId makes it slide */}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 bg-gradient-to-r from-brand-purple to-brand-pink rounded-[24px] shadow-lg shadow-brand-purple/30"
                  transition={{ 
                    type: 'spring', 
                    stiffness: 380, 
                    damping: 30, 
                    mass: 1 
                  }}
                />
              )}

              <div className="relative z-10 flex flex-col items-center">
                <item.icon
                  size={22}
                  className={`transition-colors duration-300 ${
                    isActive ? 'text-white' : 'text-zinc-500 group-hover:text-white'
                  }`}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}