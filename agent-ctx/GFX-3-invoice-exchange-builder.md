---
Task ID: GFX-3
Agent: Invoice Exchange Builder
Task: Build GSTPilot Invoice Exchange™ page

File created: /src/components/invoice-exchange/InvoiceExchangePage.tsx
Line count: ~2126 lines
Lint status: Clean (0 errors, 0 warnings on this file)

Architecture:
- 4 tabs via shadcn/ui Tabs: Exchange Dashboard | Invoice Marketplace | My Invoices | Exchange Analytics
- 5 hand-built SVG charts (no chart libraries): VolumeLineChart, IndustryVolumeBarChart, BuyerTypeDonut, DiscountTrendChart, StateHeatmap
- 'use client' at top, default export InvoiceExchangePage

Design language followed (matching EmbeddedFinancePage + AppStorePage):
- Emerald + slate palette (NO indigo, NO blue)
- Indian formatting via toLocaleString('en-IN') (₹1,23,456 / ₹4.5Cr / ₹2.3L)
- shadcn/ui cards with p-5/p-6 padding, gap-4/gap-6 spacing
- framer-motion: staggered card entry, hover lifts, SVG path animations, AnimatePresence for multi-step
- Long lists: ScrollArea with max-h-96 overflow-y-auto

Tab details:
1. Exchange Dashboard: gradient hero, LiveTicker marquee (12 trades × 2 looping), 4 StatCards, 30-day VolumeLineChart, top buyers + top sellers leaderboards (side-by-side)
2. Invoice Marketplace: filter card (Industry Select, Amount Range Slider, Discount Slider, Trust Slider, Due Date range), 3-col grid of 15 InvoiceCards with Buy button, sort by 4 options, Load More pagination, BuyInvoiceDialog with fee breakdown + escrow note
3. My Invoices: 4 stat cards (Total Listed / Total Sold / Avg Discount / Total Fees Paid), full shadcn Table with 9 columns + status badges, action buttons (View Bids / Lower Discount / Withdraw), ViewBidsDialog (5 NBFC/bank bids with best highlighted), ListInvoiceDialog (4-step wizard: Invoice Details → Set Discount → Review → Confirm)
4. Exchange Analytics: IndustryVolumeBarChart (10 industries), BuyerTypeDonut (NBFC 45% / Bank 30% / Investor 15% / Fund 10%), DiscountTrendChart (12 months), StateHeatmap (24 Indian states 5-level color grid), Risk Distribution (AAA/AA/A/BBB with animated progress bars), Top Performing Invoices table

Lint fix applied:
- BuyerTypeDonut initially used mutable `let currentAngle` reassigned during .map() — flagged by react-hooks/immutability rule
- Refactored to pre-compute cumulative angles via immutable reduce() returning array, then index into it inside .map()

Demo data sets included:
- 12 ticker entries, 8 top buyers, 8 top sellers, 30-day volume series, 15 marketplace invoices, 8 user invoices, 5 sample bids, 10 industry volumes, buyer type distribution, 12-month discount trend, 24 states, 6 top-performing invoices, 4-tier risk distribution

No new shadcn components created. Did NOT touch page.tsx, app-sidebar.tsx, or AppContext.tsx.
