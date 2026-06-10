'use client'

import React from 'react'
import {
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
  useSidebar,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  FileText,
  ArrowLeftRight,
  Receipt,
  Users,
  Settings,
  Zap,
} from 'lucide-react'
import { useApp, type AppView } from '@/contexts/AppContext'

interface NavItem {
  title: string
  view: AppView
  icon: React.ElementType
  subtitle?: string
}

const navItems: NavItem[] = [
  { title: 'Dashboard', view: 'dashboard', icon: LayoutDashboard, subtitle: 'Overview' },
  { title: 'Returns', view: 'returns', icon: FileText, subtitle: 'GSTR Filing' },
  { title: 'Reconcile', view: 'reconcile', icon: ArrowLeftRight, subtitle: 'Match & Verify' },
  { title: 'Invoices', view: 'invoices', icon: Receipt, subtitle: 'Process & Classify' },
  { title: 'Clients', view: 'clients', icon: Users, subtitle: 'Manage Clients' },
  { title: 'Settings', view: 'settings', icon: Settings, subtitle: 'Configure' },
]

function SidebarNav() {
  const { currentView, setCurrentView } = useApp()
  const { setOpenMobile } = useSidebar()

  const handleNavClick = (view: AppView) => {
    setCurrentView(view)
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
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const isActive = currentView === item.view
                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleNavClick(item.view)}
                      tooltip={item.title}
                      className={`
                        group relative h-10 rounded-lg transition-all duration-200 ease-in-out
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
                        className={`h-[18px] w-[18px] transition-colors duration-200 ${
                          isActive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'
                        }`}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm leading-tight transition-colors duration-200">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="text-[10px] leading-tight text-sidebar-foreground/40">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
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
            GSTPilot v1.0
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
