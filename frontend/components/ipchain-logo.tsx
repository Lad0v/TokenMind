"use client"

import { cn } from "@/lib/utils"

interface IPChainLogoProps {
  className?: string
  showText?: boolean
  size?: "sm" | "md" | "lg"
}

export function IPChainLogo({ className, showText = true, size = "md" }: IPChainLogoProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14"
  }

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-md" />
        
        {/* Shield SVG */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 h-full w-full drop-shadow-lg"
        >
          {/* Outer shield */}
          <path
            d="M24 4L6 12V22C6 33.05 13.8 43.26 24 46C34.2 43.26 42 33.05 42 22V12L24 4Z"
            fill="url(#shieldGradient)"
            stroke="url(#strokeGradient)"
            strokeWidth="1.5"
          />
          
          {/* Inner chain/link pattern */}
          <g fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <ellipse cx="24" cy="20" rx="8" ry="4" strokeOpacity="0.8" />
            <ellipse cx="24" cy="28" rx="8" ry="4" strokeOpacity="0.8" />
            <line x1="16" y1="20" x2="16" y2="28" strokeOpacity="0.6" />
            <line x1="32" y1="20" x2="32" y2="28" strokeOpacity="0.6" />
          </g>

          <defs>
            <linearGradient id="shieldGradient" x1="24" y1="4" x2="24" y2="46" gradientUnits="userSpaceOnUse">
              <stop stopColor="oklch(0.72 0.19 160 / 0.3)" />
              <stop offset="1" stopColor="oklch(0.35 0.12 160 / 0.2)" />
            </linearGradient>
            <linearGradient id="strokeGradient" x1="24" y1="4" x2="24" y2="46" gradientUnits="userSpaceOnUse">
              <stop stopColor="oklch(0.80 0.16 160)" />
              <stop offset="1" stopColor="oklch(0.50 0.14 160)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {showText && (
        <span className={cn("font-semibold tracking-tight text-foreground", textSizeClasses[size])}>
          IPChain
        </span>
      )}
    </div>
  )
}
