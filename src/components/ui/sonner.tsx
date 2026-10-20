"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          ["--normal-bg" as any]: "transparent",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "glass-surface border-white/[0.10] !backdrop-blur-2xl !rounded-xl !shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]",
          title: "!text-white !font-semibold",
          description: "!text-white/60",
          actionButton: "!bg-white !text-black !font-bold !rounded-full !px-4 !py-1.5",
          cancelButton:
            "!bg-white/[0.06] !text-white/70 !border-white/[0.08] !rounded-full !px-3",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
