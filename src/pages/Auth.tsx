import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserAuthUI from './UserAuthUI';
import ProAuthUI from './ProAuthUI';
import { supabase } from '../lib/supabaseClient';
import { motion } from 'framer-motion';

export default function Auth() {
  const { role } = useParams<{ role: string }>(); 
  const navigate = useNavigate();
  
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); 

  const isPro = role === 'pro';

  // Branding variables
  const accentColor = isPro ? 'text-brand-pink' : 'text-brand-purple';
  const accentBg = isPro ? 'bg-brand-pink' : 'bg-brand-purple';
  const shadowGlow = isPro ? 'shadow-[0_0_50px_-12px_rgba(236,72,153,0.3)]' : 'shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)]';

  const handleCheckUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    
    setLoading(true);

    try {
      const table = isPro ? 'pro_profiles' : 'user_profiles';
      
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // EXISTING USER: 
        // 1. Save to localStorage
        localStorage.setItem('sb_user_phone', phone);
        
        // 2. Redirect with 'replace: true' so they can't go back to Auth
        const targetPath = isPro ? '/pro-dashboard' : '/home';
        navigate(targetPath, { replace: true });
        
      } else {
        // NEW USER: Move to Step 2 (Registration)
        setStep(2);
      }
    } catch (err: any) {
      console.error("Auth Error:", err.message);
      alert("Auth failed. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const uiProps = { 
    phone,         
    setPhone,      
    loading,       
    step,          
    setStep,       
    handleCheckUser, 
    accentColor, 
    accentBg, 
    shadowGlow,
    role 
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
      
      {/* Dynamic Background Glows */}
      <div 
        className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 transition-all duration-1000 ${
          isPro ? 'bg-brand-pink' : 'bg-brand-purple'
        }`} 
      />
      <div 
        className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-10 transition-all duration-1000 ${
          isPro ? 'bg-brand-pink' : 'bg-brand-purple'
        }`} 
      />

      {/* Auth UI Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full flex justify-center"
      >
        {isPro ? (
          <ProAuthUI {...uiProps} />
        ) : (
          <UserAuthUI {...uiProps} />
        )}
      </motion.div>
      
    </div>
  );
}