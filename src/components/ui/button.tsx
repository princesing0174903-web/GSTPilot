import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { LoadingRing } from "@/components/ui/loading-ring"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-all duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-[0.98] select-none tracking-tight border-0 shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] font-bold border-0 shadow-none",
        primary:
          "bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] font-bold border-0 shadow-none",
        brand:
          "bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] font-bold border-0 shadow-none",
        secondary:
          "bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] font-bold border-0 shadow-none",
        outline:
          "bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] font-bold border-0 shadow-none",
        ghost:
          "bg-white text-black hover:bg-[#E5E5E5] active:bg-[#D4D4D4] font-bold border-0 shadow-none",
        destructive:
          "bg-white text-black hover:bg-rose-100 active:bg-rose-200 font-bold border-0 shadow-none",
        link: "text-white underline-offset-4 hover:underline active:opacity-70 p-0 h-auto font-medium rounded-none bg-transparent hover:bg-transparent",
      },
      size: {
        default: "min-h-[46px] h-12 px-8 py-3.5 has-[>svg]:px-6 text-[15px] font-bold",
        sm: "min-h-[40px] h-10 px-6 text-sm font-bold has-[>svg]:px-4",
        lg: "min-h-[50px] h-13 px-9 text-base font-bold has-[>svg]:px-7",
        xl: "min-h-[56px] h-14 px-10 text-lg font-bold has-[>svg]:px-8",
        icon: "size-11 min-h-[44px] min-w-[44px] p-0 rounded-full bg-white text-black",
        "icon-sm": "size-10 min-h-[38px] min-w-[38px] p-0 rounded-full bg-white text-black",
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
  const isLink = variant === "link"

  // For non-link buttons, clean any dark background/text classes that might leak from legacy code
  const sanitizedClassName = isLink
    ? className
    : cn(
        buttonVariants({ variant, size }),
        className,
        // Enforce the universal white pill styling with bold black text
        "!rounded-full !bg-white !text-black !font-bold hover:!bg-[#E5E5E5] active:!bg-[#D4D4D4] !border-0 !shadow-none"
      )

  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={isLink ? cn(buttonVariants({ variant, size }), className) : sanitizedClassName}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <LoadingRing
          size={size === "sm" || size === "icon-sm" ? 14 : 16}
          strokeWidth={2.5}
          arcColor="#000000"
          trackColor="rgba(0,0,0,0.15)"
          className="shrink-0"
        />
      )}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
