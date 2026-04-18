import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Search, Star, ArrowRight, SlidersHorizontal, Check, TrendingUp, Wallet, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';

// Bumped version to bypass the corrupted full storage
const CACHE_EXPLORE = 'be_social_explore_v16';

export default function Explore() {
  const navigate = useNavigate();
  
  // 1. INSTANT STATE: Initialize directly from LocalStorage
  const [pros, setPros] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(CACHE_EXPLORE);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 2. SMART LOADING: Only true if we have 0 cached items
  const [loading, setLoading] = useState(pros.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'price_low' | 'price_high'>('rating');

  useEffect(() => {
    const userPhone = localStorage.getItem('sb_user_phone');
    if (!userPhone) { navigate('/', { replace: true }); return; }

    const fetchPros = async () => {
      // Deep clean of old bulky caches
      Object.keys(localStorage).forEach(key => {
        if (key.includes('be_social_explore_v') && key !== CACHE_EXPLORE) {
          localStorage.removeItem(key);
        }
      });

      try {
        const { data } = await supabase
          .from('pro_profiles')
          .select('id, full_name, profession, rating, price_per_hour, avatar_url')
          .order('rating', { ascending: false });

        if (data) {
          setPros(data);
          
          // MICRO-CACHE LOGIC: Guarantees no QuotaExceededError
          try {
            // Take only top 15 and strip base64 bloat if it exists
            const lightweightData = data.slice(0, 15).map(p => ({
              ...p,
              avatar_url: p.avatar_url?.length > 500 ? '' : p.avatar_url // Prevents base64 from filling 5MB limit
            }));
            localStorage.setItem(CACHE_EXPLORE, JSON.stringify(lightweightData));
          } catch (e) { 
            console.warn("Storage limit reached, executing emergency clean.");
            localStorage.removeItem(CACHE_EXPLORE);
          }
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false); 
      }
    };

    fetchPros();

    const channel = supabase.channel('explore-live').on('postgres_changes', { event: '*', schema: 'public', table: 'pro_profiles' },
      (payload) => {
        const updated = payload.new as any;
        setPros((prev) => {
          const exists = prev.find(p => p.id === updated.id);
          return exists ? prev.map(p => p.id === updated.id ? updated : p) : [updated, ...prev];
        });
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  const filteredPros = useMemo(() => {
    let result = [...pros];
    if (searchQuery) {
      result = result.filter(pro => 
        pro.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pro.profession.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (sortBy === 'rating') result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'price_low') result.sort((a, b) => a.price_per_hour - b.price_per_hour);
    else if (sortBy === 'price_high') result.sort((a, b) => b.price_per_hour - a.price_per_hour);
    return result;
  }, [searchQuery, pros, sortBy]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-brand-purple/30 pb-20">
      
      {/* 1. SLIM FIXED HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 p-4 pt-6">
        <div className="max-w-5xl mx-auto flex justify-between items-center px-1">
          <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent">
            Explore
          </h1>
        </div>
      </header>

      {/* 2. SCROLLABLE BODY */}
      <main className="w-full p-3 pt-24 max-w-5xl mx-auto space-y-6">
        
        {/* SEARCH AND FILTERS */}
        <section className="px-1 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                type="text" 
                placeholder="Find talent..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 outline-none focus:border-brand-purple/50 transition-all text-sm font-medium" 
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)} 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${
                showFilters ? 'bg-brand-purple border-brand-purple text-white shadow-lg' : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              <SlidersHorizontal size={20} />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pb-2">
                  {[
                    { id: 'rating', label: 'Top Rated', icon: Star }, 
                    { id: 'price_low', label: 'Budget', icon: Wallet }, 
                    { id: 'price_high', label: 'Premium', icon: TrendingUp }
                  ].map((item) => (
                    <button 
                      key={item.id} 
                      onClick={() => setSortBy(item.id as any)} 
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border transition-all ${
                        sortBy === item.id ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-zinc-500'
                      }`}
                    >
                      <item.icon size={12} /> {item.label} {sortBy === item.id && <Check size={12} className="text-brand-pink" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* 3. DYNAMIC GRID CONTENT */}
        {loading ? (
          <div className="py-24 flex justify-center items-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
          </div>
        ) : filteredPros.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <AnimatePresence mode='popLayout'>
              {filteredPros.map((pro) => (
                <motion.div layout key={pro.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} onClick={() => navigate(`/pro/${pro.id}`)} className="cursor-pointer">
                  <GlassCard className="h-full border-white/5 flex flex-col items-center p-3 group relative overflow-hidden rounded-[1.8rem]">
                    <div className="relative w-40 h-44 rounded-[1.4rem] overflow-hidden border border-white/10 shrink-0 bg-white/5">
                      
                      {/* INSTANT FIRST LETTER FALLBACK / IMAGE */}
                      {pro.avatar_url ? (
                        <img src={pro.avatar_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={pro.full_name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand-purple/20 text-brand-purple text-[4rem] font-black uppercase transition-transform duration-700 group-hover:scale-110">
                          {pro.full_name?.[0] || 'U'}
                        </div>
                      )}

                      <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-white/10 flex items-center gap-1">
                        <Star size={8} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-[9px] font-black text-white">{pro.rating || 'New'}</span>
                      </div>
                    </div>

                    <div className="w-35 flex flex-col flex-1 pt-3 justify-between">
                      <div className="text-left">
                        <p className="text-brand-pink text-[14px] font-black tracking-wide truncate mb-0.5 capitalize">{pro.profession}</p>
                        <h4 className="font-black text-[14px] truncate leading-tight text-zinc-100 capitalize">{pro.full_name}</h4>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-black text-brand-purple leading-none">₹{pro.price_per_hour}</span>
                          <span className="text-[10px] font-bold text-zinc-500 ">/ Hr</span>
                        </div>
                        <motion.div className="w-7 h-7 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center">
                          <ArrowRight size={14} />
                        </motion.div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem] mx-4">
            <Search size={32} className="text-zinc-700 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No matches found</h3>
          </div>
        )}
      </main>

      <BottomNav />
      <div className="h-32" />
    </div>
  );
}
