import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { LoadingRing } from "@/components/ui/loading-ring"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.98] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 shadow-none border border-transparent font-semibold",
        primary:
          "bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 shadow-none border border-transparent font-semibold",
        brand:
          "bg-white text-black hover:bg-neutral-200 active:bg-neutral-300 shadow-none border border-transparent font-semibold",
        secondary:
          "bg-[#181818] text-[#EDEDED] border border-white/[0.08] hover:bg-[#222222] hover:border-white/20 active:bg-[#141414] font-medium",
        outline:
          "border border-white/[0.12] bg-transparent text-[#EDEDED] hover:bg-white/[0.06] hover:border-white/20 hover:text-white active:bg-white/[0.08] font-medium",
        ghost:
          "bg-transparent text-[#A1A1A1] hover:text-[#EDEDED] hover:bg-white/[0.04] active:bg-white/[0.08] font-medium",
        destructive:
          "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/30 active:bg-rose-500/25 font-medium",
        link: "text-[#EDEDED] underline-offset-4 hover:underline active:opacity-70 p-0 h-auto font-medium rounded-none",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3.5 text-xs sm:text-sm",
        sm: "h-8 px-3.5 text-xs has-[>svg]:px-3",
        lg: "h-10 px-5 text-sm has-[>svg]:px-4",
        xl: "h-11 px-6 text-sm has-[>svg]:px-5",
        icon: "size-8 p-0 rounded-full",
        "icon-sm": "size-7 p-0 rounded-full",
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
  variant = "default",
  size = "default",
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
  const isLightButton = variant === "default" || variant === "primary" || variant === "brand"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <LoadingRing
          size={size === "sm" || size === "icon-sm" ? 14 : 16}
          strokeWidth={2.5}
          arcColor={isLightButton ? "#000000" : "#00E5FF"}
          trackColor={isLightButton ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"}
          className="shrink-0"
        />
      )}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
