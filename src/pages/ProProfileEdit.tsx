import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, Check, Loader2, Clock, ChevronRight, X, Globe } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const initialWorkingHours = {
  Monday: { active: true, start: '09:00', end: '18:00' },
  Tuesday: { active: true, start: '09:00', end: '18:00' },
  Wednesday: { active: true, start: '09:00', end: '18:00' },
  Thursday: { active: true, start: '09:00', end: '18:00' },
  Friday: { active: true, start: '09:00', end: '18:00' },
  Saturday: { active: false, start: '10:00', end: '15:00' },
  Sunday: { active: false, start: '10:00', end: '15:00' }
};

export default function ProProfileEdit() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>({
    full_name: '', 
    profession: '', 
    bio: '', 
    price_per_hour: '', 
    services: '', 
    avatar_url: '',
    working_hours: initialWorkingHours
  });

  useEffect(() => {
    const handleBack = () => {
      if (showHoursModal) {
        setShowHoursModal(false);
      } else {
        navigate(-1);
      }
    };
    const capListener = CapApp.addListener('backButton', handleBack);
    window.addEventListener('popstate', handleBack);
    return () => { capListener.then(l => l.remove()); window.removeEventListener('popstate', handleBack); };
  }, [navigate, showHoursModal]);

  useEffect(() => {
    const fetchProfile = async () => {
      const phone = localStorage.getItem('sb_user_phone');
      const { data } = await supabase.from('pro_profiles').select('*').eq('phone', phone).single();
      if (data) {
        setProfile({
          ...data,
          services: Array.isArray(data.services) ? data.services.join(', ') : '',
          working_hours: data.working_hours && Object.keys(data.working_hours).length > 0 ? data.working_hours : initialWorkingHours
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      setSaving(true);
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      // Update state
      setProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      
      // Instantly update DB to reflect photo change to users
      await supabase.from('pro_profiles').update({ 
        avatar_url: publicUrl,
        updated_at: new Date().toISOString() 
      }).eq('id', profile.id);
      
      setLastSynced(new Date().toLocaleTimeString());
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const toggleDay = (day: string) => {
    setProfile((prev: any) => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: {
          ...prev.working_hours[day],
          active: !prev.working_hours[day].active
        }
      }
    }));
  };

  const handleTimeChange = (day: string, field: 'start' | 'end', value: string) => {
    setProfile((prev: any) => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: {
          ...prev.working_hours[day],
          [field]: value
        }
      }
    }));
  };

  const handleSaveHours = async () => {
    setSaving(true);
    // Explicitly add updated_at to trigger Realtime broadcast to users
    const { error } = await supabase
      .from('pro_profiles')
      .update({ 
        working_hours: profile.working_hours,
        updated_at: new Date().toISOString() 
      })
      .eq('id', profile.id);

    if (!error) {
      setLastSynced(new Date().toLocaleTimeString());
      setShowHoursModal(false);
    } else {
      alert("Error saving schedule: " + error.message);
    }
    setSaving(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const servicesArray = profile.services.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
    
    // Explicitly add updated_at to ensure Realtime replication pings all user apps
    const { error } = await supabase.from('pro_profiles').update({
      full_name: profile.full_name,
      profession: profile.profession,
      bio: profile.bio,
      price_per_hour: parseInt(profile.price_per_hour),
      services: servicesArray,
      avatar_url: profile.avatar_url,
      working_hours: profile.working_hours,
      updated_at: new Date().toISOString()
    }).eq('id', profile.id);

    if (!error) {
      setLastSynced(new Date().toLocaleTimeString());
      setTimeout(() => navigate(-1), 800); // Slight delay so they see the success state
    } else {
      alert("Error saving profile: " + error.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-brand-purple" /></div>;

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden">
      <nav className="shrink-0 z-[100] bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-6 pb-4 pt-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl border border-white/5 active:scale-90 transition-all"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-black tracking-tight">Edit <span className="text-primary-gradient">Profile</span></h1>
      </nav>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar pb-10">
        {/* Profile Photo Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-[2.5rem] overflow-hidden border-2 border-brand-purple/30 bg-white/5 shadow-2xl">
              <img src={profile.avatar_url || 'https://placehold.co/150/111/fff?text=Pro'} className="w-full h-full object-cover" alt="" />
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-3 bg-brand-purple rounded-2xl shadow-lg active:scale-90 transition-transform"><Camera size={18} /></button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </div>
          <p className="text-[10px] font-black text-zinc-600 tracking-widest uppercase">Tap camera to change photo</p>
        </div>

        {/* Basic Info Section */}
        <div className="space-y-5">
          <InputField label="Full name" value={profile.full_name} onChange={(v) => setProfile({...profile, full_name: v})} />
          <InputField label="Profession title" value={profile.profession} onChange={(v) => setProfile({...profile, profession: v})} />
          <InputField label="Hourly rate (₹)" value={profile.price_per_hour} onChange={(v) => setProfile({...profile, price_per_hour: v})} />
          
          <div className="space-y-2">
            <label className="text-[9px] font-black text-zinc-600 ml-4 tracking-widest uppercase">About me</label>
            <textarea 
              value={profile.bio} 
              onChange={(e) => setProfile({...profile, bio: e.target.value})} 
              className="w-full bg-white/5 border border-white/10 rounded-[1.8rem] p-5 text-sm font-bold outline-none focus:border-brand-purple/50 min-h-[120px] resize-none"
              placeholder="Tell clients about your experience..."
            />
          </div>

          <InputField label="Services (Separate with commas)" value={profile.services} onChange={(v) => setProfile({...profile, services: v})} />

          {/* New Optimized Working Hours Trigger */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-zinc-600 ml-4 tracking-widest uppercase">Schedule & Availability</label>
            <button 
              onClick={() => setShowHoursModal(true)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-pink/10 text-brand-pink rounded-xl group-hover:bg-brand-pink/20 transition-colors">
                  <Clock size={20} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-white">Working Hours</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Set your weekly shift timings</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-zinc-600 group-hover:text-brand-pink transition-colors" />
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="space-y-4">
          <button 
            onClick={handleSave} 
            disabled={saving} 
            className="w-full py-5 bg-primary-gradient rounded-[2rem] font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 
            {lastSynced && !saving ? 'Saved & Synced' : 'Save changes'}
          </button>
          
          {lastSynced && (
            <p className="text-center text-[9px] font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
              Users notified at {lastSynced}
            </p>
          )}
        </div>
      </main>

      {/* FULL PAGE WORKING HOURS MODAL */}
      <AnimatePresence>
        {showHoursModal && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[200] bg-[#0a0a0a] flex flex-col"
          >
            <nav className="shrink-0 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 px-6 pb-4 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowHoursModal(false)} className="p-2 bg-white/5 rounded-xl border border-white/5 active:scale-90 transition-all text-zinc-400">
                  <X size={20} />
                </button>
                <h2 className="text-xl font-black">Working <span className="bg-primary-gradient bg-clip-text text-transparent">Hours</span></h2>
              </div>
              
              <button 
                onClick={handleSaveHours}
                disabled={saving}
                className="px-5 py-2.5 bg-brand-pink text-black text-[10px] font-black uppercase rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : 'Done'}
              </button>
            </nav>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 hide-scrollbar">
              <div className="bg-brand-pink/5 border border-brand-pink/10 rounded-2xl p-4 mb-6">
                <p className="text-[11px] font-bold text-brand-pink text-center leading-relaxed">
                  Toggle the days you are available and set your preferred start and end times for client bookings.
                </p>
              </div>

              {DAYS_OF_WEEK.map(day => {
                const wh = profile.working_hours[day];
                return (
                  <div key={day} className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-5 flex flex-col gap-4 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl transition-colors ${wh.active ? 'bg-brand-pink/10 text-brand-pink' : 'bg-white/5 text-zinc-600'}`}>
                          <Clock size={16} />
                        </div>
                        <span className={`font-black text-sm ${wh.active ? 'text-white' : 'text-zinc-500'}`}>{day}</span>
                      </div>
                      
                      <button 
                        onClick={() => toggleDay(day)} 
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center shadow-inner ${wh.active ? 'bg-brand-pink' : 'bg-white/10'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute shadow-md transition-all ${wh.active ? 'left-[24px]' : 'left-1'}`} />
                      </button>
                    </div>

                    <AnimatePresence>
                      {wh.active && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: 'auto', opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex gap-3 items-center border-t border-white/5 pt-4 mt-1">
                            <div className="flex-1 space-y-1.5">
                              <label className="text-[8px] font-black text-zinc-600 uppercase ml-1">Start Time</label>
                              <input 
                                type="time" 
                                value={wh.start} 
                                onChange={e => handleTimeChange(day, 'start', e.target.value)} 
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-brand-pink text-white [color-scheme:dark] font-bold" 
                              />
                            </div>
                            <div className="pt-5 px-1 text-[9px] font-black text-zinc-700">TO</div>
                            <div className="flex-1 space-y-1.5">
                              <label className="text-[8px] font-black text-zinc-600 uppercase ml-1">End Time</label>
                              <input 
                                type="time" 
                                value={wh.end} 
                                onChange={e => handleTimeChange(day, 'end', e.target.value)} 
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-brand-pink text-white [color-scheme:dark] font-bold" 
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InputField({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black text-zinc-600 ml-4 tracking-widest uppercase">{label}</label>
      <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
        <input 
          value={value} 
          onChange={(e) => onChange(e.target.value)} 
          className="w-full bg-transparent text-sm font-bold outline-none text-white" 
        />
      </div>
    </div>
  );
}
