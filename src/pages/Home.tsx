import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  User, Bell, Star, Check, ArrowRight, Search, 
  Filter, Wallet 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  'Ui/ux designer', 'Full stack developer', 'Event planner', 
  'Photographer', 'Digital marketer', 'Devops engineer', 
  'Illustrator', 'Fitness coach', 'Content strategist', 'Video editor'
];

const CACHE_PROS_HOME = 'be_social_home_pros_v13';
const CACHE_USER_HOME = 'be_social_home_user_v13';

export default function Home() {
  const navigate = useNavigate();

  // --- 1. INSTANT STATE: Initialize directly from LocalStorage ---
  const [profile, setProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(CACHE_USER_HOME);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  const [pros, setPros] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_PROS_HOME);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [loading, setLoading] = useState(pros.length === 0); 
  const [showPopup, setShowPopup] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // --- 2. BACKGROUND SYNC ---
  useEffect(() => {
    const userPhone = localStorage.getItem('sb_user_phone');
    if (!userPhone) { navigate('/', { replace: true }); return; }

    const fetchHomeData = async () => {
      // Clean up old caches without touching auth tokens
      ['be_social_home_pros_v12', 'be_social_home_user_v12'].forEach(k => localStorage.removeItem(k));

      try {
        const { data: userData } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url, phone, interests')
          .eq('phone', userPhone)
          .maybeSingle();

        if (userData) {
          setProfile(userData);
          localStorage.setItem(CACHE_USER_HOME, JSON.stringify(userData));
          if (!userData.interests?.length) setShowPopup(true);

          const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userData.id)
            .eq('is_read', false);
          
          setUnreadCount(count || 0);
        }

        const { data: prosData } = await supabase
          .from('pro_profiles')
          .select('id, full_name, profession, rating, price_per_hour, avatar_url, bio')
          .order('rating', { ascending: false });

        if (prosData) {
          setPros(prosData);
          
          // SAFE CACHE UPDATE: Never use localStorage.clear() here!
          try {
            const cacheData = prosData.slice(0, 40).map(({ bio, ...rest }) => rest);
            localStorage.setItem(CACHE_PROS_HOME, JSON.stringify(cacheData));
          } catch (e) { 
            console.warn("Storage limit reached, operating without cache.");
            localStorage.removeItem(CACHE_PROS_HOME); 
          }
        }
      } catch (error) {
        console.error("Home fetch error:", error);
      } finally {
        setLoading(false); 
      }
    };

    fetchHomeData();

    const channel = supabase.channel('home-live').on('postgres_changes', { event: '*', schema: 'public', table: 'pro_profiles' },
      (payload) => {
        const updated = payload.new as any;
        setPros(current => {
          const filtered = current.filter(p => p.id !== updated.id);
          return [updated, ...filtered].sort((a, b) => b.rating - a.rating);
        });
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  const handleSaveInterests = async () => {
    const phone = localStorage.getItem('sb_user_phone');
    if (!phone) return;
    const { data, error } = await supabase.from('user_profiles').update({ interests: selectedInterests }).eq('phone', phone).select();
    if (!error && data) {
      setProfile({ ...profile, interests: selectedInterests });
      setShowPopup(false);
    }
  };

  const toggleInterest = (cat: string) => {
    setSelectedInterests(prev => prev.includes(cat) ? prev.filter(i => i !== cat) : [...prev, cat]);
  };

  const recommendedPros = useMemo(() => pros.filter(p => profile?.interests?.includes(p.profession)), [pros, profile]);
  const otherPros = useMemo(() => pros.filter(p => !profile?.interests?.includes(p.profession)), [pros, profile]);

  if (loading) return (
    <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-brand-purple/30 pb-20">
      
      {/* FIXED HEADER */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 px-6 py-5">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="font-black text-[28px] bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent tracking-tighter">Be social</h1>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/notifications')} className="relative p-2 bg-white/5 rounded-xl border border-white/10 active:scale-95 transition-all">
              <Bell size={24} className="text-zinc-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-brand-pink rounded-full border-2 border-[#0a0a0a] shadow-[0_0_10px_rgba(236,72,153,0.5)]"></span>
              )}
            </button>
            <div onClick={() => navigate('/profile-edit')} className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-pink p-[1.5px] cursor-pointer active:scale-90 transition-transform">
              <div className="w-full h-full rounded-[0.9rem] bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <User size={20} className="text-zinc-500" />}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="max-w-5xl mx-auto p-6 pt-28 space-y-10 min-h-[80vh]">
        <section><h2 className="text-4xl font-black tracking-tighter leading-none text-white">Hey, {profile?.full_name?.split(' ')[0] || 'Social'}!</h2></section>

        {/* RECOMMENDED */}
        <AnimatePresence>
          {recommendedPros.length > 0 && (
            <section className="space-y-5">
              <div className="flex justify-between items-end px-1">
                <h3 className="text-[16px] font-black text-zinc-500 tracking-[0em]">Your Interests</h3>
                <span className="text-[10px] font-bold text-brand-purple animate-pulse uppercase"></span>
              </div>
              <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide -mx-6 px-6 no-scrollbar">
                {recommendedPros.map((pro) => (
                  <motion.div layout key={pro.id} className="min-w-[310px]" onClick={() => navigate(`/pro/${pro.id}`)}>
                    <GlassCard className="p-4 border-white/5 h-full flex flex-col gap-4 relative rounded-[2.5rem] hover:bg-white/[0.04] cursor-pointer shadow-2xl transition-all">
                      <div className="flex gap-4 items-center">
                        <div className="w-20 h-20 rounded-3xl overflow-hidden border border-white/10 shrink-0 shadow-2xl group-hover:border-brand-purple/30">
                          <img src={pro.avatar_url || 'https://placehold.co/150/111/fff?text=Social'} className="w-full h-full object-cover" alt={pro.full_name} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-lg leading-tight truncate">{pro.full_name}</h4>
                          <p className="text-brand-pink text-[10px] font-black uppercase tracking-tight mt-1">{pro.profession}</p>
                          <div className="flex items-center gap-1 mt-2">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-[13px] font-black">{pro.rating}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-zinc-400 text-[14px] line-clamp-2 leading-relaxed px-1 italic">{pro.bio || "Crafting digital experiences."}</p>
                      <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                        <div className="flex flex-col"><span className="text-[22px] font-black text-white">₹{pro.price_per_hour}</span><span className="text-zinc-500 text-[14px] font-black  tracking-wide">/Hr</span></div>
                        <div className="bg-brand-purple text-white p-3 rounded-2xl group-hover:scale-110 shadow-lg shadow-brand-purple/20"><ArrowRight size={22} /></div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </AnimatePresence>

        {/* ALL EXPERTS */}
        <section className="space-y-6">
          <div className="flex justify-between items-center px-1"><h3 className="text-[16px] font-black text-zinc-500  tracking-[0em]">Discover Experts</h3><Filter size={0} className="text-zinc-500" /></div>
          <div className="grid grid-cols-1 gap-4">
            {otherPros.length > 0 ? otherPros.map((pro) => (
              <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={pro.id} className="cursor-pointer active:scale-[0.98] transition-all" onClick={() => navigate(`/pro/${pro.id}`)}>
                <GlassCard className="p-4 border-white/5 flex gap-5 items-center hover:bg-white/[0.04] rounded-[2.2rem]">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 relative">
                    <img src={pro.avatar_url || 'https://placehold.co/150/111/fff?text=Social'} className="w-full h-full object-cover" alt={pro.full_name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div><h4 className="font-black text-[14px] truncate tracking-tight">{pro.full_name}</h4><p className="text-brand-purple text-[10px] font-black uppercase mt-0.5">{pro.profession}</p></div>
                      <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5"><Star size={12} className="text-yellow-500 fill-yellow-500" /><span className="text-[12px] font-black">{pro.rating}</span></div>
                    </div>
                    <div className="flex justify-between items-center mt-3">
                      <div className="flex items-center gap-2 text-white">
                        <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500"><Wallet size={12} /></div>
                        <span className="text-[14px] font-black">₹{pro.price_per_hour} <span className="text-[12px] font-bold text-zinc-500  tracking-wide">/ Hr</span></span>
                      </div>
                      <span className="text-brand-pink text-[11px] font-black uppercase tracking-tight">View Profile</span>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )) : (<div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3.5rem] bg-white/[0.01]"><Search className="mx-auto text-zinc-800 mb-4 animate-bounce" size={48} /><p className="text-zinc-600 font-black text-[11px] tracking-widest uppercase">Searching...</p></div>)}
          </div>
        </section>
      </main>

      {/* MODAL */}
      <AnimatePresence>
        {showPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 100, scale: 0.9 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-[3.5rem] p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-purple" />
              <h2 className="text-4xl font-black tracking-tighter mb-2 leading-none">Tailor your feed.</h2>
              <p className="text-zinc-600 text-sm mb-10 mt-2 font-medium">Select at least 2 categories you are interested in.</p>
              <div className="flex flex-wrap gap-3 mb-12">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => toggleInterest(cat)} className={`px-5 py-3.5 rounded-2xl text-[12px] font-black transition-all border ${selectedInterests.includes(cat) ? 'bg-brand-purple border-brand-purple text-white shadow-2xl shadow-brand-purple/40' : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'}`}>
                    <div className="flex items-center gap-2">{cat} {selectedInterests.includes(cat) && <Check size={14} />}</div>
                  </button>
                ))}
              </div>
              <button onClick={handleSaveInterests} disabled={selectedInterests.length < 2} className="w-full bg-gradient-to-r from-brand-purple to-brand-pink py-5 rounded-[2rem] font-black text-white text-lg disabled:opacity-20 active:scale-95 transition-all shadow-2xl shadow-brand-purple/20">Let's Socialize</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}