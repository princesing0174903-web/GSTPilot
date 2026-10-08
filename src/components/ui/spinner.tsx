import { cn } from "@/lib/utils"

export function Spinner({ className, size = 24 }: { className?: string, size?: number }) {
  return (
    <div 
      className={cn("animate-[spin_1.1s_linear_infinite] flex items-center justify-center shrink-0", className)} 
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle 
          cx="50" cy="50" r="44" 
          stroke="currentColor" 
          strokeWidth="8" 
          fill="none" 
          className="opacity-20"
        />
        <circle 
          cx="50" cy="50" r="44" 
          stroke="currentColor" 
          strokeWidth="8" 
          fill="none" 
          strokeLinecap="round" 
          strokeDasharray="276" 
          strokeDashoffset="100" 
        />
      </svg>
    </div>
  )
}
