import React, { useState, useRef } from 'react';
import { Phone, ArrowLeft, ArrowRight, Briefcase, Camera, X, Plus, DollarSign, Clock, Key, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import { supabase } from '../lib/supabaseClient';

// Firebase Imports
import { auth } from '../lib/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";

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

export default function ProAuthUI({ accentBg, shadowGlow }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<any>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    age: '',
    gender: '',
    profession: '',
    custom_profession: '',
    services: [] as string[],
    price_per_hour: '',
    bio: '',
    working_hours: initialWorkingHours
  });

  const [image, setImage] = useState<File | null>(null);
  const [currentService, setCurrentService] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FIREBASE AUTH ---
  const setupRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const handleSendOtp = async () => {
    if (phone.length < 10) return alert("Please enter a valid phone number.");
    setLoading(true);
    try {
      setupRecaptcha();
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaRef.current);
      setConfirmationResult(result);
      setStep(2);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const userCredential = await confirmationResult?.confirm(otp);
      
      // FIREBASE VERIFIED PHONE (Always includes +91)
      const verifiedPhone = userCredential?.user.phoneNumber; 

      if (!verifiedPhone) throw new Error("Could not verify phone number.");

      // 1. Check if professional exists in 'pro_profiles' using the verified number
      const { data: pro, error } = await supabase
        .from('pro_profiles')
        .select('id')
        .eq('phone', verifiedPhone)
        .maybeSingle();

      if (error) throw error;

      if (pro) {
        // PRO EXISTS: Save verified number and redirect
        localStorage.setItem('sb_user_phone', verifiedPhone);
        window.location.href = '/pro-dashboard';
      } else {
        // NEW PRO: Proceed to Personal Details
        setStep(3); 
      }
    } catch (err: any) {
      alert("Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- REGISTRATION LOGIC ---
  const handleCompleteRegistration = async () => {
    setLoading(true);
    try {
      // Direct pull from Firebase session to ensure +91 is saved
      const finalPhone = auth.currentUser?.phoneNumber || (phone.startsWith('+') ? phone : `+91${phone}`);

      let avatarUrl = "";
      if (image) {
        const filePath = `pro_avatars/${Date.now()}_${image.name}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, image);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      const finalProfession = formData.profession === 'Other' ? formData.custom_profession : formData.profession;

      // 2. Insert into Pro Profiles (Saves with country code)
      const { error: insertError } = await supabase.from('pro_profiles').insert([{
        phone: finalPhone,
        full_name: formData.full_name,
        email: formData.email,
        age: parseInt(formData.age),
        gender: formData.gender,
        avatar_url: avatarUrl,
        profession: finalProfession,
        services: formData.services,
        price_per_hour: parseInt(formData.price_per_hour),
        bio: formData.bio,
        working_hours: formData.working_hours,
        rating: 5.0
      }]);

      if (insertError) throw insertError;

      localStorage.setItem('sb_user_phone', finalPhone);
      window.location.href = '/pro-dashboard';
    } catch (err: any) {
      alert("Registration Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addService = () => {
    if (currentService.trim()) {
      setFormData({ ...formData, services: [...formData.services, currentService.trim()] });
      setCurrentService('');
    }
  };

  const toggleDay = (day: string) => {
    const wh = formData.working_hours[day as keyof typeof formData.working_hours];
    setFormData({
      ...formData,
      working_hours: { ...formData.working_hours, [day]: { ...wh, active: !wh.active } }
    });
  };

  return (
    <div className="z-10 w-full max-w-md px-4">
      <div id="recaptcha-container"></div>

      <div className="text-center mb-10">
        <Briefcase className="mx-auto text-brand-pink mb-4" size={40} />
        <h1 className="text-4xl font-black tracking-tight mb-2 ">Pro <span className="text-brand-pink">Registry</span></h1>
        <div className="flex justify-center gap-2 mt-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-1.5 w-6 rounded-full transition-all duration-500 ${step >= i ? 'bg-brand-pink shadow-[0_0_10px_rgba(236,72,153,0.3)]' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>

      <GlassCard className={`border-white/5 p-8 ${shadowGlow} border-l-2 border-l-brand-pink/30`}>
        <AnimatePresence mode="wait">
          {/* STEP 1: PHONE */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[12px] font-black text-zinc-500 uppercase tracking-widest ml-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter Phone Number" className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-14 pr-4 outline-none focus:border-brand-pink/50 text-lg font-bold text-white" />
                </div>
              </div>
              <button onClick={handleSendOtp} disabled={loading || phone.length < 10} className={`w-full flex items-center justify-center gap-3 ${accentBg} py-5 rounded-2xl font-black uppercase text-black active:scale-95 transition-all disabled:opacity-30`}>
                {loading ? <Loader2 className="animate-spin" /> : 'Send OTP'} <ArrowRight size={20} />
              </button>
            </motion.div>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[12px] font-black text-zinc-500 uppercase tracking-widest ml-1">Verification Code</label>
                <div className="relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
                  <input 
                    type="text" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} placeholder="••••••" 
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 px-14 outline-none focus:border-brand-pink/50 text-2xl font-black tracking-[0.4em] text-center text-white" 
                  />
                </div>
              </div>
              <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} className={`w-full flex items-center justify-center gap-3 ${accentBg} py-5 rounded-2xl font-black uppercase text-black active:scale-95 transition-all`}>
                {loading ? <Loader2 className="animate-spin" /> : 'Verify Account'} <ArrowRight size={20} />
              </button>
            </motion.div>
          )}

          {/* STEP 3: PERSONAL DETAILS */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
               <div className="flex flex-col items-center">
                <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-3xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center cursor-pointer overflow-hidden relative group">
                  {image ? <img src={URL.createObjectURL(image)} className="w-full h-full object-cover" alt="Pro" /> : <Camera className="text-zinc-500" size={32} />}
                  <input type="file" ref={fileInputRef} onChange={e => setImage(e.target.files?.[0] || null)} className="hidden" accept="image/*" />
                </div>
                <p className="text-[10px] font-black text-zinc-500 uppercase mt-3 tracking-widest">Profile Photo</p>
              </div>
              <input type="text" placeholder="Full Name" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-white/5 p-5 rounded-2xl border border-white/10 outline-none focus:border-brand-pink/50 font-bold text-white" />
              <input type="email" placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-white/5 p-5 rounded-2xl border border-white/10 outline-none focus:border-brand-pink/50 font-bold text-white" />
              <div className="flex gap-4">
                <input type="number" placeholder="Age" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-1/2 bg-white/5 p-5 rounded-2xl border border-white/10 outline-none text-white" />
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-1/2 bg-black/40 p-5 rounded-2xl border border-white/10 outline-none text-zinc-400">
                  <option value="">Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <button onClick={() => setStep(4)} className={`w-full ${accentBg} py-5 rounded-2xl font-black uppercase text-black shadow-xl`}>Next: Skills</button>
            </motion.div>
          )}

          {/* STEP 4: PROFESSIONAL DETAILS */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
               <select value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} className="w-full bg-black/40 p-5 rounded-2xl border border-white/10 outline-none text-white">
                <option value="">Select Profession</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="Service (e.g. Bug Fixing)" value={currentService} onChange={e => setCurrentService(e.target.value)} className="flex-1 bg-white/5 p-5 rounded-2xl border border-white/10 outline-none text-white" />
                  <button onClick={addService} className="bg-brand-pink text-black p-5 rounded-2xl active:scale-90 transition-transform"><Plus size={24}/></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.services.map(s => (
                    <span key={s} className="bg-brand-pink/10 border border-brand-pink/20 px-4 py-2 rounded-full text-[11px] font-black text-brand-pink flex items-center gap-2">
                      {s} <X size={14} className="cursor-pointer" onClick={() => setFormData({...formData, services: formData.services.filter(x => x !== s)})} />
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input type="number" placeholder="Price Per Hour (₹)" value={formData.price_per_hour} onChange={e => setFormData({...formData, price_per_hour: e.target.value})} className="w-full bg-white/5 py-5 pl-14 pr-5 rounded-2xl border border-white/10 outline-none text-white" />
              </div>
              <textarea placeholder="Tell us about your experience..." value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-white/5 p-5 rounded-2xl h-28 border border-white/10 outline-none resize-none text-white" />
              <button onClick={() => setStep(5)} className={`w-full ${accentBg} py-5 rounded-2xl font-black uppercase text-black`}>Next: Availability</button>
            </motion.div>
          )}

          {/* STEP 5: AVAILABILITY */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
                {DAYS_OF_WEEK.map(day => {
                  const wh = formData.working_hours[day as keyof typeof formData.working_hours];
                  return (
                    <div key={day} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 transition-all hover:bg-white/10">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Clock size={18} className={wh.active ? 'text-brand-pink' : 'text-zinc-600'} />
                          <span className={`font-black text-sm uppercase tracking-widest ${wh.active ? 'text-white' : 'text-zinc-600'}`}>{day}</span>
                        </div>
                        <button onClick={() => toggleDay(day)} className={`w-12 h-6 rounded-full transition-all relative flex items-center ${wh.active ? 'bg-brand-pink' : 'bg-white/10'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${wh.active ? 'left-[26px]' : 'left-1'}`} />
                        </button>
                      </div>
                      {wh.active && (
                        <div className="flex gap-3 items-center border-t border-white/5 pt-4">
                          <input type="time" value={wh.start} onChange={e => setFormData({...formData, working_hours: {...formData.working_hours, [day]: {...wh, start: e.target.value}}})} className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs flex-1 text-white [color-scheme:dark]" />
                          <span className="text-[10px] font-black text-zinc-600 uppercase">To</span>
                          <input type="time" value={wh.end} onChange={e => setFormData({...formData, working_hours: {...formData.working_hours, [day]: {...wh, end: e.target.value}}})} className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs flex-1 text-white [color-scheme:dark]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button onClick={handleCompleteRegistration} disabled={loading} className={`w-full ${accentBg} py-5 rounded-2xl font-black uppercase text-black active:scale-95 shadow-2xl flex items-center justify-center gap-3`}>
                {loading ? <Loader2 className="animate-spin" /> : 'Complete Setup'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </div>
  );
}
