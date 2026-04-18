import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, CalendarClock, TrendingUp, 
  Wallet, MessageSquare, Settings, LogOut, AlertCircle, Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient'; 
import { App as CapApp } from '@capacitor/app';

// Bumped cache key to wipe stale ghost data
const CACHE_PRO_DASHBOARD = 'be_social_pro_dashboard_v4';

export default function ProDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [statsData, setStatsData] = useState({ completedCount: 0, upcomingCount: 0 });
  const [pendingBookings, setPendingBookings] = useState<any[]>([]); 
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; type: 'auth' | 'db' | null }>({ message: '', type: null });

  // --- 1. BACK NAVIGATION: EXIT APP ON DASHBOARD ---
  useEffect(() => {
    const handleBack = () => {
      CapApp.exitApp();
    };
    const capListener = CapApp.addListener('backButton', handleBack);
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handleBack);

    return () => {
      if (capListener && capListener.then) {
        capListener.then(l => l.remove());
      }
      window.removeEventListener('popstate', handleBack);
    };
  }, []);

  // --- 2. DATA FETCHING & REALTIME SYNC ---
  useEffect(() => {
    let isMounted = true;
    const channels: any[] = [];

    async function loadDashboardData() {
      try {
        const phone = localStorage.getItem('sb_user_phone');
        if (!phone || !isMounted) return;

        // A. INSTANT OPEN LOGIC (Check local cache first)
        try {
          const cachedStr = localStorage.getItem(CACHE_PRO_DASHBOARD);
          if (cachedStr) {
            const cache = JSON.parse(cachedStr);
            if (cache.phone === phone) {
              setProfile(cache.profile);
              setWalletBalance(cache.walletBalance || 0);
              setStatsData(cache.statsData || { completedCount: 0, upcomingCount: 0 });
              setPendingBookings(cache.pendingBookings || []);
              setUnreadCount(cache.unreadCount || 0);
              setLoading(false); // Instantly render UI!
            }
          }
        } catch (e) {}

        // B. Fetch Fresh Profile Data in Background
        const { data: pro, error: proError } = await supabase
          .from('pro_profiles')
          .select('*')
          .eq('phone', phone)
          .single();

        if (proError) throw proError;
        
        if (pro && isMounted) {
          setProfile(pro);
          setLoading(false);

          // AUTO-ONLINE
          await supabase.from('pro_profiles').update({ is_online: true }).eq('id', pro.id);

          // C. Data Loading function used initially and by Realtime
          const refreshNumericalData = async () => {
            try {
              const { data: wallet } = await supabase.from('pro_wallets').select('balance').eq('pro_id', pro.id).maybeSingle();
              const { data: meetings } = await supabase.from('meetings').select('meeting_status').eq('pro_id', pro.id);
              
              // THE FIX: Try explicit connection first, fallback to standard if it fails (Silent 500 error fix)
              let { data: pending, error: pendingErr } = await supabase
                .from('meetings')
                .select(`id, user_id, meeting_date, start_time, end_time, services, user_profiles!fk_meetings_user ( full_name, avatar_url )`)
                .eq('pro_id', pro.id)
                .eq('meeting_status', 'pending')
                .order('created_at', { ascending: false });

              if (pendingErr) {
                // Fallback for standard join
                const fallback = await supabase
                  .from('meetings')
                  .select(`id, user_id, meeting_date, start_time, end_time, services, user_profiles ( full_name, avatar_url )`)
                  .eq('pro_id', pro.id)
                  .eq('meeting_status', 'pending')
                  .order('created_at', { ascending: false });
                
                pending = fallback.data;
                if (fallback.error) console.error("Critical Pending Bookings Error:", fallback.error);
              }

              const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('receiver_id', pro.id).eq('is_read', false);

              if (isMounted) {
                const freshWallet = wallet ? wallet.balance : 0;
                const freshStats = {
                  completedCount: meetings ? meetings.filter(m => m.meeting_status === 'completed').length : 0,
                  upcomingCount: meetings ? meetings.filter(m => ['scheduled', 'confirmed', 'started'].includes(m.meeting_status)).length : 0
                };
                
                // Safely parse user_profiles to handle both object and array formats returned by Supabase
                const freshPending = (pending || []).map((b: any) => ({
                  ...b,
                  user_profiles: Array.isArray(b.user_profiles) ? b.user_profiles[0] : b.user_profiles
                }));

                const freshUnread = count || 0;

                setWalletBalance(freshWallet);
                setStatsData(freshStats);
                setPendingBookings(freshPending);
                setUnreadCount(freshUnread);

                // UPDATE INSTANT CACHE WITH MINIMIZED FRESH DATA
                try {
                  // Only cache the top 5 bookings to guarantee we never hit the 5MB local storage quota
                  const safePending = freshPending.slice(0, 5).map((b: any) => ({
                    ...b,
                    user_profiles: b.user_profiles ? {
                      ...b.user_profiles,
                      avatar_url: b.user_profiles.avatar_url?.length > 500 ? null : b.user_profiles.avatar_url
                    } : null
                  }));

                  // Remove heavy bio and services array from the cached profile object
                  const slimProfile = { ...pro, bio: undefined, services: undefined };

                  const cacheData = {
                    phone,
                    profile: slimProfile,
                    walletBalance: freshWallet,
                    statsData: freshStats,
                    pendingBookings: safePending,
                    unreadCount: freshUnread
                  };
                  localStorage.setItem(CACHE_PRO_DASHBOARD, JSON.stringify(cacheData));
                } catch (e) {
                  // If it still fails, it fails silently without logging massive errors
                  localStorage.removeItem(CACHE_PRO_DASHBOARD);
                }
              }
            } catch (error) {
              console.error("Error refreshing data:", error);
            }
          };

          await refreshNumericalData();

          // D. SETUP REALTIME
          const walletChannel = supabase.channel(`wallet-${pro.id}-${Math.random()}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pro_wallets', filter: `pro_id=eq.${pro.id}` }, 
              (payload) => setWalletBalance(payload.new.balance));

          // 800ms delay bypasses Database Read Replica Latency, guaranteeing the new booking is fetched!
          const meetingsChannel = supabase.channel(`meetings-${pro.id}-${Math.random()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `pro_id=eq.${pro.id}` }, 
              () => {
                setTimeout(() => {
                  if (isMounted) refreshNumericalData();
                }, 800);
              });

          const notificationsChannel = supabase.channel(`notifs-${pro.id}-${Math.random()}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `receiver_id=eq.${pro.id}` }, 
              () => setUnreadCount(prev => prev + 1));

          walletChannel.subscribe();
          meetingsChannel.subscribe();
          notificationsChannel.subscribe();

          channels.push(walletChannel, meetingsChannel, notificationsChannel);
        }
      } catch (err: any) {
        console.error("Dashboard Error:", err);
        if (isMounted) setError({ message: err.message || "Connection error", type: 'db' });
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
      channels.forEach(ch => supabase.removeChannel(ch));
      
      // AUTO-OFFLINE
      const phone = localStorage.getItem('sb_user_phone');
      if (phone) {
        supabase.from('pro_profiles').update({ is_online: false }).eq('phone', phone);
      }
    };
  }, []);

  // --- 3. ACTIONS ---
  const handleLogout = async () => {
    if (profile?.id) {
      await supabase.from('pro_profiles').update({ is_online: false }).eq('id', profile.id);
    }
    await supabase.auth.signOut();
    localStorage.removeItem('sb_user_phone');
    localStorage.removeItem(CACHE_PRO_DASHBOARD); // Clear cache on logout
    navigate('/', { replace: true });
  };

  const handleBookingAction = async (bookingId: string, action: 'scheduled' | 'cancelled') => {
    const booking = pendingBookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Optimistic UI update
    setPendingBookings(prev => prev.filter(b => b.id !== bookingId));
    
    const { error } = await supabase.from('meetings').update({ meeting_status: action }).eq('id', bookingId);

    if (!error) {
      if (action === 'scheduled') {
        // Send auto-message
        await supabase.from('messages').insert({
          meeting_id: bookingId,
          sender_id: profile.id,
          sender_type: 'pro',
          text: `Hi! I have accepted your booking. I am looking forward to our meeting!`
        });

        // Alert User
        await supabase.from('notifications').insert({
          receiver_id: booking.user_id,
          title: "✅ Booking Confirmed",
          message: `${profile.full_name} has accepted your booking for ${booking.meeting_date}!`
        });

      } else if (action === 'cancelled') {
        // Alert User
        await supabase.from('notifications').insert({
          receiver_id: booking.user_id,
          title: "❌ Booking Declined",
          message: `${profile.full_name} was unable to accept your booking for ${booking.meeting_date}.`
        });
      }
    }
  };

  if (error.type) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center p-8 text-center">
        <div className="p-10 bg-white/[0.02] border border-white/10 rounded-[2.5rem] max-w-sm">
          <AlertCircle className="text-brand-pink mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-black mb-2 text-brand-pink tracking-tight">Be social</h2>
          <p className="text-zinc-500 mb-8 text-sm leading-relaxed">{error.message}</p>
          <button onClick={() => navigate('/')} className="w-full py-4 bg-brand-pink text-white rounded-2xl font-bold">Go to login</button>
        </div>
      </div>
    );
  }

  // Show a blank loading state instantly if NO cache and NO data yet to prevent showing zero/blank values.
  if (loading && !profile) {
    return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden selection:bg-brand-pink/30">
      
      {/* --- CLEAN HEADER --- */}
      <header className="shrink-0 z-[100] bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-6 pb-4 pt-4 flex justify-between items-center">
        <div>
          <h1 className="font-extrabold text-[28px] bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent tracking-tighter">Be social</h1>
          <p className="text-zinc-400 text-[14px] font-bold tracking-tight mt-0.5 capitalize">
            {profile?.full_name || 'Professional'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* NOTIFICATION BUTTON WITH NAVIGATION */}
          <button 
            onClick={() => navigate('/pro-notifications')} 
            className="relative h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 active:scale-90 transition-transform"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-brand-pink text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <button onClick={handleLogout} className="h-10 w-10 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/70 active:scale-90 transition-transform">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* --- BODY --- */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar pb-10">
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="rounded-[2.2rem] bg-gradient-to-br from-brand-pink to-brand-purple p-8 shadow-xl relative overflow-hidden">
             <TrendingUp size={110} className="absolute -right-4 -bottom-4 text-white/10" />
             <p className="text-xs font-bold text-white/70 tracking-tight">Lifetime Earning</p>
             <div className="text-5xl font-black text-white mt-1 leading-none tracking-tighter">₹{walletBalance}</div>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white/[0.03] border border-white/5 rounded-[1.8rem] p-6">
              <div className="w-10 h-10 bg-blue-400/10 rounded-xl flex items-center justify-center mb-4 text-blue-400">
                <CheckCircle2 size={20} />
              </div>
              <div className="text-2xl font-black leading-none">{statsData.completedCount}</div>
              <p className="text-[10px] font-bold text-zinc-500 mt-2">Completed</p>
           </div>
           <div className="bg-white/[0.03] border border-white/5 rounded-[1.8rem] p-6">
              <div className="w-10 h-10 bg-brand-pink/10 rounded-xl flex items-center justify-center mb-4 text-brand-pink">
                <CalendarClock size={20} />
              </div>
              <div className="text-2xl font-black leading-none">{statsData.upcomingCount}</div>
              <p className="text-[10px] font-bold text-zinc-500 mt-2">Upcoming</p>
           </div>
        </div>

        <section>
          <h3 className="text-[11px] font-black text-zinc-400 mb-4 ml-1 tracking-widest uppercase">Services & tools</h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Chats', icon: MessageSquare, path: '/pro-messages', color: 'text-blue-400', bg: 'bg-blue-400/10' },
              { label: 'Bookings', icon: CalendarClock, path: '/pro-bookings', color: 'text-brand-pink', bg: 'bg-brand-pink/10' },
              { label: 'Wallet', icon: Wallet, path: '/wallet', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
              { label: 'Edit', icon: Settings, path: '/pro-profile-edit', color: 'text-brand-purple', bg: 'bg-brand-purple/10' }
            ].map((item, i) => (
              <button key={i} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-2 group">
                <div className={`h-14 w-14 rounded-2xl ${item.bg} border border-white/5 flex items-center justify-center ${item.color} transition-all active:scale-90`}>
                  <item.icon size={22} />
                </div>
                <span className="text-[10px] font-bold text-zinc-500 capitalize">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pb-10">
          <h3 className="text-[11px] font-black text-brand-pink mb-4 ml-1 flex items-center gap-2 tracking-widest uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-pink animate-pulse" /> 
            New bookings
          </h3>
          
          <div className="space-y-4">
            {pendingBookings.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {pendingBookings.map((booking) => (
                  <motion.div key={booking.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="p-5 bg-white/[0.02] border border-white/5 rounded-[2rem] flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <img src={booking.user_profiles?.avatar_url || 'https://placehold.co/150/111/fff?text=User'} className="w-14 h-14 rounded-[1rem] object-cover border border-white/10" alt="Client" />
                      <div className="flex-1">
                        <h4 className="font-black text-base text-white leading-tight capitalize">{booking.user_profiles?.full_name || 'Client'}</h4>
                        <p className="text-[10px] text-zinc-500 font-bold mt-1 flex items-center gap-1.5">
                          <CalendarClock size={11} className="text-brand-purple" />
                          {booking.meeting_date} • {booking.start_time}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleBookingAction(booking.id, 'scheduled')} className="flex-1 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl font-black text-[11px] border border-emerald-500/20 active:scale-95 transition-all uppercase tracking-wider">Accept</button>
                      <button onClick={() => handleBookingAction(booking.id, 'cancelled')} className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl font-black text-[11px] border border-red-500/20 active:scale-95 transition-all uppercase tracking-wider">Reject</button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-[2rem] bg-white/[0.01]">
                <p className="text-zinc-600 font-bold text-[10px] tracking-tight uppercase">No pending bookings right now</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
