import React from 'react';
import { cn } from "@/lib/utils";

export function AISpinner({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex flex-col items-center justify-center gap-6", className)}>
      {/* Orbital / Ring Animation */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border border-zinc-800 animate-[spin_4s_linear_infinite]" />
        
        {/* Middle Ring */}
        <div className="absolute inset-2 rounded-full border border-zinc-700/50 animate-[spin_3s_linear_infinite_reverse]" />
        
        {/* Inner Ring with subtle glow */}
        <div className="absolute inset-4 rounded-full border border-zinc-500 shadow-[0_0_15px_rgba(255,255,255,0.1)] animate-[spin_2s_linear_infinite]" />
        
        {/* Core spark */}
        <div className="absolute w-1 h-1 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
      </div>

      {/* Text block */}
      <div className="text-center space-y-1">
        <h4 className="text-sm font-medium text-white tracking-wide">AI is working</h4>
        <p className="text-xs text-zinc-500">Analyzing your request...</p>
      </div>
    </div>
  );
}
