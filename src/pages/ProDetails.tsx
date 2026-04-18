import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, Star, ShieldCheck, Clock, 
  MapPin, MessageSquare, Calendar, ChevronRight, X, Info, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';

export default function ProDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pro, setPro] = useState<any>(null);
  const [suggestedPros, setSuggestedPros] = useState<any[]>([]);
  const [recentPros, setRecentPros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New State for Chat Logic
  const [checkingChat, setCheckingChat] = useState(false);
  const [showBookPopup, setShowBookPopup] = useState(false);

  // --- Smart Navigation Logic ---
  useEffect(() => {
    const handleBackAction = () => {
      if (showBookPopup) {
        setShowBookPopup(false);
      } else {
        navigate(-1);
      }
    };
    const capListener = CapApp.addListener('backButton', handleBackAction);
    window.addEventListener('popstate', handleBackAction);
    return () => {
      capListener.then(l => l.remove());
      window.removeEventListener('popstate', handleBackAction);
    };
  }, [navigate, showBookPopup]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const fetchProDetailsAndLists = async () => {
      // 1. INSTANT OPEN LOGIC: Check local cache first so we don't have to wait for a loading spinner
      try {
        const cachedStr = localStorage.getItem('recentlyViewedPros');
        if (cachedStr) {
          const cachedPros = JSON.parse(cachedStr);
          const localMatch = cachedPros.find((p: any) => p.id === id);
          if (localMatch) {
            setPro(localMatch);
            setLoading(false); // Instantly show UI!
          }
        }
      } catch (e) {}

      // 2. Fetch fresh data in the background
      const { data: proData } = await supabase.from('pro_profiles').select('*').eq('id', id).single();

      if (proData) {
        setPro(proData);
        setLoading(false); // Turn off loading if cache didn't hit

        // Fetch suggested pros
        const { data: sameProfession } = await supabase
          .from('pro_profiles')
          .select('*')
          .eq('profession', proData.profession)
          .neq('id', proData.id)
          .limit(10);

        let suggested = sameProfession || [];
        if (suggested.length < 10) {
          const limitNeeded = 10 - suggested.length;
          const { data: otherProfession } = await supabase
            .from('pro_profiles')
            .select('*')
            .neq('profession', proData.profession)
            .neq('id', proData.id)
            .limit(limitNeeded);
          if (otherProfession) suggested = [...suggested, ...otherProfession];
        }
        setSuggestedPros(suggested);

        // 3. BULLETPROOF STORAGE LOGIC (Fixes QuotaExceededError)
        try {
          const storedHistory = localStorage.getItem('recentlyViewedPros');
          let viewedPros: any[] = storedHistory ? JSON.parse(storedHistory) : [];
          
          // Remove current pro if they are already in the list
          let historyToShow = viewedPros.filter((p: any) => p.id !== proData.id);
          
          // Set the recent pros list for the UI (excluding the guy we are currently looking at)
          setRecentPros(historyToShow.slice(0, 10));

          // SLIM PROFILE: If avatar is a massive Base64 string, drop it so it doesn't crash the browser memory
          const safeAvatar = proData.avatar_url && proData.avatar_url.length > 500 ? null : proData.avatar_url;

          const proToSave = {
            id: proData.id,
            full_name: proData.full_name,
            avatar_url: safeAvatar,
            profession: proData.profession,
            rating: proData.rating,
            price_per_hour: proData.price_per_hour
          };
          
          // Prepend new pro, slice to 10, save
          const updatedHistory = [proToSave, ...historyToShow].slice(0, 10);
          localStorage.setItem('recentlyViewedPros', JSON.stringify(updatedHistory));
        } catch (err) {
          // If storage is STILL full, wipe it clean to prevent total app crashes
          console.warn("Storage full! Wiping recently viewed pros to save memory.");
          localStorage.removeItem('recentlyViewedPros');
        }
      } else {
        setLoading(false);
      }
    };
    
    fetchProDetailsAndLists();
  }, [id]);

  const handleChatClick = async () => {
    const userPhone = localStorage.getItem('sb_user_phone');
    if (!userPhone) return navigate('/select-role');

    setCheckingChat(true);
    try {
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', userPhone)
        .single();

      if (userError || !userProfile) {
        console.error("User profile error:", userError);
        return;
      }

      const { data: existingMeetings, error: meetingError } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('pro_id', id)
        .order('created_at', { ascending: false });

      if (meetingError) {
        console.error("Meeting fetch error:", meetingError);
      }

      if (existingMeetings && existingMeetings.length > 0) {
        navigate(`/messages?chat=${existingMeetings[0].id}`);
      } else {
        setShowBookPopup(true);
      }
    } catch (error) {
      console.error("Chat logic error:", error);
      setShowBookPopup(true);
    } finally {
      setCheckingChat(false);
    }
  };

  if (loading) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div></div>;

  const ProCard = ({ p }: { p: any }) => (
    <div 
      onClick={() => navigate(`/pro/${p.id}`)}
      className="min-w-[200px] w-[200px] snap-center bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-4 cursor-pointer active:scale-95 transition-transform flex flex-col"
    >
      <div className="flex items-center gap-3 mb-3">
        <img 
          src={p.avatar_url || 'https://placehold.co/150x150/111/fff?text=User'} 
          className="w-12 h-12 rounded-xl object-cover border border-white/10" 
          alt={p.full_name} 
        />
        <div className="flex-1 overflow-hidden">
          <h4 className="font-black text-sm text-white truncate capitalize">{p.full_name}</h4>
          <p className="text-[9px] text-brand-purple font-bold capitalize tracking-tight truncate">{p.profession}</p>
        </div>
      </div>
      <div className="mt-auto flex justify-between items-center pt-3 border-t border-white/5">
        <span className="text-xs font-black text-white flex items-center gap-1 capitalize">
          <Star size={12} className="text-yellow-500" fill="currentColor"/> 
          {p.rating || 'New'}
        </span>
        <span className="text-xs font-black text-zinc-400">₹{p.price_per_hour}<span className="text-[9px]">/hr</span></span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-4 font-sans overflow-x-hidden pt-0">
      
      <button 
        onClick={() => navigate(-1)}
        className="fixed top-4 left-6 p-3 bg-black/05 backdrop-blur-md rounded-2xl border border-white/10 text-white active:scale-90 transition-all z-[150] shadow-2xl"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="relative h-[45vh] w-full">
        <img 
          src={pro?.avatar_url || 'https://placehold.co/600x400/0a0a0a/fff?text=Expert'} 
          className="w-full h-full object-cover" 
          alt={pro?.full_name || 'Expert profile'} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
      </div>

      <main className="px-6 -mt-12 relative z-10 pt-4">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter capitalize">{pro?.full_name}</h1>
            <p className="text-brand-purple font-bold text-md tracking-wide mt-1 capitalize">{pro?.profession}</p>
            <div className="flex items-center gap-1.5 text-yellow-500 mt-2">
                <Star size={16} fill="currentColor" />
                <span className="text-md font-black text-white capitalize">{pro?.rating || 'New'}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white leading-none tracking-tighter">₹{pro?.price_per_hour}</p>
            <p className="text-[10px] text-zinc-500 font-bold capitalize tracking-tight mt-1">Per hour</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button 
            onClick={handleChatClick}
            disabled={checkingChat}
            className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs capitalize active:scale-95 transition-transform disabled:opacity-50"
          >
            {checkingChat ? (
              <div className="w-4 h-4 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
            ) : (
              <><MessageSquare size={18} className="text-brand-pink" /> Chat</>
            )}
          </button>
          <button 
            onClick={() => navigate(`/book/${pro.id}`)}
            className="flex items-center justify-center gap-2 py-4 bg-primary-gradient text-white rounded-2xl font-black text-xs capitalize shadow-lg shadow-brand-purple/20 active:scale-95 transition-transform"
          >
            <Calendar size={18} /> Book now
          </button>
        </div>

        <section className="mb-8">
          <h3 className="text-zinc-500 text-[10px] font-black capitalize tracking-tight mb-3 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> About expert
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium capitalize">
            {pro?.bio || 'No bio available for this expert.'}
          </p>
        </section>

        {pro?.services && pro.services.length > 0 && (
          <section className="mb-8">
            <h3 className="text-zinc-500 text-[10px] font-black capitalize tracking-tight mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Services offered
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {pro.services.map((service: string, index: number) => (
                <div key={index} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-zinc-300 tracking-wide capitalize">{service}</div>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3 mb-10">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-[1.5rem] flex items-center gap-3">
            <ShieldCheck className="text-emerald-500" size={20} />
            <span className="text-[10px] font-black capitalize text-emerald-500/70 tracking-tight">Verified pro</span>
          </div>
          <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-[1.5rem] flex items-center gap-3">
            <Clock className="text-blue-500" size={20} />
            <span className="text-[10px] font-black capitalize text-blue-500/70 tracking-tight">Fast response</span>
          </div>
        </section>

        {suggestedPros.length > 0 && (
          <section className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-sm font-black tracking-tight capitalize">Suggested experts</h3>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar">
                {suggestedPros.map(p => <ProCard key={p.id} p={p} />)}
              </div>
          </section>
        )}

        {recentPros.length > 0 && (
          <section className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-sm font-black tracking-tight capitalize">Recently viewed</h3>
              </div>
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar">
                {recentPros.map(p => <ProCard key={p.id} p={p} />)}
              </div>
          </section>
        )}
      </main>

      {/* --- BOOK FIRST POPUP --- */}
      <AnimatePresence>
        {showBookPopup && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowBookPopup(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-[#111] border border-white/10 p-8 rounded-[3rem] w-full max-w-sm relative z-10 text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-brand-purple/20 text-brand-purple">
                <MessageCircle size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black">Connection required</h3>
                <p className="text-zinc-500 text-[11px] font-bold leading-relaxed">
                  To ensure quality connections, you must book an expert before starting a conversation.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => navigate(`/book/${pro.id}`)}
                  className="w-full py-4 bg-brand-purple rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all"
                >
                  Book now
                </button>
                <button 
                  onClick={() => setShowBookPopup(false)}
                  className="w-full py-4 bg-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-zinc-500 active:scale-95"
                >
                  Maybe later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
