import type { Metadata, Viewport } from "next";
import "./globals.css";

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Root Layout (Oracle Focus Mode)
//
// Strips the 4 next/font/google imports (Inter, Sora, Poppins, JetBrains Mono)
// for this session. Each next/font/google fetch triggers a network request +
// font subsetting that consumes significant memory during Turbopack compile on
// a 4 GB sandbox. We use system font stacks instead so the dev server can
// survive the compile and Oracle can be worked on.
//
// To restore the full brand fonts, re-add the next/font/google imports and
// the body className variables.
// ═══════════════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
  metadataBase: new URL("https://gstpilot.in"),
  title: {
    default: "GSTPilot Oracle — Your Financial Brain",
    template: "%s · GSTPilot Oracle",
  },
  description:
    "GSTPilot Oracle — production-grade AI CFO with streaming, memory, and autonomous financial intelligence.",
  applicationName: "GSTPilot",
  authors: [{ name: "GSTPilot" }],
  creator: "GSTPilot",
  publisher: "GSTPilot",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/gstpilot-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/brand/gstpilot-icon.svg" />
        <meta name="theme-color" content="#000000" />
        <meta name="application-name" content="GSTPilot" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GSTPilot" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
