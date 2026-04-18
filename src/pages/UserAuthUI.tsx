import { useState, useRef } from 'react';
import { Mail, User, Camera, ArrowRight, CheckCircle2, Key, Loader2, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css'; 
import GlassCard from '../components/ui/GlassCard';
import { supabase } from '../lib/supabaseClient';

// Firebase Imports
import { auth, messaging } from '../lib/firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { getToken } from "firebase/messaging";

export default function UserAuthUI({ accentBg, shadowGlow }: any) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Profile
  const [loading, setLoading] = useState(false);
  
  // Auth State
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState(''); // Correctly defined now
  const recaptchaRef = useRef<any>(null);

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

  // Initialize Recaptcha
  const setupRecaptcha = (containerId: string) => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
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
      alert("Failed to send SMS. Ensure your domain is authorized in Firebase.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP & Check Database
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await confirmationResult?.confirm(otp);
      const fbUser = userCredential?.user;
      
      // Get exact number from Firebase (Guaranteed E.164 format: +91...)
      const fullPhoneNumber = fbUser?.phoneNumber || (phone.startsWith('+') ? phone : `+${phone}`);
      setVerifiedPhone(fullPhoneNumber);

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', fullPhoneNumber) 
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile) {
        localStorage.setItem('sb_user_phone', fullPhoneNumber); 
        navigate('/home');
      } else {
        setStep(3); // New user: Proceed to details
      }
    } catch (err: any) {
      alert("Invalid OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Create Profile
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let avatarUrl = "";
      let fcmToken = "";

      // 1. Get Notification Token
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          fcmToken = await getToken(messaging, { 
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY 
          });
        }
      } catch (fcmErr) { console.warn("FCM skipped"); }

      // 2. Upload Avatar
      if (image) {
        const filePath = `avatars/${Date.now()}_${image.name}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, image);
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        avatarUrl = urlData.publicUrl;
      }

      // 3. Insert into Supabase (Using verifiedPhone to ensure +91)
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert([{ 
          phone: verifiedPhone,
          full_name: formData.name,
          email: formData.email,
          age: parseInt(formData.age),
          gender: formData.gender,
          avatar_url: avatarUrl,
          fcm_token: fcmToken
        }]);

      if (insertError) throw insertError;

      localStorage.setItem('sb_user_phone', verifiedPhone);
      navigate('/home');

    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="z-10 w-full max-w-md px-4">
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
          font-weight: 600 !important;
        }
        .react-tel-input .flag-dropdown {
          background: transparent !important;
          border: none !important;
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
          <div className="space-y-6">
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Mobile Number</label>
                <PhoneInput
                  country={'in'}
                  value={phone}
                  onChange={setPhone}
                  containerClass="w-full"
                />
              </div>
              <button disabled={loading} className={`w-full ${accentBg} py-4 rounded-2xl font-black flex items-center justify-center gap-2 text-white shadow-lg transition-all active:scale-[0.98]`}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send OTP'} <ArrowRight size={18} />
              </button>
            </form>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center text-[9px] uppercase font-bold"><span className="bg-[#0a0a0a] px-3 text-zinc-600 tracking-widest">Or social login</span></div>
            </div>

            {/* LONG SOCIAL BUTTONS */}
            <div className="space-y-3">
               <button type="button" className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center justify-center gap-4 transition-all group">
                 <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
                 <span className="text-sm font-black text-white/90">Continue with Google</span>
               </button>
               <button type="button" className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center justify-center gap-4 transition-all group">
                 <img src="https://www.svgrepo.com/show/475633/apple-color.svg" className="w-5 h-5 invert group-hover:scale-110 transition-transform" alt="Apple" />
                 <span className="text-sm font-black text-white/90">Continue with Apple</span>
               </button>
               <button type="button" className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center justify-center gap-4 transition-all group">
                 <img src="https://www.svgrepo.com/show/475647/facebook-color.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Facebook" />
                 <span className="text-sm font-black text-white/90">Continue with Facebook</span>
               </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 text-center block w-full">6-digit Code</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                <input 
                  type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6}
                  placeholder="000000" 
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-white/30 text-center tracking-[0.3em] font-black text-xl text-white" 
                />
              </div>
            </div>
            <button disabled={loading} className={`w-full ${accentBg} py-4 rounded-2xl font-black flex items-center justify-center gap-2 text-white shadow-lg transition-all active:scale-[0.98]`}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify Code'} <ArrowRight size={18} />
            </button>
            <button type="button" onClick={() => setStep(1)} className="w-full text-zinc-500 text-xs font-bold hover:text-white transition-colors uppercase tracking-widest">Change Phone</button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleCompleteProfile} className="space-y-4">
            <div className="flex flex-col items-center mb-6">
                <label className="relative cursor-pointer group">
                    <div className="w-24 h-24 rounded-3xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden group-hover:border-white/40 transition-all">
                        {image ? <img src={URL.createObjectURL(image)} className="w-full h-full object-cover" alt="Preview" /> : <Camera className="text-zinc-600" size={28} />}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0] || null)} />
                    <div className="absolute -bottom-2 -right-2 bg-green-500 p-1.5 rounded-full border-4 border-[#0a0a0a]">
                        <CheckCircle2 size={12} className="text-white" />
                    </div>
                </label>
                <span className="text-[9px] font-bold text-zinc-500 uppercase mt-2 tracking-widest">Profile Photo</span>
            </div>

            <div className="space-y-3">
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input required type="text" placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-white/30" />
                </div>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input required type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-white outline-none focus:border-white/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <input required type="number" placeholder="Age" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-white/30" />
                    <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            <button type="submit" disabled={loading} className={`w-full ${accentBg} py-4 rounded-2xl font-black text-white shadow-xl active:scale-[0.98] transition-all`}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
            </button>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
