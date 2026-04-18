import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app'; 
import { 
  Camera, User, Check, LogOut, Loader2, 
  ChevronRight, Bell, Moon, ShieldCheck, FileText, 
  Headphones, MessageSquare, Phone, Info, Upload, X
} from 'lucide-react';

type ActiveView = 'main' | 'account' | 'app' | 'terms' | 'privacy' | 'support';

export default function ProfileEdit() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [view, setView] = useState<ActiveView>('main');
  const [showFullImage, setShowFullImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [showLightModePopup, setShowLightModePopup] = useState(false);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [userData, setUserData] = useState({
    full_name: '', bio: '', avatar_url: '', email: '',
    age: '', gender: '', interests: '', phone: ''
  });

  // --- Navigation Logic ---
  const openSubPage = (newView: ActiveView) => {
    window.history.pushState({ subPage: newView }, '');
    setView(newView);
  };

  useEffect(() => {
    const handleBackAction = () => {
      // 1. Close full image if open
      if (showFullImage) {
        setShowFullImage(false);
        return;
      }
      // 2. Go from level 3 to level 2
      if (view !== 'main') {
        setView('main');
      } else {
        // 3. Go from level 2 to level 1
        navigate('/home', { replace: true });
      }
    };
    const capListener = CapApp.addListener('backButton', handleBackAction);
    window.addEventListener('popstate', handleBackAction);
    return () => {
      capListener.then(l => l.remove());
      window.removeEventListener('popstate', handleBackAction);
    };
  }, [view, showFullImage, navigate]);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const phone = localStorage.getItem('sb_user_phone');
    const { data } = await supabase.from('user_profiles').select('*').eq('phone', phone).single();
    if (data) {
      setUserData({
        full_name: data.full_name || '',
        bio: data.bio || '',
        avatar_url: data.avatar_url || '',
        email: data.email || '',
        age: data.age?.toString() || '',
        gender: data.gender || '',
        interests: Array.isArray(data.interests) ? data.interests.join(', ') : '',
        phone: data.phone || ''
      });
    }
    setLoading(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      setSaving(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${userData.phone}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setUserData(prev => ({ ...prev, avatar_url: publicUrl }));
      await supabase.from('user_profiles').update({ avatar_url: publicUrl }).eq('phone', userData.phone);
    } catch (error: any) {
      alert('Error uploading image: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const interestsArray = userData.interests
      ? userData.interests.split(',').map(item => item.trim()).filter(i => i !== "")
      : [];
    const { error } = await supabase.from('user_profiles').update({
      full_name: userData.full_name,
      bio: userData.bio,
      avatar_url: userData.avatar_url,
      email: userData.email,
      age: userData.age ? parseInt(userData.age) : null,
      gender: userData.gender,
      interests: interestsArray
    }).eq('phone', userData.phone);
    if (!error) setView('main');
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="text-brand-purple animate-spin" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-sans">
      
      {/* Header */}
      <header className="px-6 pt-8 pb-6 flex items-center justify-center sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-xl z-[100]">
        <h1 className="text-lg font-black tracking-tight">
          {view === 'main' ? 'Profile' : view === 'account' ? 'Account details' : view === 'app' ? 'App preferences' : view === 'terms' ? 'Terms of service' : view === 'privacy' ? 'Privacy policy' : 'Customer support'}
        </h1>
      </header>

      <AnimatePresence mode="wait">
        
        {/* --- LEVEL 2: PROFILE HUB --- */}
        {view === 'main' && (
          <motion.main key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 pb-32 space-y-8">
            <div className="flex flex-col items-center pt-4">
              <div 
                onClick={() => setShowFullImage(true)}
                className="relative cursor-pointer active:scale-95 transition-transform"
              >
                <div className="w-32 h-32 rounded-[2.8rem] overflow-hidden border-2 border-brand-purple/30 shadow-2xl shadow-brand-purple/20 bg-white/5">
                  <img src={userData.avatar_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" alt="Profile" />
                </div>
                <div className="absolute bottom-0 right-0 p-3 bg-brand-purple rounded-2xl shadow-lg">
                  <Camera size={18} />
                </div>
              </div>
              <h2 className="mt-4 text-2xl font-black">{userData.full_name || 'User'}</h2>
              <p className="text-zinc-500 font-bold text-xs">@{userData.phone}</p>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-zinc-600 ml-4">Settings</p>
              <MenuLink icon={User} title="Account details" onClick={() => openSubPage('account')} color="text-brand-purple" />
              <MenuLink icon={Bell} title="App preferences" onClick={() => openSubPage('app')} color="text-brand-pink" />
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-zinc-600 ml-4">Legal & support</p>
              <MenuLink icon={FileText} title="Terms of service" onClick={() => openSubPage('terms')} />
              <MenuLink icon={ShieldCheck} title="Privacy policy" onClick={() => openSubPage('privacy')} />
              <MenuLink icon={Headphones} title="Customer support" onClick={() => openSubPage('support')} />
              
              <button 
                onClick={() => setShowLogoutPopup(true)} 
                className="w-full flex items-center justify-between p-5 bg-red-500/5 border border-red-500/10 rounded-[1.8rem] mt-4 active:scale-95 transition-all text-red-500"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-red-500/10"><LogOut size={20}/></div>
                  <span className="font-bold text-sm tracking-tight">Logout session</span>
                </div>
              </button>
            </div>
          </motion.main>
        )}

        {/* --- LEVEL 3: ACCOUNT DETAILS --- */}
        {view === 'account' && (
          <motion.div key="account" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }} className="px-6 space-y-6 pb-4">
            
            <div className="flex flex-col items-center py-4">
               <div className="w-24 h-24 rounded-3xl overflow-hidden mb-4 border border-white/10">
                  <img src={userData.avatar_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" alt="Preview" />
               </div>
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold active:scale-95 transition-all">
                 <Upload size={14} /> Change photo
               </button>
            </div>

            <div className="space-y-4">
              <InputField label="Full name" value={userData.full_name} onChange={(v:string) => setUserData({...userData, full_name: v})} />
              <InputField label="Phone number" value={userData.phone} readOnly />
              <InputField label="Email address" value={userData.email} onChange={(v:string) => setUserData({...userData, email: v})} />
              <div className="flex gap-4">
                <InputField label="Age" value={userData.age} onChange={(v:string) => setUserData({...userData, age: v})} />
                <InputField label="Gender" value={userData.gender} onChange={(v:string) => setUserData({...userData, gender: v})} />
              </div>
              <InputField label="Interests" value={userData.interests} onChange={(v:string) => setUserData({...userData, interests: v})} />
            </div>
            
            <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={handleSave} className="w-full py-5 bg-brand-purple rounded-[1.8rem] font-black text-md shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={0} />} Save Changes
            </motion.button>
          </motion.div>
        )}

        {/* --- LEVEL 3: APP PREFERENCES --- */}
        {view === 'app' && (
          <motion.div key="app" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="px-6 space-y-4">
            <ToggleItem icon={Moon} title="Dark mode" active={true} onClick={() => setShowLightModePopup(true)} />
            <ToggleItem icon={Bell} title="Push notifications" active={notificationsEnabled} onClick={() => setNotificationsEnabled(!notificationsEnabled)} />
          </motion.div>
        )}

        {/* --- LEVEL 3: LEGAL --- */}
        {(view === 'terms' || view === 'privacy') && (
          <motion.div key="legal" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="px-6 space-y-4 pb-10">
            {[...Array(view === 'terms' ? 12 : 5)].map((_, i) => (
              <div key={i} className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                <p className="text-[9px] font-black text-brand-purple mb-1">Clause {i + 1}</p>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">Be Social is built on trust and safety. All users must maintain professional boundaries.</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* --- LEVEL 3: SUPPORT --- */}
        {view === 'support' && (
          <motion.div key="support" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="px-6 space-y-4">
            <div className="p-10 bg-brand-purple/5 border border-brand-purple/10 rounded-[3rem] text-center space-y-4">
              <div className="w-16 h-16 bg-brand-purple/20 rounded-2xl flex items-center justify-center mx-auto text-brand-purple"><Headphones size={32}/></div>
              <h3 className="text-xl font-black">Help center</h3>
              <p className="text-xs text-zinc-500 font-bold leading-relaxed">Our support desk is active 24/7 for you.</p>
            </div>
            <MenuLink icon={MessageSquare} title="Live chat support" onClick={() => {}} color="text-emerald-400" />
            <MenuLink icon={Phone} title="Request a call" onClick={() => {}} color="text-blue-400" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- FULL SCREEN IMAGE PREVIEW --- */}
      <AnimatePresence>
        {showFullImage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4"
            onClick={() => setShowFullImage(false)}
          >
            <button className="absolute top-14 right-6 p-3 bg-white/10 rounded-full text-white backdrop-blur-md">
              <X size={24} />
            </button>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full aspect-square rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={userData.avatar_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" alt="Full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Popup show={showLightModePopup} onClose={() => setShowLightModePopup(false)} title="Light mode" desc="Hand-crafting a clean light aesthetic for you. Coming soon!" icon={Info} />
      <Popup show={showLogoutPopup} onClose={() => setShowLogoutPopup(false)} title="Logout?" desc="Are you sure you want to end your session?" icon={LogOut} confirmText="Yes, logout" onConfirm={() => { localStorage.clear(); navigate('/', { replace: true }); }} isDanger />
    </div>
  );
}

// --- Helpers ---
function MenuLink({ icon: Icon, title, onClick, color = "text-white" }: any) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-5 bg-white/[0.03] border border-white/5 rounded-[1.8rem] active:scale-95 transition-all">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-white/5 ${color}`}><Icon size={20}/></div>
        <span className="font-bold text-sm tracking-tight">{title}</span>
      </div>
      <ChevronRight size={18} className="opacity-20" />
    </button>
  );
}

function InputField({ label, value, onChange, readOnly = false }: any) {
  return (
    <div className={`space-y-2 ${readOnly ? 'opacity-40' : ''}`}>
      <label className="text-[9px] font-black text-zinc-600 ml-4 tracking-tight">{label}</label>
      <div className="bg-white/5 border border-white/10 rounded-[1.5rem] p-1">
        <input value={value} onChange={e => !readOnly && onChange(e.target.value)} readOnly={readOnly} className="w-full bg-transparent p-4 text-sm outline-none font-bold" />
      </div>
    </div>
  );
}

function ToggleItem({ icon: Icon, title, active, onClick }: any) {
  return (
    <div className="flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-[1.8rem]">
      <div className="flex items-center gap-4"><Icon size={20} className="text-zinc-500" /><span className="font-bold text-sm">{title}</span></div>
      <button onClick={onClick} className={`w-12 h-6 rounded-full relative transition-colors ${active ? 'bg-brand-purple' : 'bg-zinc-800'}`}>
        <motion.div animate={{ x: active ? 24 : 4 }} className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md" />
      </button>
    </div>
  );
}

function Popup({ show, onClose, title, desc, icon: Icon, confirmText, onConfirm, isDanger }: any) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center px-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#111] border border-white/10 p-8 rounded-[3rem] w-full max-w-sm relative z-10 text-center space-y-6">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${isDanger ? 'bg-red-500/20 text-red-500' : 'bg-brand-purple/20 text-brand-purple'}`}><Icon size={32} /></div>
            <div className="space-y-1"><h3 className="text-2xl font-black">{title}</h3><p className="text-zinc-500 text-[11px] font-bold leading-relaxed">{desc}</p></div>
            <div className="flex flex-col gap-3 pt-2">
              {confirmText && <button onClick={onConfirm} className={`w-full py-4 rounded-2xl font-black text-[10px] tracking-widest ${isDanger ? 'bg-red-500 text-white' : 'bg-brand-purple'}`}>{confirmText}</button>}
              <button onClick={onClose} className="w-full py-4 bg-white/5 rounded-2xl font-black text-[10px] tracking-widest text-zinc-500">Go back</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}