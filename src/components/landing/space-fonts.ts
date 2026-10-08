import { Instrument_Serif, Barlow } from "next/font/google";

/**
 * Space-landing fonts — loaded independently of the root layout so the
 * VEYRO SaaS app keeps its Inter / JetBrains Mono fonts untouched.
 *
 * These CSS variables (--font-space-heading / --font-space-body) are scoped
 * to the cinematic landing page only and never leak into the dashboard.
 */
export const spaceHeading = Instrument_Serif({
  variable: "--font-space-heading",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const spaceBody = Barlow({
  variable: "--font-space-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});
