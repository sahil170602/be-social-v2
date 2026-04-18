import { useEffect, useState, useRef, useMemo } from 'react';
import { 
  ArrowLeft, Send, Clock, CheckCircle2, MapPin, 
  Search, Navigation2, Map as MapIcon, Crosshair,
  RefreshCw, AlertCircle, Phone, MoreVertical, 
  Calendar, ShieldCheck, Star, MessageSquare, User,
  XCircle, Check, Timer
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient'; 
import { useJsApiLoader, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';

const CACHE_PRO_INBOX = 'be_social_pro_inbox_v16';
const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ["places"];

interface Message {
  id: string;
  meeting_id: string;
  sender_id: string;
  sender_type: 'user' | 'pro';
  text: string;
  created_at: string;
  is_read: boolean;
}

interface Chat {
  id: string;
  user_id: string;
  pro_id: string;
  meeting_status: 'pending' | 'scheduled' | 'confirmed' | 'started' | 'completed' | 'cancelled' | 'rejected';
  location_status: 'not_set' | 'proposed_by_pro' | 'proposed_by_user' | 'accepted';
  location_name: string | null;
  location_url: string | null;
  user_reached: boolean;
  pro_reached: boolean;
  meeting_date: string;
  start_time: string; // Dynamic timer
  end_time: string;   // Dynamic timer
  last_message?: string;
  unread_count: number;
  user_profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function ProMessagesUI() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatIdParam = searchParams.get('chat');

  const [proProfile, setProProfile] = useState<any>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(chatIdParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Map & Modal States
  const [showLocModal, setShowLocModal] = useState(false);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locName, setLocName] = useState('');
  const [locUrl, setLocUrl] = useState('');
  const [mapCoords, setMapCoords] = useState<{lat: number, lng: number} | null>(null);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isFetchingLoc, setIsFetchingLoc] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(3600);
  const prevStatusRef = useRef<string | null>(null);
  const alertAudioRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) || null, [chats, activeChatId]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // --- AUDIO UNLOCKER TRICK ---
  useEffect(() => {
    alertAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    alertAudioRef.current.load();

    const unlockAudio = () => {
      if (alertAudioRef.current) {
        alertAudioRef.current.play().then(() => {
          alertAudioRef.current?.pause();
          alertAudioRef.current!.currentTime = 0;
        }).catch(() => {});
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const playAlertSound = () => {
    if (alertAudioRef.current) {
      alertAudioRef.current.currentTime = 0;
      alertAudioRef.current.play().catch(() => {});
    }
  };

  const fetchInbox = async (proId: string) => {
    let { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(`*, user_profiles!fk_meetings_user(id, full_name, avatar_url)`)
      .eq('pro_id', proId)
      .order('created_at', { ascending: false });

    if (meetingsError || !meetings || meetings.length === 0) {
      const fallback = await supabase
        .from('meetings')
        .select(`*, user_profiles(id, full_name, avatar_url)`)
        .eq('pro_id', proId)
        .order('created_at', { ascending: false });
      meetings = fallback.data;
    }

    if (!meetings) { setLoading(false); return; }

    const richInbox = await Promise.all(meetings.map(async (m: any) => {
      const { data: lastMsg } = await supabase.from('messages').select('text, created_at').eq('meeting_id', m.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true } as any).eq('meeting_id', m.id).eq('sender_type', 'user').eq('is_read', false);
      
      return { 
        ...m, 
        last_message: lastMsg?.text || "New booking request", 
        unread_count: count || 0,
        user_profiles: m.user_profiles || { full_name: 'Client', avatar_url: null }
      };
    }));

    // --- CHAT DEDUPLICATION ENGINE ---
    // Keep only the most recent meeting for each User so the inbox is clean
    const uniqueChats: Chat[] = [];
    const seenUsers = new Set();
    for (const chat of richInbox) {
      if (!seenUsers.has(chat.user_id)) {
        seenUsers.add(chat.user_id);
        uniqueChats.push(chat);
      }
    }

    setChats(uniqueChats);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    let channel: any;

    const init = async () => {
      const phone = localStorage.getItem('sb_user_phone');
      if (!phone) return navigate('/');

      const { data: pro } = await supabase.from('pro_profiles').select('*').eq('phone', phone).single();
      if (!pro) return;
      
      if (isMounted) setProProfile(pro);
      await fetchInbox(pro.id);

      if (!isMounted) return;

      channel = supabase.channel(`pro-inbox-live-${pro.id}`)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'messages' }, () => { if (isMounted) fetchInbox(pro.id); })
        .on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'meetings' }, () => { if (isMounted) fetchInbox(pro.id); })
        .subscribe();
    };
    
    init();
    return () => { 
      isMounted = false; 
      if (channel) {
        setTimeout(() => supabase.removeChannel(channel), 500); 
      }
    };
  }, [navigate]);

  useEffect(() => {
    if (!activeChatId || !activeChat) return;
    let isMounted = true;
    let chatChannel: any;

    const loadMessages = async () => {
      // --- CHAT HISTORY MERGE ENGINE ---
      // 1. Find ALL meeting IDs that have ever existed between this User and Pro
      const { data: allMeetings } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', activeChat.user_id)
        .eq('pro_id', activeChat.pro_id);
        
      const meetingIds = allMeetings?.map(m => m.id) || [activeChatId];

      // 2. Fetch all messages from all of those meetings and display them together
      const { data } = await supabase
        .from('messages')
        .select('*')
        .in('meeting_id', meetingIds)
        .order('created_at', { ascending: true });

      if (data && isMounted) setMessages(data);
      await supabase.from('messages').update({ is_read: true } as any).eq('meeting_id', activeChatId).eq('sender_type', 'user');

      if (!isMounted) return;

      chatChannel = supabase.channel(`pro-chat-room-${activeChatId}`)
        .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'messages', filter: `meeting_id=eq.${activeChatId}` }, 
          (payload: any) => {
            if (!isMounted) return;
            setMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              const optIndex = prev.findIndex(m => m.text === payload.new.text && m.sender_id === payload.new.sender_id && m.id.toString().startsWith('temp-'));
              if (optIndex >= 0) {
                const copy = [...prev];
                copy[optIndex] = payload.new;
                return copy;
              }
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();
    };

    loadMessages();

    return () => { 
      isMounted = false; 
      if (chatChannel) {
        setTimeout(() => supabase.removeChannel(chatChannel), 500);
      }
    };
  }, [activeChatId, activeChat?.pro_id, activeChat?.user_id]);

  // --- DYNAMIC TIMER SETUP BASED ON BOOKING TIMES ---
  useEffect(() => {
    if (activeChat?.start_time && activeChat?.end_time) {
      const parseTimeToSeconds = (timeStr: string) => {
        const match = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/i);
        if (!match) return 0;

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const modifier = match[3]?.toUpperCase();

        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        return (hours * 3600) + (minutes * 60);
      };

      const startSecs = parseTimeToSeconds(activeChat.start_time);
      const endSecs = parseTimeToSeconds(activeChat.end_time);

      let diffSecs = endSecs - startSecs;
      
      // Handle meetings that cross over midnight (e.g., 11:00 PM to 1:00 AM)
      if (diffSecs <= 0) {
        diffSecs += 24 * 3600;
      }
      setTimeLeft(diffSecs);
    } else {
      setTimeLeft(3600); // 1 hour default
    }
  }, [activeChat?.id, activeChat?.start_time, activeChat?.end_time]);

  // --- LIVE TIMER COUNTDOWN ---
  useEffect(() => {
    let interval: any;
    
    if (activeChat?.meeting_status === 'started' && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (activeChat?.meeting_status === 'started' && timeLeft <= 0) {
      handleEndMeeting();
    }

    if (prevStatusRef.current === 'started' && activeChat?.meeting_status === 'completed') {
      playAlertSound();
    }
    
    prevStatusRef.current = activeChat?.meeting_status || null;

    return () => clearInterval(interval);
  }, [activeChat?.meeting_status, timeLeft]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat?.location_status, activeChat?.pro_reached, activeChat?.meeting_status]);

  useEffect(() => {
    if (chatIdParam) setActiveChatId(chatIdParam);
  }, [chatIdParam]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const handleBookingAction = async (action: 'scheduled' | 'cancelled') => {
    if (!activeChat || !proProfile) return;
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, meeting_status: action } : c));

    if (action === 'scheduled') {
      const welcomeText = `Hi! I have accepted your booking. I am looking forward to our meeting!`;
      setMessages(prev => [...prev, { id: `temp-${Date.now()}`, meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text: welcomeText, created_at: new Date().toISOString(), is_read: true }]);
      await supabase.from('meetings').update({ meeting_status: action }).eq('id', activeChat.id);
      await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text: welcomeText });
    } else {
      await supabase.from('meetings').update({ meeting_status: 'cancelled' }).eq('id', activeChat.id);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !proProfile) return;
    const text = newMessage;
    setNewMessage('');
    
    setMessages(prev => [...prev, { id: `temp-${Date.now()}`, meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text, created_at: new Date().toISOString(), is_read: true }]);
    await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text });
  };

  const proposeLocation = async () => {
    if (!locName || !activeChat || !proProfile) return;
const finalUrl = locUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName)}`;    
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, location_name: locName, location_url: finalUrl, location_status: 'proposed_by_pro' } : c));
    await supabase.from('meetings').update({ location_name: locName, location_url: finalUrl, location_status: 'proposed_by_pro' }).eq('id', activeChat.id);
    await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text: `📍 I've proposed a meeting spot: ${locName}` });
    
    setShowLocModal(false);
    setLocName('');
    setLocUrl('');
  };

  const acceptLocation = async () => {
    if (!activeChat || !proProfile) return;
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, location_status: 'accepted' } : c));
    await supabase.from('meetings').update({ location_status: 'accepted' }).eq('id', activeChat.id);
    await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text: `✅ I have accepted the meeting spot: ${activeChat.location_name}` });
  };

  const rejectLocation = async () => {
    if (!activeChat || !proProfile) return;
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, location_status: 'not_set', location_name: null, location_url: null } : c));
    await supabase.from('meetings').update({ location_status: 'not_set', location_name: null, location_url: null }).eq('id', activeChat.id);
    await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text: `❌ I'd prefer a different location. Can we choose another spot?` });
    setShowLocationMenu(true);
  };

  const handleReached = async () => {
    if (!activeChat || !proProfile) return;
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, pro_reached: true } : c));
    await supabase.from('meetings').update({ pro_reached: true }).eq('id', activeChat.id);
    await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile.id, sender_type: 'pro', text: `✅ I have reached the location.` });
  };

  const handleStartMeeting = async () => {
    if (!activeChat) return;
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, meeting_status: 'started' } : c));
    await supabase.from('meetings').update({ meeting_status: 'started' }).eq('id', activeChat.id);
    await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile?.id, sender_type: 'pro', text: `⏱️ Meeting timer started!` });
  };

  const handleEndMeeting = async () => {
    if (!activeChat) return;
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, meeting_status: 'completed' } : c));
    await supabase.from('meetings').update({ meeting_status: 'completed' }).eq('id', activeChat.id);
    await supabase.from('messages').insert({ meeting_id: activeChat.id, sender_id: proProfile?.id, sender_type: 'pro', text: `🏁 Meeting ended.` });
  };

  const handleLocateMe = () => {
    setIsFetchingLoc(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLoc(coords); setMapCoords(coords); mapInstance?.panTo(coords);
      setIsFetchingLoc(false);
    }, () => setIsFetchingLoc(false));
  };

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location) {
      const coords = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
      setMapCoords(coords); setLocName(place.name || place.formatted_address || "Selected location"); mapInstance?.panTo(coords);
    }
  };

  const confirmMapSelection = () => {
    if (!mapCoords) return;
setLocUrl(`https://www.google.com/maps/search/?api=1&query=${mapCoords.lat},${mapCoords.lng}`);    setShowMapPicker(false); setShowLocModal(true);
  };

  const autoDetectLiveLocation = () => {
    setIsAutoDetecting(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude; const lng = pos.coords.longitude;
const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any) => {
        setLocName(results?.[0]?.formatted_address || "Current location"); setLocUrl(url);
        setIsAutoDetecting(false); setShowLocationMenu(false); setShowLocModal(true);
      });
    }, () => setIsAutoDetecting(false));
  };

  const isChatActive = activeChat && ['scheduled', 'confirmed', 'started', 'ongoing'].includes(activeChat.meeting_status);
  const isPending = activeChat && activeChat.meeting_status === 'pending';
  const isEnded = activeChat && ['completed', 'cancelled', 'rejected'].includes(activeChat.meeting_status);
  const bothReached = activeChat?.user_reached && activeChat?.pro_reached;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans overflow-hidden selection:bg-brand-pink/30">
      
      {/* HEADER */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 px-6 py-5 pt-4 shadow-2xl">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => activeChatId ? (setSearchParams({}), setActiveChatId(null)) : navigate('/pro-dashboard')} 
              className="p-2.5 bg-white/5 rounded-xl border border-white/10 active:scale-95 transition-all"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            {activeChat ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 overflow-hidden">
                  {activeChat.user_profiles?.avatar_url ? (
                    <img src={activeChat.user_profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User size={16} className="m-auto mt-2.5 text-white/50" />
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-black leading-tight capitalize">{activeChat.user_profiles?.full_name}</h1>
                  <p className="text-[10px] font-bold text-zinc-500 capitalize tracking-wide">{activeChat.meeting_status}</p>
                </div>
              </div>
            ) : (
              <h1 className="text-3xl font-black tracking-tighter capitalize">Client <span className="bg-gradient-to-r from-brand-pink to-brand-purple bg-clip-text text-transparent">Inbox</span></h1>
            )}
          </div>
        </div>
      </nav>

      {/* BODY */}
      <main className="flex-1 overflow-y-auto p-4 pt-25 flex flex-col max-w-5xl mx-auto w-full">
        {loading && (!chats.length || (activeChatId && !activeChat)) ? (
          <div className="flex justify-center py-20"><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="w-10 h-10 border-4 border-brand-pink border-t-transparent rounded-full" /></div>
        ) : !activeChat ? (
          <div className="space-y-3 pb-32 mt-20">
            {chats.map(chat => (
              <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className="p-5 bg-white/[0.02] border border-white/5 rounded-[2.5rem] flex gap-4 cursor-pointer active:scale-95 transition-transform shadow-lg hover:border-brand-pink/20 relative">
                <img src={chat.user_profiles?.avatar_url || 'https://placehold.co/150/111/fff?text=U'} className="w-16 h-16 rounded-3xl object-cover border border-white/10 shadow-md" alt="" />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-black text-[17px] leading-tight capitalize truncate text-white">{chat.user_profiles?.full_name}</h3>
                    {chat.unread_count > 0 && (
                      <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="bg-brand-pink text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-brand-pink/20 capitalize">
                        {chat.unread_count > 9 ? '9+' : chat.unread_count} New
                      </motion.span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${chat.unread_count > 0 ? 'text-brand-pink font-bold' : 'text-zinc-500'}`}>
                    {chat.unread_count > 0 ? 'Click to read new message' : chat.last_message}
                  </p>
                </div>
              </div>
            ))}
            {chats.length === 0 && !loading && <div className="text-center py-20 text-zinc-600 font-bold capitalize text-xs tracking-wide">No client chats yet</div>}
          </div>
        ) : (
          <div className="space-y-6 pb-32 mt-20">
            
            {messages.map((msg, i) => {
              const isPro = msg.sender_type === 'pro';
              return (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={msg.id} className={`flex gap-3 items-end ${isPro ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 overflow-hidden shrink-0">
                    {isPro ? (
                       proProfile?.avatar_url ? <img src={proProfile.avatar_url} className="w-full h-full object-cover" /> : <div className="bg-brand-pink h-full w-full" />
                    ) : (
                       activeChat.user_profiles?.avatar_url ? <img src={activeChat.user_profiles.avatar_url} className="w-full h-full object-cover" /> : <User size={14} className="m-auto mt-2" />
                    )}
                  </div>
                  <div className={`max-w-[75%] p-4 text-[15px] shadow-xl leading-relaxed ${isPro ? 'bg-gradient-to-br from-brand-pink to-brand-purple text-white rounded-[1.8rem] rounded-br-none' : 'bg-white/10 border border-white/5 text-zinc-100 rounded-[1.8rem] rounded-bl-none'}`}>
                    {msg.text}
                  </div>
                </motion.div>
              );
            })}

            {/* LOCATION CARD LOGIC */}
            {activeChat.location_name && !activeChat.pro_reached && isChatActive && activeChat.meeting_status !== 'started' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-6 rounded-[2.5rem] border shadow-xl flex flex-col gap-3 mt-6 mb-2 ${activeChat.location_status === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black capitalize tracking-wide flex items-center gap-2">
                     <MapPin size={18}/> 
                     {activeChat.location_status === 'accepted' ? 'Confirmed Spot' : activeChat.location_status === 'proposed_by_user' ? 'Client Proposed Spot' : 'Waiting for Approval'}
                  </p>
                </div>
                
                <p className="font-bold text-white text-lg capitalize">{activeChat.location_name}</p>
                
                <div className="flex flex-col gap-2 pt-2">
                  <a href={activeChat.location_url || '#'} target="_blank" rel="noopener noreferrer" className={`w-full py-4 text-white rounded-2xl text-center text-sm font-black shadow-lg capitalize tracking-widest ${activeChat.location_status === 'accepted' ? 'bg-emerald-500' : 'bg-amber-500'}`}>View on Map</a>
                  
                  {/* PROPOSED BY USER -> PRO CAN ACCEPT OR REJECT */}
                  {activeChat.location_status === 'proposed_by_user' && (
                     <div className="grid grid-cols-2 gap-2 w-full">
                       <button onClick={acceptLocation} className="py-4 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-2xl font-black text-xs capitalize active:scale-95 transition-all">Accept</button>
                       <button onClick={rejectLocation} className="py-4 bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-black text-xs capitalize active:scale-95 transition-all">Reject</button>
                     </div>
                  )}

                  {/* IF ACCEPTED -> SHOW REACHED BUTTON */}
                  {activeChat.location_status === 'accepted' && (
                     <button onClick={handleReached} className="w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl text-center text-sm font-black capitalize tracking-widest active:scale-95 transition-all">I've Reached</button>
                  )}
                </div>
              </motion.div>
            )}

            {/* START MEETING CARD (ONLY PRO CAN START) */}
            {bothReached && activeChat.meeting_status !== 'started' && !isEnded && (
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-brand-pink/10 border border-brand-pink/20 p-8 rounded-[3rem] text-center shadow-2xl mt-6 mb-2">
                 <Timer className="mx-auto text-brand-pink mb-4" size={40} />
                 <h3 className="font-black text-white text-xl capitalize mb-4">Both Parties Arrived</h3>
                 <button onClick={handleStartMeeting} className="w-full bg-brand-pink py-5 rounded-[2rem] font-black text-white shadow-lg active:scale-95 transition-all capitalize tracking-widest">
                   Start Meeting Now
                 </button>
               </motion.div>
            )}

            {/* LIVE TIMER CARD */}
            {activeChat.meeting_status === 'started' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-brand-pink/20 to-brand-purple/20 border border-brand-pink/30 p-8 rounded-[3rem] text-center shadow-2xl mt-6 mb-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Clock size={120} /></div>
                <div className="relative z-10">
                  <p className="text-brand-pink font-black text-[10px] tracking-widest uppercase mb-4 animate-pulse">Meeting in Progress</p>
                  <h2 className="text-6xl font-black text-white tracking-tighter tabular-nums mb-8 drop-shadow-2xl">{formatTime(timeLeft)}</h2>
                  <button onClick={handleEndMeeting} className="w-full bg-white/5 border border-white/10 py-5 rounded-[2rem] font-black text-white hover:bg-white/10 active:scale-95 transition-all capitalize tracking-widest text-sm shadow-xl flex items-center justify-center gap-2">
                    <XCircle size={18} className="text-red-400" /> End Meeting
                  </button>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* INPUT AREA */}
      <AnimatePresence>
        {isChatActive && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="p-4 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-white/5 fixed bottom-0 left-0 right-0 z-40 pb-8">
            <div className="max-w-6xl mx-auto flex items-center gap-3">
              <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="flex-1 bg-[#111] border border-white/10 rounded-2xl py-5 px-6 text-sm outline-none focus:border-brand-pink transition-all font-medium placeholder:text-zinc-600 shadow-inner capitalize" />
              <button type="button" onClick={() => setShowLocationMenu(true)} className="p-5 bg-[#111] border border-white/10 rounded-2xl text-zinc-400 hover:text-brand-pink transition-colors active:scale-90"><MapPin size={22} /></button>
              <button onClick={sendMessage} disabled={!newMessage.trim()} className="p-5 bg-gradient-to-br from-brand-pink to-brand-purple rounded-2xl shadow-lg active:scale-90 transition-all disabled:opacity-30"><Send size={22} className="text-white" /></button>
            </div>
          </motion.div>
        )}

        {isPending && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 z-[110] bg-[#0a0a0a]/95 border-t border-white/10 p-10 pb-12 rounded-t-[3.5rem] shadow-[0_-20px_50px_rgba(0,0,0,1)] text-center flex flex-col items-center justify-center">
             <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto mb-10" />
             <p className="text-zinc-400 font-bold text-sm capitalize tracking-wide mb-8">Accept this booking to start chatting</p>
             <div className="flex gap-4 w-full max-w-md mx-auto">
                <button onClick={() => handleBookingAction('scheduled')} className="flex-1 py-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-3xl font-black text-sm active:scale-95 transition-all capitalize tracking-wider flex items-center justify-center gap-2"><Check size={18}/> Accept</button>
                <button onClick={() => handleBookingAction('cancelled')} className="flex-1 py-5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl font-black text-sm active:scale-95 transition-all capitalize tracking-wider flex items-center justify-center gap-2"><XCircle size={18}/> Reject</button>
             </div>
          </motion.div>
        )}

        {isEnded && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a] p-10 pb-12 text-center border-t border-white/10">
             <AlertCircle className="mx-auto mb-2 text-zinc-600" size={32} />
             <p className="text-zinc-500 font-bold capitalize text-xs tracking-widest">This session is {activeChat?.meeting_status}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOCATION MODALS */}
      <AnimatePresence>
        {showLocationMenu && (
          <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#1a1a1a] border border-white/10 w-full max-w-sm rounded-[3rem] p-8 space-y-4 shadow-2xl">
              <h3 className="font-black text-xl text-center text-white mb-6 capitalize tracking-tight">Meeting spot</h3>
              <button onClick={autoDetectLiveLocation} disabled={isAutoDetecting} className="w-full flex items-center gap-4 p-6 bg-brand-pink/10 border border-brand-pink/20 rounded-2xl text-brand-pink font-bold disabled:opacity-50 capitalize">
                {isAutoDetecting ? <RefreshCw className="animate-spin" size={20} /> : <Crosshair size={20} />} Share live location
              </button>
              <button onClick={() => { setShowLocationMenu(false); setShowMapPicker(true); if(!mapCoords) handleLocateMe(); }} className="w-full flex items-center gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl text-white font-bold mt-4 capitalize"><MapIcon size={24} className="text-emerald-400" /> Use map picker</button>
              <button onClick={() => setShowLocationMenu(false)} className="w-full py-4 text-zinc-500 text-[10px] font-black capitalize tracking-widest mt-4 text-center">Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMapPicker && isLoaded && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[600] bg-white flex flex-col">
            <div className="absolute top-14 left-4 right-4 z-[700] flex gap-2">
              <button onClick={() => setShowMapPicker(false)} className="p-4 bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 text-white shadow-2xl active:scale-90"><ArrowLeft size={20} /></button>
              <Autocomplete onLoad={(ac: any) => (autocompleteRef.current = ac)} onPlaceChanged={onPlaceChanged}>
                <input type="text" placeholder="Search your neighborhood..." className="w-full bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-brand-pink text-white shadow-2xl font-bold capitalize"/>
              </Autocomplete>
            </div>
            <button onClick={handleLocateMe} className="absolute bottom-40 right-6 z-[800] p-5 bg-brand-pink text-white rounded-full shadow-2xl active:scale-90 transition-all">
              {isFetchingLoc ? <RefreshCw className="animate-spin" size={24} /> : <Crosshair size={26} />}
            </button>
            <div className="flex-1 relative z-0">
              <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={mapCoords || userLoc || { lat: 19.076, lng: 72.877 }} zoom={16} onLoad={(map: any) => setMapInstance(map)} onClick={(e: any) => { if (e.latLng) { const lat = e.latLng.lat(); const lng = e.latLng.lng(); setMapCoords({lat, lng}); const geocoder = new (window as any).google.maps.Geocoder(); geocoder.geocode({ location: { lat, lng } }, (res: any) => { if (res?.[0]) setLocName(res[0].formatted_address); }); } }} options={{ disableDefaultUI: true, zoomControl: true }}>
                {mapCoords && <Marker position={mapCoords} />}
              </GoogleMap>
            </div>
            {mapCoords && (
              <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="p-8 bg-[#111] border-t border-white/10 rounded-t-[3rem] pb-12 z-[800] absolute bottom-0 w-full shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-16 h-16 bg-brand-pink/10 rounded-[1.2rem] flex items-center justify-center text-brand-pink border border-brand-pink/20"><MapPin size={28} /></div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-black text-xl text-white truncate capitalize">{locName || "Point selected"}</h3>
                    <p className="text-[10px] text-zinc-500 font-bold mt-1 capitalize tracking-wide flex items-center gap-2"><span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse mr-2 inline-block"/> Verified local spot</p>
                  </div>
                </div>
                <button onClick={confirmMapSelection} className="w-full bg-brand-pink py-5 rounded-[1.8rem] font-black text-sm active:scale-95 transition-all capitalize">Confirm location</button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLocModal && !showMapPicker && (
          <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#111] border border-white/10 w-full rounded-[3.5rem] p-10 space-y-8 shadow-2xl shadow-black">
              <div className="text-center">
                 <div className="w-20 h-20 bg-brand-pink/10 rounded-3xl flex items-center justify-center text-brand-pink mx-auto mb-4 border border-brand-pink/20"><MapPin size={32} /></div>
                 <h2 className="text-2xl font-black text-white capitalize tracking-tight">Finalize spot</h2>
              </div>
              <input type="text" value={locName} onChange={e=>setLocName(e.target.value)} placeholder="e.g. Starbucks Main Gate" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm outline-none focus:border-brand-pink text-white shadow-inner font-bold capitalize" />
              <div className="flex flex-col gap-3">
                <button onClick={proposeLocation} disabled={!locName.trim()} className="w-full bg-gradient-to-br from-brand-pink to-brand-purple py-5 rounded-2xl font-black text-white shadow-xl active:scale-95 disabled:opacity-30 transition-all capitalize text-xs">Send suggestion</button>
                <button onClick={()=>setShowLocModal(false)} className="w-full text-zinc-500 text-[10px] font-black capitalize tracking-widest pt-4 hover:text-white transition-colors">Go back</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
