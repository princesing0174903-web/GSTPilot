import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:outline-none active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-white/90 active:bg-white/80 shadow-none border border-transparent font-medium",
        primary:
          "bg-white text-black hover:bg-white/90 active:bg-white/80 shadow-none border border-transparent font-medium",
        brand:
          "bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] shadow-none border border-transparent font-medium",
        secondary:
          "bg-[#181818] text-[#EDEDED] border border-white/[0.08] hover:bg-[#222222] hover:border-white/20 active:bg-[#141414]",
        outline:
          "border border-white/[0.08] bg-transparent text-[#EDEDED] hover:bg-white/[0.04] hover:border-white/20 hover:text-white active:bg-white/[0.08]",
        ghost:
          "bg-transparent text-[#A1A1A1] hover:text-[#EDEDED] hover:bg-white/[0.04] active:bg-white/[0.08]",
        destructive:
          "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/30 active:bg-rose-500/25",
        link: "text-[#EDEDED] underline-offset-4 hover:underline active:opacity-70 p-0 h-auto",
      },
      size: {
        default: "h-9 px-3.5 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 rounded-lg px-5 text-sm has-[>svg]:px-4",
        xl: "h-11 rounded-lg px-6 text-sm has-[>svg]:px-5",
        icon: "size-8 rounded-lg p-0",
        "icon-sm": "size-7 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-current shrink-0" />}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
