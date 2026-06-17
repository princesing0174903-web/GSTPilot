'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import {
  Package, TrendingUp, TrendingDown, Search,
  ChevronRight, Download, Filter, Plus, AlertTriangle,
  Warehouse, ShoppingCart, BarChart3, ArrowUpRight,
  Boxes, Truck, Clock, CheckCircle2, XCircle,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const statCards = [
  { label: 'Total Products', value: '1,247', change: '+34', up: true, icon: Package, color: 'emerald' },
  { label: 'Total Value', value: '₹2,45,67,890', change: '+12.3%', up: true, icon: BarChart3, color: 'emerald' },
  { label: 'Low Stock Items', value: '18', change: '+3', up: false, icon: AlertTriangle, color: 'amber' },
  { label: 'Pending Orders', value: '12', change: '-2', up: true, icon: ShoppingCart, color: 'emerald' },
  { label: 'Stock Turnover', value: '4.8x', change: '+0.3', up: true, icon: TrendingUp, color: 'emerald' },
]

const products = [
  { id: 'SKU001', name: 'HP LaserJet Pro M404dn', category: 'Printers', stock: 24, minStock: 10, price: 28500, warehouse: 'Mumbai', status: 'In Stock' },
  { id: 'SKU002', name: 'Dell UltraSharp 27 Monitor', category: 'Monitors', stock: 8, minStock: 10, price: 34200, warehouse: 'Delhi', status: 'Low Stock' },
  { id: 'SKU003', name: 'Logitech MX Master 3S', category: 'Accessories', stock: 156, minStock: 30, price: 8499, warehouse: 'Mumbai', status: 'In Stock' },
  { id: 'SKU004', name: 'Canon PIXMA G6070', category: 'Printers', stock: 3, minStock: 5, price: 22499, warehouse: 'Bangalore', status: 'Low Stock' },
  { id: 'SKU005', name: 'Seagate Barracuda 2TB HDD', category: 'Storage', stock: 89, minStock: 20, price: 5499, warehouse: 'Delhi', status: 'In Stock' },
  { id: 'SKU006', name: 'APC Back-UPS 1100VA', category: 'Power', stock: 12, minStock: 8, price: 6200, warehouse: 'Mumbai', status: 'In Stock' },
  { id: 'SKU007', name: 'TP-Link Archer AX73', category: 'Networking', stock: 2, minStock: 5, price: 7999, warehouse: 'Chennai', status: 'Critical' },
  { id: 'SKU008', name: 'Samsung 870 EVO 1TB SSD', category: 'Storage', stock: 67, minStock: 15, price: 6999, warehouse: 'Mumbai', status: 'In Stock' },
  { id: 'SKU009', name: 'Epson L3250 InkTank', category: 'Printers', stock: 0, minStock: 5, price: 13999, warehouse: 'Delhi', status: 'Out of Stock' },
  { id: 'SKU010', name: 'Cisco SG250-26 Switch', category: 'Networking', stock: 5, minStock: 3, price: 24500, warehouse: 'Bangalore', status: 'In Stock' },
  { id: 'SKU011', name: 'Kingston FURY 16GB RAM', category: 'Memory', stock: 34, minStock: 10, price: 4299, warehouse: 'Mumbai', status: 'In Stock' },
  { id: 'SKU012', name: 'Intel Core i5-14400F', category: 'Processors', stock: 4, minStock: 6, price: 22999, warehouse: 'Delhi', status: 'Low Stock' },
]

const warehouses = [
  { name: 'Mumbai Central', code: 'WH-MUM', manager: 'Rajesh Sharma', capacity: 85, items: 542, value: '₹1,12,45,000', city: 'Mumbai' },
  { name: 'Delhi North', code: 'WH-DEL', manager: 'Amit Kumar', capacity: 72, items: 389, value: '₹78,23,000', city: 'New Delhi' },
  { name: 'Bangalore Tech', code: 'WH-BLR', manager: 'Kavita Iyer', capacity: 60, items: 198, value: '₹34,56,000', city: 'Bangalore' },
  { name: 'Chennai South', code: 'WH-MAA', manager: 'Priya Patel', capacity: 45, items: 118, value: '₹20,43,890', city: 'Chennai' },
]

const purchaseOrders = [
  { id: 'PO-2026-0145', supplier: 'Redington India Pvt Ltd', items: 24, value: '₹4,56,780', date: '28/02/2026', expected: '05/03/2026', status: 'In Transit' },
  { id: 'PO-2026-0144', supplier: 'Ingram Micro India Pvt Ltd', items: 18, value: '₹2,34,500', date: '25/02/2026', expected: '03/03/2026', status: 'Delivered' },
  { id: 'PO-2026-0143', supplier: 'Dell India Pvt Ltd', items: 12, value: '₹3,12,000', date: '22/02/2026', expected: '01/03/2026', status: 'Delivered' },
  { id: 'PO-2026-0142', supplier: 'HP India Sales Pvt Ltd', items: 30, value: '₹5,67,890', date: '20/02/2026', expected: '28/02/2026', status: 'Delivered' },
  { id: 'PO-2026-0146', supplier: 'Tech Data India Pvt Ltd', items: 15, value: '₹1,89,450', date: '02/03/2026', expected: '08/03/2026', status: 'Pending' },
  { id: 'PO-2026-0147', supplier: 'Savex Technologies Pvt Ltd', items: 22, value: '₹3,45,600', date: '03/03/2026', expected: '10/03/2026', status: 'Pending' },
]

const lowStockAlerts = [
  { product: 'TP-Link Archer AX73', current: 2, min: 5, warehouse: 'Chennai', urgency: 'Critical' },
  { product: 'Epson L3250 InkTank', current: 0, min: 5, warehouse: 'Delhi', urgency: 'Critical' },
  { product: 'Dell UltraSharp 27 Monitor', current: 8, min: 10, warehouse: 'Delhi', urgency: 'Warning' },
  { product: 'Canon PIXMA G6070', current: 3, min: 5, warehouse: 'Bangalore', urgency: 'Warning' },
  { product: 'Intel Core i5-14400F', current: 4, min: 6, warehouse: 'Delhi', urgency: 'Warning' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function StockByCategoryChart() {
  const data = [
    { label: 'Printers', value: 27, color: '#10b981' },
    { label: 'Storage', value: 156, color: '#34d399' },
    { label: 'Networking', value: 7, color: '#f59e0b' },
    { label: 'Monitors', value: 8, color: '#6ee7b7' },
    { label: 'Accessories', value: 156, color: '#a7f3d0' },
    { label: 'Power', value: 12, color: '#fbbf24' },
    { label: 'Memory', value: 34, color: '#94a3b8' },
    { label: 'Processors', value: 4, color: '#d1d5db' },
  ]
  const maxVal = Math.max(...data.map(d => d.value))
  const barH = 26
  const gap = 6
  const h = data.length * (barH + gap) + 30
  const chartW = 280

  return (
    <svg viewBox={`0 0 ${chartW + 100} ${h}`} className="w-full h-auto">
      {data.map((d, i) => {
        const w = (d.value / maxVal) * chartW
        return (
          <g key={d.label} transform={`translate(0, ${i * (barH + gap) + 15})`}>
            <text x="0" y={barH / 2 + 4} className="text-[10px] fill-slate-600" textAnchor="start">{d.label}</text>
            <rect x="70" y="0" width={w} height={barH} rx="4" fill={d.color} opacity="0.85">
              <animate attributeName="width" from="0" to={w} dur="0.6s" fill="freeze" />
            </rect>
            <text x={70 + w + 6} y={barH / 2 + 4} className="text-[9px] fill-slate-500">
              {d.value} units
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function WarehouseCapacityChart() {
  const data = warehouses
  const w = 300
  const h = 140
  const padL = 40
  const padB = 25
  const padT = 10
  const chartW = w - padL - 10
  const chartH = h - padB - padT
  const barW = chartW / data.length * 0.6
  const gapX = chartW / data.length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 1, 2, 3, 4].map(i => {
        const y = padT + (i / 4) * chartH
        return <line key={i} x1={padL} y1={y} x2={w - 10} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
      })}
      {data.map((d, i) => {
        const x = padL + i * gapX + (gapX - barW) / 2
        const barH = (d.capacity / 100) * chartH
        const fillColor = d.capacity > 80 ? '#ef4444' : d.capacity > 60 ? '#f59e0b' : '#10b981'
        return (
          <g key={d.code}>
            <rect x={x} y={padT + chartH - barH} width={barW} height={barH} rx="3" fill={fillColor} opacity="0.8">
              <animate attributeName="height" from="0" to={barH} dur="0.5s" fill="freeze" />
              <animate attributeName="y" from={padT + chartH} to={padT + chartH - barH} dur="0.5s" fill="freeze" />
            </rect>
            <text x={x + barW / 2} y={padT + chartH - barH - 5} className="text-[8px] fill-slate-600" textAnchor="middle">{d.capacity}%</text>
            <text x={x + barW / 2} y={h - 6} className="text-[8px] fill-slate-400" textAnchor="middle">{d.city}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const stagger = {
  container: { transition: { staggerChildren: 0.06 } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } },
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stockStatusColor = (s: string) => {
    switch (s) {
      case 'In Stock': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Low Stock': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200'
      case 'Out of Stock': return 'bg-slate-200 text-slate-700 border-slate-300'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const orderStatusColor = (s: string) => {
    switch (s) {
      case 'Delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'In Transit': return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Inventory</h1>
              <p className="text-xs text-slate-500">Stock & Warehouse Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" /> Add Product
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stat Cards */}
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" variants={stagger.container} initial="initial" animate="animate">
          {statCards.map((s) => (
            <motion.div key={s.label} variants={stagger.item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.label === 'Low Stock Items' ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                      <s.icon className={`h-4 w-4 ${s.label === 'Low Stock Items' ? 'text-amber-600' : 'text-emerald-600'}`} />
                    </div>
                    <div className={`flex items-center gap-0.5 text-[11px] font-medium ${s.up ? 'text-emerald-600' : 'text-red-500'}`}>
                      {s.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {s.change}
                    </div>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{s.value}</p>
                  <p className="text-[11px] text-slate-500">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100 h-9 p-0.5">
            <TabsTrigger value="overview" className="text-xs px-3 h-8">Overview</TabsTrigger>
            <TabsTrigger value="products" className="text-xs px-3 h-8">Products</TabsTrigger>
            <TabsTrigger value="warehouses" className="text-xs px-3 h-8">Warehouses</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs px-3 h-8">Purchase Orders</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs px-3 h-8">Alerts</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Stock by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <StockByCategoryChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Warehouse Capacity Utilization</CardTitle>
                </CardHeader>
                <CardContent>
                  <WarehouseCapacityChart />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xl font-bold text-emerald-800">1,247</p>
                    <p className="text-[11px] text-emerald-600">Total SKUs</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xl font-bold text-slate-800">4</p>
                    <p className="text-[11px] text-slate-600">Warehouses</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xl font-bold text-amber-800">18</p>
                    <p className="text-[11px] text-amber-600">Low Stock Alerts</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xl font-bold text-red-800">1</p>
                    <p className="text-[11px] text-red-600">Out of Stock</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Product List</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 w-56 pl-8 text-xs"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                      <Filter className="h-3.5 w-3.5" /> Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {filteredProducts.map((prod) => (
                      <motion.div
                        key={prod.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          prod.status === 'In Stock' ? 'bg-emerald-100' :
                          prod.status === 'Low Stock' ? 'bg-amber-100' :
                          prod.status === 'Critical' ? 'bg-red-100' : 'bg-slate-100'
                        }`}>
                          <Boxes className={`h-4 w-4 ${
                            prod.status === 'In Stock' ? 'text-emerald-600' :
                            prod.status === 'Low Stock' ? 'text-amber-600' :
                            prod.status === 'Critical' ? 'text-red-600' : 'text-slate-500'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">{prod.name}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{prod.category}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">{prod.id} · {prod.warehouse}</span>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-semibold text-slate-900">{prod.stock} units</p>
                          <p className="text-[10px] text-slate-500">Min: {prod.minStock}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-semibold text-slate-900">{formatINR(prod.price)}</p>
                          <p className="text-[10px] text-slate-500">per unit</p>
                        </div>
                        <Badge className={`text-[10px] ${stockStatusColor(prod.status)}`}>{prod.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Warehouses Tab */}
          <TabsContent value="warehouses" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {warehouses.map((wh, i) => (
                <motion.div
                  key={wh.code}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                          <Warehouse className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-900">{wh.name}</span>
                          <p className="text-[10px] text-slate-500">{wh.code} · {wh.city}</p>
                        </div>
                      </div>
                      <Separator className="mb-3" />
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Manager</span>
                          <span className="font-medium text-slate-700">{wh.manager}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Items</span>
                          <span className="font-medium text-slate-700">{wh.items}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Total Value</span>
                          <span className="font-medium text-slate-700">{wh.value}</span>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-500">Capacity</span>
                            <span className={`font-medium ${wh.capacity > 80 ? 'text-red-600' : wh.capacity > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>{wh.capacity}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${wh.capacity > 80 ? 'bg-red-500' : wh.capacity > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${wh.capacity}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* Purchase Orders Tab */}
          <TabsContent value="orders" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Purchase Orders</CardTitle>
                  <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-3.5 w-3.5" /> New PO
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {purchaseOrders.map((po, i) => (
                      <motion.div
                        key={po.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          po.status === 'Delivered' ? 'bg-emerald-100' :
                          po.status === 'In Transit' ? 'bg-sky-100' : 'bg-amber-100'
                        }`}>
                          {po.status === 'Delivered' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                           po.status === 'In Transit' ? <Truck className="h-4 w-4 text-sky-600" /> :
                           <Clock className="h-4 w-4 text-amber-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{po.id}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{po.items} items</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">{po.supplier} · Expected: {po.expected}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{po.value}</span>
                        <Badge className={`text-[10px] ${orderStatusColor(po.status)}`}>{po.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lowStockAlerts.map((alert, i) => (
                    <motion.div
                      key={alert.product}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        alert.urgency === 'Critical' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        alert.urgency === 'Critical' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        <AlertTriangle className={`h-4 w-4 ${alert.urgency === 'Critical' ? 'text-red-600' : 'text-amber-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">{alert.product}</span>
                          <Badge className={`text-[9px] ${alert.urgency === 'Critical' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                            {alert.urgency}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500">Current: {alert.current} units · Minimum: {alert.min} · {alert.warehouse}</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                        <ShoppingCart className="h-3 w-3" /> Reorder
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
