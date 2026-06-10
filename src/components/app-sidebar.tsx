'use client'

import React from 'react'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  FileText,
  RefreshCw,
  Users,
  FileSpreadsheet,
  ShieldAlert,
  Calendar,
  Download,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  HeartPulse,
  Clock,
  Bot,
} from 'lucide-react'
import { useApp, type AppView } from '@/contexts/AppContext'

interface NavItem {
  title: string
  view: AppView
  icon: React.ElementType
}

const mainNavItems: NavItem[] = [
  { title: 'Command Center', view: 'dashboard', icon: LayoutDashboard },
  { title: 'GSTR Filing', view: 'gstr-filing', icon: FileText },
  { title: 'Reconciliation', view: 'reconciliation', icon: RefreshCw },
  { title: 'Invoices', view: 'invoices', icon: FileSpreadsheet },
  { title: 'Clients', view: 'clients', icon: Users },
  { title: 'Client Health', view: 'client-health', icon: HeartPulse },
  { title: 'Deadlines', view: 'deadlines', icon: Clock },
  { title: 'Error Center', view: 'errors', icon: ShieldAlert },
]

const secondaryNavItems: NavItem[] = [
  { title: 'Filing Calendar', view: 'calendar', icon: Calendar },
  { title: 'Reports & Export', view: 'reports', icon: Download },
  { title: 'Audit Logs', view: 'audit-logs', icon: ScrollText },
  { title: 'Settings', view: 'settings', icon: Settings },
]

function SidebarNav() {
  const { currentView, setCurrentView } = useApp()
  const { state, setOpenMobile } = useSidebar()

  const handleNavClick = (view: AppView) => {
    setCurrentView(view)
    // Close mobile sidebar on navigation
    setOpenMobile(false)
  }

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border/50 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              GSTPilot
            </span>
            <span className="inline-flex items-center rounded-md bg-gradient-to-r from-emerald-500/15 to-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              AI Pro
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const isActive = currentView === item.view
                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleNavClick(item.view)}
                      tooltip={item.title}
                      className={`
                        group relative h-9 rounded-lg transition-all duration-200 ease-in-out
                        ${
                          isActive
                            ? 'bg-emerald-500/10 font-semibold text-emerald-600 hover:bg-emerald-500/15 hover:text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        }
                      `}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-500 transition-all duration-200" />
                      )}
                      <item.icon
                        className={`h-4 w-4 transition-colors duration-200 ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                        }`}
                      />
                      <span className="transition-colors duration-200">
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Secondary Navigation */}
        <SidebarGroup className="mt-1">
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavItems.map((item) => {
                const isActive = currentView === item.view
                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleNavClick(item.view)}
                      tooltip={item.title}
                      className={`
                        group relative h-9 rounded-lg transition-all duration-200 ease-in-out
                        ${
                          isActive
                            ? 'bg-emerald-500/10 font-semibold text-emerald-600 hover:bg-emerald-500/15 hover:text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        }
                      `}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-500 transition-all duration-200" />
                      )}
                      <item.icon
                        className={`h-4 w-4 transition-colors duration-200 ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                        }`}
                      />
                      <span className="transition-colors duration-200">
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-sidebar-foreground/40">
            v2.0 Production
          </span>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Online
            </span>
          </div>
        </div>
      </SidebarFooter>
    </>
  )
}

export function AppSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/50"
    >
      <SidebarNav />
    </Sidebar>
  )
}

export {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}
