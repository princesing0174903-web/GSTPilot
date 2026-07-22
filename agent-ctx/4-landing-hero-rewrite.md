# Task ID 4 — LandingPage Hero Premium UX Rewrite

## Mission
Apply an 8-point premium-positioning UX audit to `/home/z/my-project/src/components/landing/LandingPage.tsx`:
1. Replace generic "Trusted by 1,200+ CA firms" with number-led proof (₹2,500+ crore / 8h→45min case)
2. Lead with business outcome (dual-line headline, persona-aware)
3. Add persona toggle (CA Firms vs Businesses) with animated swap
4. New `WhyGSTPilotSection` — 4-col vs-competitor differentiator row
5. New `OracleHeroSection` — elevated Oracle AI CFO hero with mock chat + typing dots
6. Integrations text-pill row + testimonial quote inside OracleHeroSection
7. Pricing hint per persona under CTAs (₹ icon)
8. Micro-interaction polish (PrimaryButton gradient+shadow, GhostButton ring+blur, Navbar scroll, BrandLogo spring hover, scarcity pulse dot)

## Constraints
- DO NOT remove existing section functions; only add new ones + reorder OracleAISection call in JSX
- KEEP all TS types/imports intact (useState already imported line 3)
- DO NOT use indigo/blue beyond existing accent-* system
- DO NOT use next/image — text pills + lucide icons only
- Use existing motion primitives (Reveal, StaggerGroup, StaggerItem, EASE, revealVariants)
- Run `cd /home/z/my-project && bun run lint 2>&1 | tail -40` after edits

## Status
- In progress.

## Final Status: COMPLETE
- All 8 audit points implemented
- Lint: PASS (eslint + tsc clean on LandingPage.tsx)
- Dev server: HTTP 200, clean compile, zero runtime errors
- Worklog appended to /home/z/my-project/worklog.md (now 7801 lines)

## Line numbers (final)
- WhyGSTPilotSection definition: line 577
- OracleHeroSection definition: line 646
- Both rendered in main JSX: lines 2051-2052 (after HeroSection at 2050, before FeaturesSection at 2053)
- HeroSection rewritten: lines 337-571
- PrimaryButton gradient upgrade: line 187
- GhostButton ring+blur upgrade: line 206
- Navbar scroll polish: lines 230, 244-289
