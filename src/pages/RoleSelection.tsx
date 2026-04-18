import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';

/**
 * Premium Animation Variants
 * Uses the custom cubic-bezier ease for a polished "app" feel
 */
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export default function RoleSelection() {
  const navigate = useNavigate();

  const handleSelectRole = (role: 'user' | 'pro') => {
    localStorage.setItem('user_role', role);
    navigate(`/auth/${role}`);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white relative overflow-hidden">
      
      {/* Dynamic Background Glows */}
      <motion.div 
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.2, 0.15],
          x: [0, 20, 0] 
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-5%] left-[-5%] w-[600px] h-[600px] bg-brand-purple/20 rounded-full blur-[120px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.15, 0.1],
          x: [0, -30, 0] 
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[-5%] right-[-5%] w-[600px] h-[600px] bg-brand-pink/15 rounded-full blur-[120px] pointer-events-none" 
      />

      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="visible" 
        className="z-10 w-full max-w-2xl text-center"
      >
        <motion.div variants={itemVariants} className="mb-10">
          <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter">
            Join <span className="text-primary-gradient">Be Social</span>
          </h1>    
          <p className="text-zinc-500 text-sm font-medium tracking-wide">
            Select your path to get started
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* USER CARD */}
          <motion.button 
            variants={itemVariants} 
            whileHover={{ y: -6 }} 
            whileTap={{ scale: 0.97 }} 
            onClick={() => handleSelectRole('user')} 
            className="text-left w-full group outline-none h-full"
          >
            <GlassCard className="h-full border-white/5 group-hover:border-brand-purple/30 group-hover:bg-brand-purple/[0.03] transition-all duration-500 p-8">
              <div className="flex flex-col gap-6">
                <div className="w-14 h-14 flex items-center justify-center bg-brand-purple/10 rounded-2xl text-brand-purple group-hover:scale-110 transition-transform duration-500">
                  <User size={30} strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Find a Pro</h2>
                  <p className="text-zinc-400 text-sm leading-relaxed font-medium">
                    Discover local experts, book instant meetings, and grow your network.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.button>

          {/* PRO CARD */}
          <motion.button 
            variants={itemVariants} 
            whileHover={{ y: -6 }} 
            whileTap={{ scale: 0.97 }} 
            onClick={() => handleSelectRole('pro')} 
            className="text-left w-full group outline-none h-full"
          >
            <GlassCard className="h-full border-white/5 group-hover:border-brand-pink/30 group-hover:bg-brand-pink/[0.03] transition-all duration-500 p-8">
              <div className="flex flex-col gap-6">
                <div className="w-14 h-14 flex items-center justify-center bg-brand-pink/10 rounded-2xl text-brand-pink group-hover:scale-110 transition-transform duration-500">
                  <Briefcase size={30} strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Become a Pro</h2>
                  <p className="text-zinc-400 text-sm leading-relaxed font-medium">
                    Showcase your skills, manage bookings, and get paid securely.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.button>
        </div>

        {/* Footnote */}
        <motion.p 
          variants={itemVariants} 
          className="mt-12 text-[10px]  font-bold tracking-[0.1em] text-zinc-600"
        >
          v1.0
        </motion.p>
      </motion.div>
    </div>
  );
}