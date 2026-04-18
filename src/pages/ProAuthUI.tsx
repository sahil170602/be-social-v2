import React, { useState, useRef } from 'react';
import { Phone, ArrowLeft, ArrowRight, Briefcase, Camera, X, Plus, DollarSign, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import { supabase } from '../lib/supabaseClient';

const CATEGORIES = [
  'UI/UX Designer', 'Full Stack Developer', 'Event Planner', 
  'Photographer', 'Digital Marketer', 'DevOps Engineer', 
  'Illustrator', 'Fitness Coach', 'Content Strategist', 'Video Editor', 'Other'
];

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

export default function ProAuthUI({ phone, setPhone, step, setStep, loading, handleCheckUser, accentBg, shadowGlow }: any) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    age: '',
    gender: '',
    avatar_url: '',
    profession: '',
    custom_profession: '',
    services: [] as string[],
    price_per_hour: '',
    bio: '',
    working_hours: initialWorkingHours
  });

  const [currentService, setCurrentService] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const addService = () => {
    if (currentService.trim() && !formData.services.includes(currentService.trim())) {
      setFormData({ ...formData, services: [...formData.services, currentService.trim()] });
      setCurrentService('');
    }
  };

  const removeService = (srv: string) => {
    setFormData({ ...formData, services: formData.services.filter(s => s !== srv) });
  };

  const toggleDay = (day: string) => {
    setFormData({
      ...formData,
      working_hours: {
        ...formData.working_hours,
        [day as keyof typeof formData.working_hours]: {
          ...formData.working_hours[day as keyof typeof formData.working_hours],
          active: !formData.working_hours[day as keyof typeof formData.working_hours].active
        }
      }
    });
  };

  const handleTimeChange = (day: string, field: 'start' | 'end', value: string) => {
    setFormData({
      ...formData,
      working_hours: {
        ...formData.working_hours,
        [day as keyof typeof formData.working_hours]: {
          ...formData.working_hours[day as keyof typeof formData.working_hours],
          [field]: value
        }
      }
    });
  };

  const handleCompleteRegistration = async () => {
    setIsSubmitting(true);
    const finalProfession = formData.profession === 'Other' ? formData.custom_profession : formData.profession;

    const { error } = await supabase
      .from('pro_profiles')
      .insert([{
        phone: phone,
        full_name: formData.full_name,
        email: formData.email,
        age: parseInt(formData.age),
        gender: formData.gender,
        avatar_url: formData.avatar_url,
        profession: finalProfession,
        services: formData.services,
        price_per_hour: parseInt(formData.price_per_hour),
        bio: formData.bio,
        working_hours: formData.working_hours, // Saves the complete JSON schedule
        rating: 5.0
      }]);

    if (!error) {
      localStorage.setItem('sb_user_phone', phone);
      window.location.href = '/pro-dashboard';
    } else {
      alert("Error: " + error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="z-10 w-full max-w-md">
      <div className="text-center mb-10">
        <Briefcase className="mx-auto text-brand-pink mb-4" size={40} />
        <h1 className="text-4xl font-black tracking-tight mb-2 ">Pro Registration</h1>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1 w-8 rounded-full transition-all duration-500 ${step >= i ? 'bg-brand-pink' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>

      <GlassCard className={`border-white/5 p-8 ${shadowGlow} border-l-2 border-l-brand-pink/30`}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <label className="text-[14px] font-black text-zinc-500  tracking-wide ml-1">Mobile Number</label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input 
                    type="tel" 
                    value={phone} 
                    required 
                    autoFocus
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="Enter 10 digit number"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-12 pr-4 outline-none focus:border-brand-pink/50 text-base font-bold tracking-wider" 
                  />
                </div>
              </div>
              <button 
                onClick={handleCheckUser}
                disabled={loading || phone.length < 10} 
                className={`w-full flex items-center justify-center gap-3 ${accentBg} py-5 rounded-2xl font-black uppercase text-black active:scale-95 transition-all disabled:opacity-30`}
              >
                {loading ? 'Verifying...' : 'Continue'} <ArrowRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center">
                <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer overflow-hidden relative group">
                  {formData.avatar_url ? <img src={formData.avatar_url} className="w-full h-full object-cover" /> : <Camera className="text-zinc-500" />}
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                </div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase mt-2">Profile Photo</p>
              </div>
              <input type="text" placeholder="Full Name" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/10 focus:border-brand-pink/50" />
              <input type="email" placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/10 focus:border-brand-pink/50" />
              <div className="flex gap-4">
                <input type="number" placeholder="Age" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-1/2 bg-white/5 p-4 rounded-xl outline-none border border-white/10" />
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-1/2 bg-white/5 p-4 rounded-xl outline-none border border-white/10 text-zinc-400">
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <button onClick={() => setStep(3)} className={`w-full ${accentBg} py-5 rounded-2xl font-black uppercase text-black`}>Next Step</button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <select value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/10">
                <option value="">Select Profession</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {formData.profession === 'Other' && (
                <input type="text" placeholder="Enter your profession" value={formData.custom_profession} onChange={e => setFormData({...formData, custom_profession: e.target.value})} className="w-full bg-white/5 p-4 rounded-xl border border-brand-pink/50 outline-none" />
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="text" placeholder="Add Service (e.g. Bug Fixing)" value={currentService} onChange={e => setCurrentService(e.target.value)} className="flex-1 bg-white/5 p-4 rounded-xl outline-none border border-white/10" />
                  <button onClick={addService} className="bg-brand-pink text-black p-4 rounded-xl active:scale-90 transition-transform"><Plus size={20}/></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.services.map(s => (
                    <span key={s} className="bg-white/10 border border-white/10 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2">
                      {s} <X size={12} className="text-brand-pink cursor-pointer" onClick={() => removeService(s)} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input type="number" placeholder="Price Per Hour (₹)" value={formData.price_per_hour} onChange={e => setFormData({...formData, price_per_hour: e.target.value})} className="w-full bg-white/5 py-4 pl-12 pr-4 rounded-xl outline-none border border-white/10" />
              </div>

              <textarea placeholder="Bio / Experience..." value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-white/5 p-4 rounded-xl h-24 outline-none border border-white/10 resize-none" />

              <button onClick={() => setStep(4)} className={`w-full ${accentBg} py-5 rounded-2xl font-black uppercase text-black`}>
                Next: Availability
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-white">Availability</h2>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Set your working hours</p>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
                {DAYS_OF_WEEK.map(day => {
                  const wh = formData.working_hours[day as keyof typeof formData.working_hours];
                  return (
                    <div key={day} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 transition-colors hover:bg-white/10">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Clock size={16} className={wh.active ? 'text-brand-pink' : 'text-zinc-600'} />
                          <span className={`font-bold text-sm ${wh.active ? 'text-white' : 'text-zinc-500'}`}>{day}</span>
                        </div>
                        
                        {/* Custom Toggle Switch */}
                        <button 
                          onClick={() => toggleDay(day)} 
                          className={`w-11 h-6 rounded-full transition-colors relative flex items-center shadow-inner ${wh.active ? 'bg-brand-pink' : 'bg-white/10'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute shadow-md transition-all ${wh.active ? 'left-[24px]' : 'left-1'}`} />
                        </button>
                      </div>

                      {wh.active && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex gap-2 items-center border-t border-white/5 pt-3 mt-1">
                          <input 
                            type="time" 
                            value={wh.start} 
                            onChange={e => handleTimeChange(day, 'start', e.target.value)} 
                            className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs flex-1 outline-none focus:border-brand-pink text-white [color-scheme:dark]" 
                          />
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">To</span>
                          <input 
                            type="time" 
                            value={wh.end} 
                            onChange={e => handleTimeChange(day, 'end', e.target.value)} 
                            className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs flex-1 outline-none focus:border-brand-pink text-white [color-scheme:dark]" 
                          />
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex gap-3">
                <button onClick={() => setStep(3)} className="w-16 flex items-center justify-center bg-white/5 py-5 rounded-2xl text-white active:scale-95 transition-all">
                  <ArrowLeft size={20} />
                </button>
                <button onClick={handleCompleteRegistration} disabled={isSubmitting} className={`flex-1 ${accentBg} py-5 rounded-2xl font-black uppercase text-black active:scale-95 transition-all`}>
                  {isSubmitting ? 'Finalizing...' : 'Complete Setup'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </div>
  );
}

