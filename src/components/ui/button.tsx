import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.97] gst-btn-press gst-ripple",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-sm",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// ─── Ripple hook ─────────────────────────────────────────────────────────────
// Creates a ripple ink element at the click position. Premium Material-style
// feedback that works on every button variant. No-op on disabled buttons.
function useRipple() {
  const [ripples, setRipples] = React.useState<
    Array<{ x: number; y: number; size: number; key: number }>
  >([])

  const addRipple = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const button = e.currentTarget
      const rect = button.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top - size / 2
      const key = Date.now()
      setRipples((prev) => [...prev, { x, y, size, key }])
      // Auto-remove after animation
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.key !== key))
      }, 550)
    },
    []
  )

  return { ripples, addRipple }
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const { ripples, addRipple } = useRipple()

  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!disabled && !loading) {
        addRipple(e)
      }
      onClick?.(e as React.MouseEvent<HTMLButtonElement>)
    },
    [addRipple, disabled, loading, onClick]
  )

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
      {!asChild && ripples.length > 0 && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          {ripples.map((r) => (
            <span
              key={r.key}
              className="gst-ripple-ink"
              style={{
                left: r.x,
                top: r.y,
                width: r.size,
                height: r.size,
              }}
            />
          ))}
        </span>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
