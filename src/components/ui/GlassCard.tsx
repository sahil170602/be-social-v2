import type { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export default function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div className={`
      relative overflow-hidden rounded-[32px] 
      border border-glass-border bg-glass-bg 
      p-8 backdrop-blur-xl 
      transition-all duration-500
      ${className}
    `}>
      {/* Subtle inner shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      {children}
    </div>
  );
}