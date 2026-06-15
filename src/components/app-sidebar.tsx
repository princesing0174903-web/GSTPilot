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
  Search,
  FileScan,
  Users,
  Settings,
  Zap,
  Building2,
  LogOut,
  Bell,
} from 'lucide-react'
import { useApp, type AppView } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { useFireUnreadNotifications } from '@/hooks/use-firestore'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  title: string
  view: AppView
  icon: React.ElementType
  subtitle?: string
}

const workflowItems: NavItem[] = [
  { title: 'Dashboard', view: 'dashboard', icon: LayoutDashboard, subtitle: 'Command Center' },
  { title: 'Returns', view: 'returns', icon: FileText, subtitle: 'Filing Workspace' },
  { title: 'Reconcile', view: 'reconcile', icon: Search, subtitle: 'Investigation Center' },
  { title: 'Invoices', view: 'invoices', icon: FileScan, subtitle: 'Processing Center' },
]

const manageItems: NavItem[] = [
  { title: 'Clients', view: 'clients', icon: Users, subtitle: 'Client Portfolio' },
  { title: 'Settings', view: 'settings', icon: Settings, subtitle: 'Workspace' },
]

function SidebarNav() {
  const { currentView, setCurrentView } = useApp()
  const { user, logout } = useAuth()
  const { setOpenMobile } = useSidebar()
  const { data: unreadNotifs } = useFireUnreadNotifications()
  const unreadCount = unreadNotifs.length

  const handleNavClick = (view: AppView) => {
    setCurrentView(view)
    setOpenMobile(false)
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  const renderNavItem = (item: NavItem) => {
    const isActive = currentView === item.view || (currentView === 'client-workspace' && item.view === 'clients')
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
  }

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border/50 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 shadow-md shadow-emerald-600/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
                GSTPilot
              </span>
              <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-500">
                AI
              </span>
            </div>
            {user?.firmName && (
              <span className="text-[10px] text-sidebar-foreground/40 truncate max-w-[160px]">
                {user.firmName}
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Workflow
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {workflowItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="px-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {manageItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors outline-none text-left">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 hidden group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || 'User'}</span>
              </div>
              <span className="text-[10px] text-sidebar-foreground/40 truncate block">{user?.email || ''}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
              </div>
            </div>
            {user?.firmName && (
              <>
                <DropdownMenuSeparator />
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">{user.firmName}</span>
                </div>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleNavClick('settings')} className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center justify-between mt-2 px-1 hidden group-data-[collapsible=icon]:hidden">
          <span className="text-[10px] font-medium text-sidebar-foreground/30">
            GSTPilot v2.0
          </span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="flex items-center gap-1">
                <Bell className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-medium text-amber-600">{unreadCount}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Live
              </span>
            </div>
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
