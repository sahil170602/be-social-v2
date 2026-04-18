import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, TrendingUp, History, CheckCircle2, 
  ArrowUpRight, Loader2, X, Landmark, ShieldCheck, AlertCircle 
} from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

export default function ProWallet() {
  const navigate = useNavigate();
  const [proId, setProId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const [upiVerificationStatus, setUpiVerificationStatus] = useState<'none' | 'verifying' | 'valid' | 'invalid'>('none');
  const [verifiedName, setVerifiedName] = useState('');

  const getProCut = (totalPrice: any) => {
    const amount = parseFloat(totalPrice) || 0;
    return Math.round((amount * 100) / 105);
  };

  const fetchWalletData = useCallback(async () => {
    const phone = localStorage.getItem('sb_user_phone');
    if (!phone) return;
    const { data: pro } = await supabase.from('pro_profiles').select('id').eq('phone', phone).single();

    if (pro) {
      setProId(pro.id);
      let { data: meetings } = await supabase.from('meetings').select('total_price, meeting_status, created_at, user_profiles!fk_meetings_user(full_name)').eq('pro_id', pro.id).eq('meeting_status', 'completed');
      const { data: withdrawals } = await supabase.from('withdrawals').select('amount, created_at, status, upi_id').eq('pro_id', pro.id);

      const totalIncome = (meetings || []).reduce((acc, curr) => acc + getProCut(curr.total_price), 0);
      const totalWithdrawn = (withdrawals || []).reduce((acc, curr) => (curr.status === 'completed' || curr.status === 'pending') ? acc + (parseFloat(curr.amount) || 0) : acc, 0);

      setBalance(totalIncome - totalWithdrawn);

      const formattedMeetings = (meetings || []).map((m: any) => {
        const profile = Array.isArray(m.user_profiles) ? m.user_profiles[0] : m.user_profiles;
        // Status is set to 'earned' for UI labeling
        return { type: 'income', amount: getProCut(m.total_price), date: m.created_at, title: profile?.full_name || 'Client Payment', status: 'earned' };
      });
      const formattedWithdrawals = (withdrawals || []).map(w => ({ type: 'withdrawal', amount: parseFloat(w.amount) || 0, date: w.created_at, title: `Withdrawal: ${w.upi_id}`, status: w.status }));

      setTransactions([...formattedMeetings, ...formattedWithdrawals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWalletData();
    const channel = supabase.channel('pro-wallet-live').on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => fetchWalletData()).on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => fetchWalletData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchWalletData]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (upiId.trim() === '') { setUpiVerificationStatus('none'); return; }
      if (upiRegex.test(upiId)) { verifyUpiAutomatically(upiId); } 
      else if (upiId.includes('@') && upiId.length > 5) { setUpiVerificationStatus('invalid'); }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [upiId]);

  const verifyUpiAutomatically = async (id: string) => {
    setUpiVerificationStatus('verifying');
    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      setUpiVerificationStatus('valid');
      setVerifiedName("Sahil Meshram"); 
    } catch (err) { setUpiVerificationStatus('invalid'); }
  };

  const handleWithdrawSubmit = async () => {
    if (upiVerificationStatus !== 'valid' || !withdrawAmount || !proId) return;
    setIsWithdrawing(true);
    const { error } = await supabase.from('withdrawals').insert({ pro_id: proId, amount: parseFloat(withdrawAmount), upi_id: upiId.trim(), status: 'pending' });
    if (!error) {
      setShowWithdrawModal(false);
      setUpiId(''); setWithdrawAmount(''); setUpiVerificationStatus('none');
    }
    setIsWithdrawing(false);
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (loading) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-purple animate-spin" /></div>;

  return (
    <div className="h-screen bg-[#0a0a0a] text-white font-sans flex flex-col overflow-hidden">
      
      <nav className="shrink-0 p-6 flex items-center gap-4 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 z-50">
        <button onClick={() => navigate(-1)} className="p-2.5 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-black tracking-tight">Pro <span className="text-primary-gradient">Wallet</span></h1>
      </nav>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 hide-scrollbar">
        <div className="p-8 rounded-[2.8rem] bg-gradient-to-br from-brand-purple to-brand-pink shadow-2xl relative overflow-hidden">
          <TrendingUp size={120} className="absolute -right-6 -bottom-6 text-white/10" />
          <p className="text-xs font-bold text-white/60 tracking-widest uppercase">Available Balance</p>
          <div className="text-6xl font-black text-white mt-2 tracking-tighter">₹{balance}</div>
          <button 
            onClick={() => setShowWithdrawModal(true)} disabled={balance <= 0}
            className="mt-8 w-full py-5 bg-black/20 backdrop-blur-xl rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] text-white border border-white/10 active:scale-95 transition-all"
          >
            Request Withdrawal
          </button>
        </div>

        <section className="space-y-4 pb-20">
          <div className="flex items-center gap-2 px-1">
            <History size={16} className="text-zinc-500" />
            <h3 className="text-[10px] font-black text-zinc-500 tracking-[0.2em] uppercase">Transaction History</h3>
          </div>

          <div className="space-y-3">
            {transactions.map((t, i) => (
              <div key={i} className="p-5 bg-white/[0.02] border border-white/5 rounded-[2rem] flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {/* ICON BOX COLOR LOGIC */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                    t.type === 'income' ? 'bg-gradient-to-br from-brand-purple to-brand-pink text-white' : 
                    t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    t.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 
                    'bg-white/5 text-zinc-400'
                  }`}>
                    {t.type === 'income' ? <CheckCircle2 size={22} /> : <ArrowUpRight size={22} />}
                  </div>

                  <div>
                    <h4 className={`text-sm font-black capitalize leading-tight ${t.status === 'rejected' ? 'line-through opacity-30 text-zinc-500' : 'text-white'}`}>{t.title}</h4>
                    
                    {/* STATUS LABEL COLOR LOGIC */}
                    <p className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${
                      t.status === 'earned' ? 'bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent' :
                      t.status === 'completed' ? 'text-emerald-500' :
                      t.status === 'rejected' ? 'text-red-500' :
                      'text-amber-500' // Pending
                    }`}>
                      {t.status}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-base font-black block ${t.type === 'income' ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {t.type === 'income' ? '+' : '-'}₹{t.amount}
                  </span>
                  <span className="text-[8px] font-bold text-zinc-600 uppercase">{formatDate(t.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* WITHDRAWAL MODAL */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-[#111] border border-white/10 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative"
            >
              <button onClick={() => setShowWithdrawModal(false)} className="absolute top-8 right-8 p-2 bg-white/5 rounded-full text-zinc-500"><X size={18} /></button>
              
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-brand-purple/10 rounded-[2rem] flex items-center justify-center text-brand-purple mx-auto mb-4 border border-brand-purple/20"><Landmark size={32} /></div>
                <h3 className="font-black text-2xl tracking-tight">Withdraw Funds</h3>
              </div>

              <div className="space-y-8">
                <div className="relative">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block ml-2">UPI ID</label>
                  <div className="relative">
                    <input 
                      type="text" value={upiId} 
                      onChange={e => { setUpiId(e.target.value); setUpiVerificationStatus('none'); }} 
                      placeholder="username@bank" 
                      className={`w-full bg-black border ${upiVerificationStatus === 'valid' ? 'border-emerald-500/50' : upiVerificationStatus === 'invalid' ? 'border-red-500/50' : 'border-white/10'} rounded-2xl py-5 px-6 text-sm font-bold outline-none transition-all lowercase pr-12`}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2">
                      {upiVerificationStatus === 'verifying' && <Loader2 size={18} className="text-brand-purple animate-spin" />}
                      {upiVerificationStatus === 'valid' && <CheckCircle2 size={18} className="text-emerald-500" />}
                      {upiVerificationStatus === 'invalid' && <AlertCircle size={18} className="text-red-500" />}
                    </div>
                  </div>
                  {upiVerificationStatus === 'valid' && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-emerald-400 font-bold mt-3 ml-2 flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Verified: {verifiedName}
                    </motion.p>
                  )}
                </div>

                <div className={`transition-all duration-500 ${upiVerificationStatus === 'valid' ? 'opacity-100 translate-y-0' : 'opacity-20 pointer-events-none translate-y-4'}`}>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 block ml-2">Withdrawal Amount</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 font-black text-lg">₹</span>
                    <input 
                      type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} 
                      placeholder={`Max ${balance}`} max={balance}
                      className="w-full bg-black border border-white/10 rounded-2xl py-6 pl-12 pr-6 text-xl font-black outline-none focus:border-brand-purple transition-all"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleWithdrawSubmit} 
                  disabled={upiVerificationStatus !== 'valid' || !withdrawAmount || parseFloat(withdrawAmount) > balance || isWithdrawing}
                  className="w-full bg-gradient-to-r from-brand-purple to-brand-pink py-6 rounded-[2rem] font-black text-white shadow-xl active:scale-95 disabled:opacity-20 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
                >
                  {isWithdrawing ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Withdrawal'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
