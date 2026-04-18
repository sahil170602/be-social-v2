import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, MapPin, Clock, Calendar, 
  CalendarCheck, ShieldCheck, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';

export default function ProBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- 1. Fix Back Navigation (Android & Windows) ---
  useEffect(() => {
    const handleBack = () => {
      navigate('/pro-dashboard');
    };

    const capListener = CapApp.addListener('backButton', handleBack);
    
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handleBack);

    return () => {
      capListener.then(l => l.remove());
      window.removeEventListener('popstate', handleBack);
    };
  }, [navigate]);

  // --- 2. Helper Functions for Formatting ---

  // Converts 24h string (e.g. "14:30:00") to 12h (e.g. "2:30 Pm")
  const formatMeetingTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'Pm' : 'Am';
    h = h % 12;
    h = h ? h : 12; // the hour '0' should be '12'
    return `${h}:${minutes} ${ampm}`;
  };

  const formatBookingDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-In', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // --- 3. Fetch Data & Realtime Sync ---
  const fetchProBookings = async () => {
    const phone = localStorage.getItem('sb_user_phone');
    const { data: pro } = await supabase.from('pro_profiles').select('id').eq('phone', phone).single();

    if (pro) {
      // Sorting by upcoming date and time
      const { data } = await supabase
        .from('meetings')
        .select(`*, user_profiles(full_name, avatar_url)`)
        .eq('pro_id', pro.id)
        .order('meeting_date', { ascending: true })
        .order('start_time', { ascending: true });
        
      if (data) setBookings(data);
      return pro.id;
    }
    return null;
  };

  useEffect(() => {
    let channel: any;

    const setupSync = async () => {
      const pid = await fetchProBookings();
      if (pid) {
        channel = supabase
          .channel(`pro-bookings-live-${pid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'meetings', filter: `pro_id=eq.${pid}` },
            () => { fetchProBookings(); }
          )
          .subscribe();
      }
      setLoading(false);
    };

    setupSync();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const getStatusUI = (status: string) => {
    switch (status) {
      case 'completed': return { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'Completed' };
      case 'started': return { color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'Started' };
      case 'confirmed': return { color: 'text-brand-purple bg-brand-purple/10 border-brand-purple/20', label: 'Confirmed' };
      case 'scheduled': return { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'Scheduled' };
      case 'cancelled': return { color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'Cancelled' };
      default: return { color: 'text-zinc-400 bg-white/5 border-white/10', label: status };
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden">
      
      {/* --- Fixed Header --- */}
      <nav className="shrink-0 z-[100] bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-6 pb-4 pt-4 flex items-center gap-4">
        <button 
          onClick={() => navigate('/pro-dashboard')} 
          className="p-2 bg-white/5 rounded-xl border border-white/5 active:scale-90 transition-all"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Client <span className="text-primary-gradient">Meetings</span></h1>
          <p className="text-[10px] font-bold text-zinc-500 tracking-widest mt-0.5">All appointments</p>
        </div>
      </nav>

      {/* --- Scrollable Body --- */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4 hide-scrollbar pt-4 pb-4">
        <AnimatePresence mode="popLayout">
          {bookings.length > 0 ? (
            bookings.map((b) => {
              const ui = getStatusUI(b.meeting_status);
              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={b.id} 
                  className="bg-white/[0.02] border border-white/5 rounded-[2.2rem] p-6 hover:border-brand-purple/20 transition-all"
                >
                  {/* Top: User and Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {b.user_profiles?.avatar_url ? (
                         <img src={b.user_profiles.avatar_url} className="w-11 h-11 rounded-2xl object-cover border border-white/10" alt="" />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-brand-purple/10 flex items-center justify-center text-brand-purple font-black border border-brand-purple/20 uppercase">
                          {b.user_profiles?.full_name[0]}
                        </div>
                      )}
                      <div>
                        <h4 className="font-black text-sm tracking-tight capitalize">{b.user_profiles?.full_name}</h4>
                        <div className={`mt-1 px-2 py-0.5 rounded-lg border text-[8px] font-black w-fit tracking-widest ${ui.color} capitalize`}>
                          {ui.label}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-primary-gradient font-black text-[16px] leading-none">₹{b.total_price}</p>
                      <p className="text-[9px] text-zinc-600 font-bold mt-1 capitalize">{b.payment_status}</p>
                    </div>
                  </div>

                  {/* Booking Timestamp */}
                  <div className="flex items-center gap-1.5 mb-5 px-1">
                    <Info size={10} className="text-zinc-600" />
                    <p className="text-[9px] text-zinc-500 font-bold tracking-tight">
                      Booked on {formatBookingDate(b.created_at)}
                    </p>
                  </div>

                  {/* Services Tags */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {b.services?.map((s: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-white/5 rounded-xl text-[9px] font-bold text-zinc-400 border border-white/5 capitalize">{s}</span>
                    ))}
                  </div>

                  {/* Logistics Info Cards */}
                  <div className="space-y-3">
                     <div className="p-4 bg-black/40 rounded-2xl flex items-center justify-between border border-white/5">
                        <div className="flex items-center gap-3">
                          <Calendar size={16} className="text-brand-purple" />
                          <span className="text-[11px] font-bold text-zinc-300">{b.meeting_date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Clock size={16} className="text-brand-purple" />
                          <span className="text-[11px] font-bold text-zinc-300">
                            {formatMeetingTime(b.start_time)} - {formatMeetingTime(b.end_time)}
                          </span>
                        </div>
                     </div>
                     
                     <div className="p-4 bg-black/40 rounded-2xl flex items-center gap-3 border border-white/5">
                        <MapPin size={16} className="text-brand-purple" />
                        <span className="text-[11px] font-bold text-zinc-300 truncate capitalize">{b.place}</span>
                     </div>

                     {/* Progress Indicator */}
                     {b.meeting_status === 'completed' ? (
                       <div className="w-full py-4 bg-emerald-500/5 text-emerald-500/50 rounded-2xl font-black text-[10px] tracking-widest text-center flex items-center justify-center gap-2">
                         <ShieldCheck size={14} /> Earnings released
                       </div>
                     ) : (
                       <div className="w-full py-4 bg-white/5 text-zinc-600 rounded-2xl font-black text-[9px] tracking-widest text-center">
                         You get payment once meeting is completed
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
              <p className="text-zinc-600 font-bold text-[10px] tracking-widest">No appointments found</p>
              <p className="text-zinc-500 text-xs mt-2 font-medium">Changes here reflect live database updates</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}