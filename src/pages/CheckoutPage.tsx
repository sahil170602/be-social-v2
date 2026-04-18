import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, CreditCard, ShieldCheck, CheckCircle, 
  Calendar, Clock, MapPin, MessageSquare, Home 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { App as CapApp } from '@capacitor/app';

export default function CheckoutPage() {
  const { state } = useLocation();
  const { proId } = useParams();
  const navigate = useNavigate();
  
  const [pro, setPro] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);

  // --- Auto calculated fees ---
  const subtotal = state?.totalPrice || 0;
  const serviceFee = Math.round(subtotal * 0.05);
  const totalAmount = subtotal + serviceFee;

  // --- Smart navigation logic (android & windows) ---
  useEffect(() => {
    const handleBackAction = (e?: any) => {
      if (showSuccess) {
        // Force navigate to home if the success popup is active
        if (e) e.preventDefault();
        navigate('/home', { replace: true });
      } else {
        // Standard back behavior for checkout
        navigate(-1);
      }
    };

    // Listeners for hardware and browser back buttons
    const capListener = CapApp.addListener('backButton', handleBackAction);
    window.addEventListener('popstate', handleBackAction);

    return () => {
      capListener.then(l => l.remove());
      window.removeEventListener('popstate', handleBackAction);
    };
  }, [navigate, showSuccess]);

  useEffect(() => {
    if (!state) {
      navigate('/explore');
      return;
    }

    const fetchPro = async () => {
      const { data } = await supabase
        .from('pro_profiles')
        .select('*')
        .eq('id', proId)
        .single();
      setPro(data);
    };
    fetchPro();
  }, [proId, state, navigate]);

  const processPaymentAndBook = async () => {
    setIsProcessing(true);
    try {
      const userPhone = localStorage.getItem('sb_user_phone');
      if (!userPhone) throw new Error("User not logged in");

      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone', userPhone)
        .single();

      if (userError || !userData) throw new Error("User not found");

      // ALWAYS CREATE A NEW MEETING ROW (No overwriting data)
      const { data: newMeeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          pro_id: proId,
          user_id: userData.id,
          meeting_date: state.date,
          start_time: state.startTime,
          end_time: state.endTime,
          place: state.place,
          services: state.services,
          total_price: totalAmount, 
          payment_status: 'paid',
          meeting_status: 'pending'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;
      
      const finalMeetingId = newMeeting.id;
      setCreatedMeetingId(finalMeetingId);

      // Send an automated system message to the new chat box
      await supabase.from('messages').insert({
        meeting_id: finalMeetingId,
        sender_id: userData.id,
        sender_type: 'user',
        text: `📅 Booking request sent for ${state.date}. Waiting for confirmation.`
      });
      
      // Trap the back button by pushing a dummy entry to history
      window.history.pushState(null, '', window.location.pathname);
      setShowSuccess(true);
      
    } catch (err) {
      console.error(err);
      alert("Payment processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 pt-4 pb-4 antialiased relative overflow-hidden font-sans">
      
      {/* Background ambient glow */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-brand-purple/10 blur-[120px] pointer-events-none" />

      <header className="flex items-center gap-4 mb-8 relative z-10">
        <button 
          onClick={() => navigate(-1)} 
          className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black tracking-tight capitalize">
          Secure <span className="bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent">checkout</span>
        </h1>
      </header>

      <div className="max-w-md mx-auto space-y-6 relative z-10">
        
        {/* Booking summary card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6 shadow-2xl">
          <p className="text-[10px] font-bold text-zinc-500 mb-4 tracking-tight capitalize">Review session</p>
          
          <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-5">
            <img 
              src={pro?.avatar_url || 'https://placehold.co/150x150/111/fff?text=Pro'} 
              className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-lg" 
              alt="Expert" 
            />
            <div>
              <h4 className="font-bold text-lg leading-tight capitalize">{pro?.full_name}</h4>
              <p className="text-brand-purple text-xs font-bold mt-1 capitalize">
                {pro?.profession}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <Calendar size={14} className="text-brand-purple" />
              </div>
              <span className="text-sm font-medium">{state?.date}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <Clock size={14} className="text-brand-purple" />
              </div>
              <span className="text-sm font-medium">{state?.startTime} — {state?.endTime}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <MapPin size={14} className="text-brand-purple" />
              </div>
              <span className="text-sm font-medium truncate capitalize">{state?.place}</span>
            </div>
          </div>
        </div>

        {/* Payment method selector */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-zinc-500 ml-4 tracking-tight capitalize">Payment method</p>
          <div className="p-5 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-brand-purple border border-white/10">
                <CreditCard size={24} />
              </div>
              <div>
                <p className="text-sm font-bold capitalize">Instant wallet / Upi</p>
                <p className="text-[10px] text-zinc-500 font-medium capitalize">Encrypted & secure</p>
              </div>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-brand-purple flex items-center justify-center">
              <div className="w-3 h-3 bg-gradient-to-r from-brand-purple to-brand-pink rounded-full shadow-lg shadow-brand-purple/40" />
            </div>
          </div>
        </div>

        {/* Pricing detail */}
        <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] space-y-4 shadow-inner">
          <div className="flex justify-between text-zinc-400 text-sm font-medium capitalize">
            <span>Duration fee</span>
            <span className="text-white">₹{subtotal}</span>
          </div>
          <div className="flex justify-between text-zinc-400 text-sm font-medium capitalize">
            <span>Service fee (5%)</span>
            <span className="text-white">₹{serviceFee}</span>
          </div>
          <div className="h-px bg-white/5 w-full my-4" />
          <div className="flex justify-between items-center capitalize">
            <span className="text-lg font-bold">Total amount</span>
            <span className="text-3xl font-black bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent tracking-tighter">₹{totalAmount}</span>
          </div>
        </div>

        {/* Action button */}
        <button 
          onClick={processPaymentAndBook}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-brand-purple to-brand-pink py-6 rounded-3xl font-bold text-sm tracking-widest shadow-2xl shadow-brand-purple/20 active:scale-95 transition-all flex items-center justify-center gap-3 text-white disabled:opacity-40 capitalize"
        >
          {isProcessing ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Pay & confirm booking <ShieldCheck size={20} /></>
          )}
        </button>
      </div>

      {/* Success modal overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 z-[300] bg-[#0a0a0a]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 50, opacity: 0 }} 
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm"
            >
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                <CheckCircle className="text-emerald-500" size={48} />
              </div>
              
              <h2 className="text-4xl font-black mb-3 tracking-tighter text-white capitalize">Confirmed!</h2>
              <p className="text-zinc-500 font-medium text-sm mb-12 capitalize">
                Your appointment has been registered. You can now chat with your pro.
              </p>

              <div className="space-y-4">
                <button 
                  onClick={() => navigate(`/messages?chat=${createdMeetingId}`)} 
                  className="w-full bg-gradient-to-r from-brand-purple to-brand-pink py-5 rounded-3xl font-bold text-sm flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all capitalize tracking-widest text-white"
                >
                  <MessageSquare size={20} /> Open chat
                </button>

                <button 
                  onClick={() => navigate('/home')}
                  className="w-full bg-white/5 border border-white/10 py-5 rounded-3xl font-bold text-sm flex items-center justify-center gap-3 active:scale-95 transition-all text-zinc-400 hover:text-white capitalize tracking-widest"
                >
                  <Home size={20} /> Back to home
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
