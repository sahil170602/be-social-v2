import { useState, useEffect } from 'react';
import { Mail, User, Calendar, Camera, ArrowRight, CheckCircle2, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css'; 
import GlassCard from '../components/ui/GlassCard';
import { supabase } from '../lib/supabaseClient';

// Firebase Imports
import { auth, messaging } from '../lib/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { getToken } from "firebase/messaging";

export default function UserAuthUI({ accentColor, accentBg, shadowGlow }: any) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Profile
  const [loading, setLoading] = useState(false);
  
  // Firebase State
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  // Form State
  const [phone, setPhone] = useState(''); 
  const [otp, setOtp] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: 'Male'
  });
  const [image, setImage] = useState<File | null>(null);

  // Initialize Recaptcha (Invisible)
  const setupRecaptcha = (containerId: string) => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          console.log("reCAPTCHA verified");
        }
      });
    }
  };

  // STEP 1: Send OTP via Firebase
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      setupRecaptcha('recaptcha-container');
      const appVerifier = (window as any).recaptchaVerifier;
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setStep(2);
    } catch (err: any) {
      console.error("Firebase SMS Error:", err.message);
      alert("Failed to send SMS. Ensure you've disabled reCAPTCHA Enterprise in Firebase Settings if you're on localhost.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP via Firebase
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Verify with Firebase
      const userCredential = await confirmationResult.confirm(otp);
      const fbUser = userCredential.user;
      const formattedPhone = fbUser.phoneNumber || (phone.startsWith('+') ? phone : `+${phone}`);

      // 2. Check Supabase for existing profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('phone', formattedPhone) 
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile) {
        // USER EXISTS: Save phone and go Home
        localStorage.setItem('sb_user_phone', formattedPhone); 
        navigate('/home');
      } else {
        // NEW USER: Go to Profile Creation (Step 3)
        setStep(3);
      }
    } catch (err: any) {
      console.error("Verification Error:", err.message);
      alert("Invalid OTP code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Create Profile + Get Notification Token
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let avatarUrl = "";
      let fcmToken = "";
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

      // 1. Get Push Notification Token
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Replace 'YOUR_VAPID_KEY' with the key from Firebase Project Settings > Cloud Messaging
          fcmToken = await getToken(messaging, { 
            vapidKey: 'YOUR_PUBLIC_VAPID_KEY_FROM_FIREBASE' 
          });
        }
      } catch (fcmErr) {
        console.warn("FCM Token failed, continuing profile creation:", fcmErr);
      }

      // 2. Upload Avatar to Supabase Storage
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, image);

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      // 3. Insert into Supabase 'user_profiles'
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert([{ 
          phone: formattedPhone,
          full_name: formData.name,
          email: formData.email,
          age: parseInt(formData.age),
          gender: formData.gender,
          avatar_url: avatarUrl,
          fcm_token: fcmToken // Save the notification token
        }]);

      if (insertError) throw insertError;

      localStorage.setItem('sb_user_phone', formattedPhone);
      navigate('/home');

    } catch (err: any) {
      console.error("Profile Error:", err.message);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="z-10 w-full max-w-md">
      {/* Container for Firebase Recaptcha - Kept at top-level to avoid DOM removal */}
      <div id="recaptcha-container"></div>

      <style>{`
        .react-tel-input .form-control {
          width: 100% !important;
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 1rem !important;
          height: 56px !important;
          color: white !important;
          font-size: 16px !important;
          padding-left: 58px !important;
        }
        .react-tel-input .flag-dropdown {
          background: transparent !important;
          border: none !important;
          border-radius: 1rem 0 0 1rem !important;
        }
        .react-tel-input .selected-flag {
          background: transparent !important;
          padding-left: 12px !important;
        }
        .react-tel-input .country-list {
          background: #0a0a0a !important;
          color: white !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 1rem !important;
          margin-top: 10px !important;
        }
        .react-tel-input .country-list .country:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .react-tel-input .country-list .country.highlight {
          background: rgba(255, 255, 255, 0.15) !important;
        }
      `}</style>

      <div className="text-center mb-8">
        <h1 className="text-4xl font-black tracking-wide mb-2 ">
          {step === 1 ? 'Get Started' : step === 2 ? 'Verify OTP' : 'Final Touch'}
        </h1>
        <p className="text-zinc-500 text-sm tracking-wide">
          {step === 1 ? 'Enter mobile to continue' : step === 2 ? 'Enter the code sent to your phone' : 'Complete your profile'}
        </p>
      </div>

      <GlassCard className={`border-white/5 p-8 ${shadowGlow} transition-all duration-500`}>
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Mobile Number</label>
              <PhoneInput
                country={'in'}
                value={phone}
                onChange={setPhone}
                placeholder="79725 00000"
                inputProps={{ name: 'phone', required: true }}
                containerClass="w-full"
              />
            </div>
            <button disabled={loading} className={`w-full ${accentBg} py-4 rounded-2xl font-black flex items-center justify-center gap-2 text-white shadow-lg transition-all active:scale-[0.98]`}>
              {loading ? 'Sending...' : 'Send OTP'} <ArrowRight size={18} />
            </button>
            <div className="grid grid-cols-3 gap-3 pt-4">
               <button type="button" className="bg-white/5 p-3 rounded-xl flex justify-center hover:bg-white/10 transition-all"><img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" /></button>
               <button type="button" className="bg-white/5 p-3 rounded-xl flex justify-center hover:bg-white/10 transition-all"><img src="https://www.svgrepo.com/show/475633/apple-color.svg" className="w-5 h-5" alt="Apple" /></button>
               <button type="button" className="bg-white/5 p-3 rounded-xl flex justify-center hover:bg-white/10 transition-all"><img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-5 h-5" alt="Facebook" /></button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">6-digit Code</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  type="text" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  placeholder="000000" 
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-14 outline-none focus:border-brand-purple/50 text-center tracking-[0.1em] font-black text-lg text-white" 
                />
              </div>
            </div>
            <button disabled={loading} className={`w-full ${accentBg} py-4 rounded-2xl font-black flex items-center justify-center gap-2 text-white shadow-lg transition-all active:scale-[0.98]`}>
              {loading ? 'Verifying...' : 'Verify & Continue'} <ArrowRight size={18} />
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-zinc-500 text-xs font-bold hover:text-white transition-colors mt-2 uppercase tracking-widest">Change Phone</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <div className="flex flex-col items-center mb-6">
                <label className="relative cursor-pointer group">
                    <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden group-hover:border-brand-purple transition-all">
                        {image ? <img src={URL.createObjectURL(image)} className="w-full h-full object-cover" alt="Preview" /> : <Camera className="text-zinc-600" />}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0] || null)} />
                    <div className="absolute bottom-0 right-0 bg-brand-purple p-1.5 rounded-full border-2 border-[#0a0a0a]">
                        <CheckCircle2 size={12} className="text-white" />
                    </div>
                </label>
                <span className="text-[9px] font-bold text-zinc-500 uppercase mt-2 tracking-widest">Upload Photo</span>
            </div>

            <div className="space-y-3">
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input required type="text" placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-white/30" />
                </div>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input required type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-white/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <input required type="number" placeholder="Age" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-white/30" />
                    <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <button type="submit" disabled={loading} className={`w-full ${accentBg} py-4 rounded-2xl font-black text-white shadow-xl hover:brightness-110 active:scale-[0.98] transition-all`}>
                {loading ? 'Creating...' : 'Complete Profile'}
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
