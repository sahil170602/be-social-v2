import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  MapPin, Clock, Calendar, 
  CalendarCheck, ShieldCheck, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav from '../components/BottomNav';

// Bumped cache version to wipe out the old corrupted ghost data
const CACHE_MEETINGS = 'be_social_meetings_v4';

export default function Meetings() {
  const navigate = useNavigate();
  
  // --- 1. INSTANT STATE ---
  const [meetings, setMeetings] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_MEETINGS);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [loading, setLoading] = useState(() => localStorage.getItem(CACHE_MEETINGS) === null);

  // --- 2. FORMATTING ---
  const formatMeetingTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'Pm' : 'Am';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const formatBookingDate = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-In', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  const getStatusUI = (status: string) => {
    switch (status) {
      case 'completed': return { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'Completed' };
      case 'started': return { color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'Started' };
      case 'confirmed': return { color: 'text-brand-purple bg-brand-purple/10 border-brand-purple/20', label: 'Confirmed' };
      case 'scheduled': return { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'Scheduled' };
      case 'cancelled': return { color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'Cancelled' };
      default: return { color: 'text-zinc-400 bg-white/5 border-white/10', label: status || 'Pending' };
    }
  };

  // --- 3. FETCH & SYNC ---
  const fetchUserMeetings = async () => {
    const phone = localStorage.getItem('sb_user_phone');
    if (!phone) { navigate('/', { replace: true }); return null; }

    // Deep clean old caches to free up space
    Object.keys(localStorage).forEach(key => {
      if (key.includes('be_social_meetings_v') && key !== CACHE_MEETINGS) {
        localStorage.removeItem(key);
      }
      if (key.includes('be_social_user_meetings_v')) {
        localStorage.removeItem(key);
      }
    });

    const { data: user } = await supabase.from('user_profiles').select('id').eq('phone', phone).single();

    if (user) {
      // THE FIX: Explicitly tell Supabase which connection to use to prevent 500 crashes
      let { data, error } = await supabase
        .from('meetings')
        .select(`*, pro_profiles!fk_meetings_pro(full_name, avatar_url, profession)`)
        .eq('user_id', user.id)
        .order('meeting_date', { ascending: true })
        .order('start_time', { ascending: true });
        
      // Fallback if explicit connection fails
      if (error) {
        const fallback = await supabase
          .from('meetings')
          .select(`*, pro_profiles(full_name, avatar_url, profession)`)
          .eq('user_id', user.id)
          .order('meeting_date', { ascending: true })
          .order('start_time', { ascending: true });
        data = fallback.data;
      }

      if (data) {
        // THE FIX 2: Safely normalize data to fix arrays hiding profile names/images
        const normalizedData = data.map((m: any) => ({
          ...m,
          pro_profiles: Array.isArray(m.pro_profiles) ? m.pro_profiles[0] : m.pro_profiles
        }));

        setMeetings(normalizedData);
        
        // MICRO-CACHE PAYLOAD MINIMIZER LOGIC
        try {
          const lightweightData = normalizedData.slice(0, 15).map((m: any) => ({
            id: m.id,
            meeting_date: m.meeting_date,
            start_time: m.start_time,
            end_time: m.end_time,
            place: m.place,
            total_price: m.total_price,
            meeting_status: m.meeting_status,
            payment_status: m.payment_status,
            created_at: m.created_at,
            services: m.services,
            pro_profiles: {
              full_name: m.pro_profiles?.full_name,
              profession: m.pro_profiles?.profession,
              avatar_url: m.pro_profiles?.avatar_url?.length > 500 ? '' : m.pro_profiles?.avatar_url
            }
          }));
          localStorage.setItem(CACHE_MEETINGS, JSON.stringify(lightweightData));
        } catch (e) {
          console.warn("Storage full, operating without cache.");
          localStorage.removeItem(CACHE_MEETINGS);
        }
      } else {
        // THE FIX 3: If no data exists, forcefully empty the UI and cache
        setMeetings([]);
        localStorage.removeItem(CACHE_MEETINGS);
      }
      return user.id;
    }
    return null;
  };

  useEffect(() => {
    let channel: any;
    let isMounted = true;

    const setupSync = async () => {
      const uid = await fetchUserMeetings();
      if (uid && isMounted) {
        channel = supabase
          // THE FIX 4: Math.random() prevents strict-mode loop crashes
          .channel(`user-meetings-live-${uid}-${Math.random()}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'meetings', filter: `user_id=eq.${uid}` },
            () => { fetchUserMeetings(); }
          )
          .subscribe();
      }
      if (isMounted) setLoading(false);
    };

    setupSync();
    
    return () => { 
      isMounted = false;
      if (channel) supabase.removeChannel(channel); 
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-brand-purple/30 pb-32">
      
      {/* FIXED HEADER */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 px-6 py-5">
        <div className="max-w-5xl mx-auto flex justify-between items-center px-1">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">My <span className="bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent">Sessions</span></h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manage your bookings</p>
          </div>
        </div>
      </nav>

      {/* SCROLLABLE BODY */}
      <main className="w-full p-6 pt-32 max-w-5xl mx-auto space-y-6">
        
        {loading ? (
          <div className="py-32 flex justify-center items-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {meetings.length > 0 ? (
              meetings.map((m) => {
                const ui = getStatusUI(m.meeting_status);
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={m.id} 
                    className="bg-white/[0.02] border border-white/5 rounded-[2.2rem] p-6 hover:border-brand-purple/20 transition-all shadow-xl"
                  >
                    {/* Top: Pro Details and Status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {m.pro_profiles?.avatar_url ? (
                           <img src={m.pro_profiles.avatar_url} className="w-11 h-11 rounded-2xl object-cover border border-white/10" alt={m.pro_profiles.full_name} />
                        ) : (
                          <div className="w-11 h-11 rounded-2xl bg-brand-purple/10 flex items-center justify-center text-brand-purple font-black border border-brand-purple/20 uppercase">
                            {m.pro_profiles?.full_name?.[0] || 'U'}
                          </div>
                        )}
                        <div>
                          <h4 className="font-black text-sm tracking-tight capitalize">{m.pro_profiles?.full_name}</h4>
                          <div className={`mt-1 px-2 py-0.5 rounded-lg border text-[8px] font-black w-fit tracking-widest ${ui.color} capitalize`}>
                            {ui.label}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent font-black text-[16px] leading-none">₹{m.total_price}</p>
                        <p className="text-[9px] text-zinc-600 font-bold mt-1 capitalize">{m.payment_status}</p>
                      </div>
                    </div>

                    {/* Booking Timestamp */}
                    <div className="flex items-center gap-1.5 mb-5 px-1">
                      <Info size={10} className="text-zinc-600" />
                      <p className="text-[9px] text-zinc-500 font-bold tracking-tight">
                        Booked on {formatBookingDate(m.created_at)}
                      </p>
                    </div>

                    {/* Services Tags */}
                    {m.services && m.services.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                        {m.services.map((s: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-white/5 rounded-xl text-[9px] font-bold text-zinc-400 border border-white/5 capitalize">{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Logistics Info Cards */}
                    <div className="space-y-3">
                       <div className="p-4 bg-black/40 rounded-2xl flex items-center justify-between border border-white/5">
                          <div className="flex items-center gap-3">
                            <Calendar size={16} className="text-brand-purple" />
                            <span className="text-[11px] font-bold text-zinc-300">{m.meeting_date}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Clock size={16} className="text-brand-purple" />
                            <span className="text-[11px] font-bold text-zinc-300">
                              {formatMeetingTime(m.start_time)} - {formatMeetingTime(m.end_time)}
                            </span>
                          </div>
                       </div>
                       
                       <div className="p-4 bg-black/40 rounded-2xl flex items-center gap-3 border border-white/5">
                          <MapPin size={16} className="text-brand-purple" />
                          <span className="text-[11px] font-bold text-zinc-300 truncate capitalize">{m.place}</span>
                       </div>

                       {/* Progress Indicator for User */}
                       {m.meeting_status === 'completed' ? (
                         <div className="w-full py-4 bg-brand-purple/5 text-brand-purple/70 rounded-2xl font-black text-[10px] tracking-widest text-center flex items-center justify-center gap-2 border border-brand-purple/10">
                           <ShieldCheck size={14} /> Session completed successfully
                         </div>
                       ) : (
                         <div className="w-full py-4 bg-emerald-500/5 text-emerald-500/70 rounded-2xl font-black text-[10px] tracking-widest text-center flex items-center justify-center gap-2 border border-emerald-500/10">
                           <ShieldCheck size={14} /> Payment secured until session finishes
                         </div>
                       )}
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="p-12 text-center border-2 border-dashed border-white/5 rounded-[3rem] mt-10"
              >
                <CalendarCheck className="mx-auto text-zinc-700 mb-4" size={48} />
                <p className="text-zinc-600 font-bold text-[11px] tracking-widest uppercase">No appointments found</p>
                <p className="text-zinc-500 text-xs mt-2 font-medium">Head to the Explore tab to find an expert!</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
      <div className="h-24" />
    </div>
  );
}
