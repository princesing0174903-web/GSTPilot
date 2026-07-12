import type { Metadata, Viewport } from "next";
import { Inter, Sora, Poppins, JetBrains_Mono } from "next/font/google";
import { ProvidersLazy } from "@/components/providers-lazy";
import "./globals.css";

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot™ Brand Fonts
//   • Inter        — body text (UI)
//   • Sora         — headings (sections, cards)
//   • Poppins      — logo wordmark (GSTPilot™)
//   • JetBrains Mono — monospace / code / numbers
// ═══════════════════════════════════════════════════════════════════════════════

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// ─── Brand metadata ───────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL("https://gstpilot.in"),
  title: {
    default: "GSTPilot™ — The Financial Brain of India",
    template: "%s · GSTPilot™",
  },
  description:
    "GSTPilot Infinity™ — the world's most premium Financial Operating System for Chartered Accountants and Indian Businesses. GST, Banking, Invoicing, Reconciliation and an AI CFO in one brain.",
  applicationName: "GSTPilot",
  keywords: [
    "GSTPilot",
    "GST software",
    "Chartered Accountant software",
    "India GST filing",
    "AI CFO",
    "financial operating system",
    "GST reconciliation",
    "invoice engine",
    "India fintech",
  ],
  authors: [{ name: "GSTPilot" }],
  creator: "GSTPilot",
  publisher: "GSTPilot",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/gstpilot-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "GSTPilot",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://gstpilot.in",
    siteName: "GSTPilot",
    title: "GSTPilot™ — The Financial Brain of India",
    description:
      "The world's most premium Financial Operating System for Chartered Accountants and Indian Businesses.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GSTPilot — The Financial Brain of India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GSTPilot™ — The Financial Brain of India",
    description:
      "The world's most premium Financial Operating System for Chartered Accountants and Indian Businesses.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
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
        {/* PWA + brand meta — explicit link tags for maximum browser support */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/svg+xml" href="/brand/gstpilot-icon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/brand/gstpilot-icon.svg" color="#3B82F6" />
        <meta name="theme-color" content="#000000" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="application-name" content="GSTPilot" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GSTPilot" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${inter.variable} ${sora.variable} ${poppins.variable} ${jetbrainsMono.variable} min-h-screen bg-background text-foreground antialiased font-sans`}
      >
        <ProvidersLazy>{children}</ProvidersLazy>
      </body>
    </html>
  );
}
