import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, MessageSquare, User, BarChart3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ProBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dash', path: '/pro-dashboard' },
    { icon: Calendar, label: 'Bookings', path: '/pro-bookings' },
    { icon: BarChart3, label: 'Stats', path: '/pro-stats' },
    { icon: MessageSquare, label: 'Chats', path: '/pro-messages' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-2 flex justify-between items-center shadow-2xl shadow-brand-pink/10">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center w-16 h-12 transition-all"
            >
              {isActive && (
                <motion.div
                  layoutId="proNavGlow"
                  className="absolute inset-0 bg-brand-pink/10 rounded-2xl blur-md"
                />
              )}
              <item.icon
                size={20}
                className={isActive ? 'text-brand-pink' : 'text-zinc-500'}
              />
              <span className={`text-[10px] mt-1 font-bold uppercase tracking-tighter ${isActive ? 'text-brand-pink' : 'text-zinc-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}