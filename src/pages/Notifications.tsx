import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Bell, ArrowLeft, CheckCircle, Calendar, 
  Star, Info, Trash2, WifiOff, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Smart navigation (android & windows) ---
  useEffect(() => {
    const handleBack = () => navigate(-1);
    const capListener = CapApp.addListener('backButton', handleBack);
    window.addEventListener('popstate', handleBack);
    return () => {
      capListener.then(l => l.remove());
      window.removeEventListener('popstate', handleBack);
    };
  }, [navigate]);

  useEffect(() => {
    let notifChannel: any;
    let isMounted = true;

    const loadData = async () => {
      const userPhone = localStorage.getItem('sb_user_phone');
      if (!userPhone) {
        setLoading(false);
        return;
      }

      // STRICT USER CHECK: Only look in user_profiles
      const { data: user } = await supabase.from('user_profiles').select('id').eq('phone', userPhone).single();

      if (user && isMounted) {
        // Fetch all notifications for this specific user
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('receiver_id', user.id)
          .order('created_at', { ascending: false });

        if (data) setNotifications(data);
        
        // Listen for new notifications in real-time so they pop up instantly!
        notifChannel = supabase.channel(`notifs-${user.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${user.id}` }, 
            (payload) => {
              if (isMounted) setNotifications(prev => [payload.new, ...prev]);
            }
          ).subscribe();

        // Mark all as read silently in the background
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false);
      }
      
      if (isMounted) setLoading(false);
    };

    loadData();

    return () => {
      isMounted = false;
      if (notifChannel) supabase.removeChannel(notifChannel);
    };
  }, []);

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'welcome': return <Star className="text-yellow-500" size={20} />;
      case 'booking_confirm': return <CheckCircle className="text-emerald-500" size={20} />;
      case 'booking_accepted': return <Calendar className="text-brand-purple" size={20} />;
      default: return <Info className="text-zinc-400" size={20} />;
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden">
      
      {/* Fixed Header */}
      <nav className="shrink-0 z-[100] bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-4 pb-4 pt-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-16">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-white/5">
              <ArrowLeft size={22} />
            </button>
            <h1 className="font-extrabold text-[24px] tracking-tight">Notifications</h1>
          </div>
          {/* We'll use a hard refresh if they click the clock */}
          <button onClick={() => window.location.reload()} className="p-2 text-zinc-500 active:scale-90 transition-transform">
             <Clock size={20} />
          </button>
        </div>
      </nav>

      {/* Scrollable Body */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4 pb-32 hide-scrollbar">
        <AnimatePresence mode="popLayout">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`relative group p-5 rounded-[2rem] border transition-all active:scale-[0.98] ${
                  !n.is_read ? 'bg-brand-purple/5 border-brand-purple/20' : 'bg-white/[0.02] border-white/5'
                }`}
              >
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    !n.is_read ? 'bg-brand-purple/10' : 'bg-white/5'
                  }`}>
                    {getIcon(n.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-sm pr-6 leading-tight capitalize">{n.title}</h4>
                      <button 
                        onClick={() => deleteNotification(n.id)}
                        className="absolute top-5 right-5 p-2 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {/* Render message from the notifications table */}
                    <p className="text-zinc-400 text-[11px] leading-relaxed capitalize">{n.message}</p>
                    <p className="text-[9px] text-zinc-600 font-bold mt-3">
                      {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                {!n.is_read && (
                  <div className="absolute top-5 right-5 w-2 h-2 bg-brand-pink rounded-full"></div>
                )}
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-12 text-center border-2 border-dashed border-white/5 rounded-[3rem] mt-10"
            >
              <WifiOff className="mx-auto text-zinc-700 mb-4" size={40} />
              <p className="text-zinc-600 font-bold text-[10px] tracking-widest uppercase">No notifications found</p>
              <p className="text-zinc-500 text-xs mt-2">Check back later for updates</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
