import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, Calendar as CalIcon, Clock, MapPin, 
  ChevronDown, Check, Briefcase, AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [pro, setPro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  
  // Refs for outside click detection
  const locationRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  
  // Helper to get local YYYY-MM-DD string
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => getLocalDateString(), []);

  // --- States ---
  const [date, setDate] = useState(todayStr);
  const [bookedMeetings, setBookedMeetings] = useState<any[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<any[]>([]); // Array for multi-select
  const [place, setPlace] = useState('Physical meeting'); 
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  // UI States
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);

  const locations = ['Online session', 'Physical meeting'];

  // --- 1. Initial Fetch & Outside Click Logic ---
  useEffect(() => {
    const fetchPro = async () => {
      const { data } = await supabase.from('pro_profiles').select('*').eq('id', id).single();
      if (data) setPro(data);
      setLoading(false);
    };
    fetchPro();

    const backListener = CapApp.addListener('backButton', () => navigate(-1));
    
    // Outside click listener
    const handleClickOutside = (event: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
        setIsLocationOpen(false);
      }
      if (servicesRef.current && !servicesRef.current.contains(event.target as Node)) {
        setIsServicesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => { 
      backListener.then(l => l.remove()); 
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [id, navigate]);

  // --- 2. Fetch Existing Bookings for Selected Date ---
  useEffect(() => {
    if (!id || !date) return;

    const fetchAvailability = async () => {
      setFetchingSlots(true);
      const { data } = await supabase
        .from('meetings')
        .select('start_time, end_time')
        .eq('pro_id', id)
        .eq('meeting_date', date)
        .not('meeting_status', 'in', '("cancelled", "rejected")'); 

      if (data) setBookedMeetings(data);
      setSelectedSlots([]); // Reset selection when date changes
      setFetchingSlots(false);
    };

    fetchAvailability();
  }, [date, id]);

  // --- 3. Generate Hourly Slots Based on Shift & Current Time ---
  const slots = useMemo(() => {
    if (!pro?.working_hours || !date) return [];

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const selectedDateObj = new Date(date);
    const selectedDayName = days[selectedDateObj.getDay()];
    const shift = pro.working_hours[selectedDayName];

    if (!shift || !shift.active) return [];

    const now = new Date();
    const isToday = date === todayStr;
    const currentHour = now.getHours();

    const generated = [];
    let startHour = parseInt(shift.start.split(':')[0]);
    const endHour = parseInt(shift.end.split(':')[0]);

    // If booking for today, start showing slots only after current hour
    let current = isToday ? Math.max(startHour, currentHour + 1) : startHour;

    while (current < endHour) {
      const startStr = `${current.toString().padStart(2, '0')}:00`;
      const endStr = `${(current + 1).toString().padStart(2, '0')}:00`;
      
      const isBooked = bookedMeetings.some(m => {
        return (m.start_time < endStr && m.end_time > startStr);
      });

      generated.push({
        start: startStr,
        end: endStr,
        isBooked
      });
      current++;
    }

    return generated;
  }, [pro, date, bookedMeetings, todayStr]);

  const toggleSlot = (slot: any) => {
    setSelectedSlots(prev => {
      const exists = prev.find(s => s.start === slot.start);
      if (exists) {
        return prev.filter(s => s.start !== slot.start);
      }
      return [...prev, slot].sort((a, b) => a.start.localeCompare(b.start));
    });
  };

  const totalPrice = useMemo(() => {
    if (selectedSlots.length === 0 || !pro?.price_per_hour) return 0;
    return selectedSlots.length * pro.price_per_hour;
  }, [selectedSlots, pro]);

  const handleBooking = async () => {
    if (!date || selectedSlots.length === 0 || selectedServices.length === 0 || !pro) return;
    
    const sorted = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
    const finalStartTime = sorted[0].start;
    const finalEndTime = sorted[sorted.length - 1].end;

    // Route to checkout with the necessary payload
    navigate(`/checkout/${pro.id}`, {
      state: { 
        date, 
        startTime: finalStartTime, 
        endTime: finalEndTime, 
        place, 
        services: selectedServices, 
        totalPrice, 
        basePrice: pro.price_per_hour,
        slotCount: selectedSlots.length
      }
    });
  };

  const formatDisplayTime = (time: string) => {
    const [h, m] = time.split(':');
    let hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  if (loading) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden selection:bg-brand-purple/20 antialiased relative">
      
      {/* Background ambient glow - matching Checkout */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-brand-purple/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-brand-pink/5 blur-[100px] pointer-events-none" />

      {/* Fixed Header */}
      <header className="shrink-0 flex items-center gap-4 p-6 bg-[#0a0a0a]/10 backdrop-blur-md border-b border-white/5 z-[100] relative">
        <button onClick={() => navigate(-1)} className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black tracking-tight capitalize">Confirm <span className=" bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent">booking</span></h1>
      </header>

      {/* Scrollable Content Body */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar pb-12 relative z-10">
        
        {/* Pro Quick Card */}
        <div className="flex items-center gap-4 p-5 bg-white/[0.03] border border-white/5 rounded-[2.5rem] shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-zinc-900 shadow-lg">
             <img 
               src={pro?.avatar_url || `https://ui-avatars.com/api/?name=${pro?.full_name}&background=6366f1&color=fff`} 
               className="w-full h-full object-cover" 
               alt="" 
               onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${pro?.full_name}&background=6366f1&color=fff`)}
             />
          </div>
          <div>
            <h3 className="font-black text-lg leading-tight capitalize">{pro?.full_name}</h3>
            <p className="text-brand-purple text-sm font-bold mt-1 capitalize">{pro?.profession}</p>
          </div>
        </div>

        {/* 1. Date Selection */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-500 ml-4 tracking-tight capitalize">1. Select date</p>
          <div className="relative">
            <CalIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-purple" size={18} />
            <input 
              type="date" 
              min={todayStr} 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-5 pl-14 pr-5 outline-none focus:border-brand-purple/50 text-sm font-bold [color-scheme:dark] shadow-inner" 
            />
          </div>
        </div>

        {/* 2. Time Slot Grid */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-4">
             <p className="text-[10px] font-bold text-zinc-500 tracking-tight capitalize">2. Available slots</p>
             {fetchingSlots && <Loader2 size={12} className="animate-spin text-zinc-500" />}
          </div>

          {slots.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 px-1">
               {slots.map((slot, idx) => {
                 const isSelected = selectedSlots.some(s => s.start === slot.start);
                 return (
                   <button
                     key={idx}
                     disabled={slot.isBooked}
                     onClick={() => toggleSlot(slot)}
                     className={`relative py-4 rounded-2xl border text-[11px] font-black transition-all flex flex-col items-center justify-center gap-1
                       ${slot.isBooked 
                         ? 'bg-red-500/5 border-red-500/10 text-zinc-700 cursor-not-allowed grayscale' 
                         : isSelected
                           ? 'bg-primary-gradient border-transparent text-white shadow-lg shadow-brand-purple/20 scale-95'
                           : 'bg-white/5 border-white/10 text-zinc-400 hover:border-brand-purple/30 active:scale-95'
                       }
                     `}
                   >
                      {slot.isBooked && <div className="absolute top-1 right-2 text-[7px] text-red-500/50 capitalize tracking-tighter">Booked</div>}
                      <span className="capitalize">{formatDisplayTime(slot.start)}</span>
                   </button>
                 );
               })}
            </div>
          ) : (
            <div className="p-10 bg-white/[0.02] rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center text-center gap-3">
               <AlertCircle className="text-zinc-600" size={32} />
               <p className="text-zinc-500 text-xs font-bold leading-relaxed capitalize">
                 No slots available for this day.<br/>Please try another date.
               </p>
            </div>
          )}
        </div>

        {/* 3. Location Dropdown */}
        <div className="space-y-3 relative z-30" ref={locationRef}>
          <p className="text-[10px] font-bold text-zinc-500 ml-4 tracking-tight capitalize">3. Meeting place</p>
          <button type="button" onClick={() => { setIsLocationOpen(!isLocationOpen); setIsServicesOpen(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-5 px-5 flex items-center justify-between transition-all active:scale-[0.98] shadow-inner"
          >
            <div className="flex items-center gap-3"><MapPin size={18} className="text-brand-purple" /><span className="text-sm font-bold capitalize">{place}</span></div>
            <motion.div animate={{ rotate: isLocationOpen ? 180 : 0 }}><ChevronDown size={18} className="text-zinc-500" /></motion.div>
          </button>
          <AnimatePresence>
            {isLocationOpen && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 5 }} exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 bg-[#151515] border border-white/10 rounded-[2rem] p-2 shadow-2xl z-[40]"
              >
                {locations.map((loc) => (
                  <button key={loc} onClick={() => { setPlace(loc); setIsLocationOpen(false); }}
                    className={`w-full text-left px-5 py-4 rounded-2xl text-[11px] font-black capitalize transition-all ${place === loc ? 'bg-primary-gradient text-white shadow-lg' : 'text-zinc-500 hover:bg-white/5'}`}
                  >
                    {loc}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4. Services Dropdown */}
        <div className="space-y-3 relative z-20" ref={servicesRef}>
          <p className="text-[10px] font-bold text-zinc-500 ml-4 tracking-tight capitalize">4. Select services</p>
          <button type="button" onClick={() => { setIsServicesOpen(!isServicesOpen); setIsLocationOpen(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-[1.5rem] py-5 px-5 flex items-center justify-between active:scale-[0.98] shadow-inner"
          >
            <div className="flex items-center gap-3"><Briefcase size={18} className="text-brand-purple" /><span className="text-sm font-bold capitalize">{selectedServices.length === 0 ? 'Choose services...' : `${selectedServices.length} selected`}</span></div>
            <motion.div animate={{ rotate: isServicesOpen ? 180 : 0 }}><ChevronDown size={18} className="text-zinc-500" /></motion.div>
          </button>
          <AnimatePresence>
            {isServicesOpen && pro?.services && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 5 }} exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 bg-[#151515] border border-white/10 rounded-[2rem] p-2 shadow-2xl z-[40] max-h-60 overflow-y-auto"
              >
                {pro.services.map((service: string) => (
                  <button key={service} onClick={() => setSelectedServices(prev => prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service])}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[11px] font-black capitalize transition-all ${selectedServices.includes(service) ? 'bg-primary-gradient text-white' : 'text-zinc-500 hover:bg-white/5'}`}
                  >
                    <span className="capitalize">{service}</span>
                    {selectedServices.includes(service) && <Check size={14} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Summary & Price */}
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] mt-10 shadow-2xl space-y-4 backdrop-blur-sm">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-zinc-400 font-bold text-sm capitalize">Session duration</span>
                <span className="text-white font-black text-sm capitalize">{selectedSlots.length} {selectedSlots.length === 1 ? 'hour' : 'hours'}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-lg font-bold capitalize">Booking total</span>
                <span className="text-3xl font-black text-primary-gradient tracking-tighter">₹{totalPrice}</span>
            </div>
        </div>

        <button 
          onClick={handleBooking} 
          disabled={!date || selectedSlots.length === 0 || selectedServices.length === 0}
          className="w-full bg-primary-gradient py-6 rounded-[2rem] font-bold text-sm tracking-widest shadow-2xl shadow-brand-purple/20 active:scale-95 transition-all text-white disabled:bg-zinc-800 disabled:opacity-30 capitalize"
        >
          Confirm appointment <ShieldCheck size={20} className="inline ml-2" />
        </button>
      </main>

    </div>
  );
}

function ShieldCheck({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} height={size} viewBox="0 0 24 24" fill="none" 
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}