import type { Metadata, Viewport } from "next";
import { Inter, Sora, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ Brand Fonts
//   • Inter        — body text (UI)
//   • Sora         — headings (sections, cards)
//   • Poppins      — logo wordmark (VEYRO™)
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
  metadataBase: new URL("https://veyro.com"),
  title: {
    default: "VEYRO™ — The AI Operating System for Business",
    template: "%s · VEYRO™",
  },
  description:
    "VEYRO — VEYRO is an AI operating system for modern businesses, combining financial intelligence, operations, invoicing, banking, reporting, automation and compliance in one platform.",
  applicationName: "VEYRO",
  keywords: [
    "VEYRO",
    "AI Operating System",
    "Business Intelligence",
    "Finance",
    "Invoicing",
    "Banking",
    "Compliance",
  ],
  authors: [{ name: "VEYRO" }],
  creator: "VEYRO",
  publisher: "VEYRO",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "any", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "VEYRO",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://veyro.com",
    siteName: "VEYRO",
    title: "VEYRO™ — The AI Operating System for Business",
    description:
      "VEYRO is an AI operating system for modern businesses, combining financial intelligence, operations, invoicing, banking, reporting, automation and compliance in one platform.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VEYRO — The AI Operating System for Business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VEYRO™ — The AI Operating System for Business",
    description:
      "VEYRO is an AI operating system for modern businesses, combining financial intelligence, operations, invoicing, banking, reporting, automation and compliance in one platform.",
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
        <link rel="icon" type="image/svg+xml" href="/icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="mask-icon" href="/icon.png" color="#3B82F6" />
        <meta name="theme-color" content="#000000" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="application-name" content="VEYRO" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VEYRO" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${inter.variable} ${sora.variable} ${poppins.variable} ${jetbrainsMono.variable} min-h-screen bg-background text-foreground antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
