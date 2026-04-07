"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  UserCheck,
  FileCheck2,
  Coins,
  ScrollText,
  LogOut,
  ChevronLeft,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar"
import {IPChainLogo} from "@/components/ipchain-logo";
import { getDefaultRouteForRole } from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "KYC Queue",
    href: "/admin/kyc",
    icon: UserCheck,
  },
  {
    title: "IP Reviews",
    href: "/admin/ip-reviews",
    icon: FileCheck2,
  },
  {
    title: "Assets",
    href: "/admin/assets",
    icon: Coins,
  },
  {
    title: "Audit Logs",
    href: "/admin/audit",
    icon: ScrollText,
  },
]

function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        {/*<Link href="/admin" className="flex items-center gap-3">*/}
        {/*  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">*/}
        {/*    <Shield className="h-5 w-5 text-primary-foreground" />*/}
        {/*  </div>*/}
        {/*  <div className="flex flex-col group-data-[collapsible=icon]:hidden">*/}
        {/*    <span className="font-semibold text-foreground">VeriMint</span>*/}
        {/*    <span className="text-xs text-muted-foreground">Admin Panel</span>*/}
        {/*  </div>*/}
        {/*</Link>*/}

        <Link href="/" className="flex items-center gap-2">
          <IPChainLogo/>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to Site">
              <Link href="/">
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Site</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Logout">
              <Link href="/auth/login">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { status, user, logout } = useSession()

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login")
      return
    }

    if (
      status === "authenticated" &&
      user &&
      !["admin", "compliance_officer"].includes(user.role)
    ) {
      router.replace(getDefaultRouteForRole(user.role))
    }
  }, [router, status, user])

  if (status === "loading" || (user && !["admin", "compliance_officer"].includes(user.role))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading admin workspace...
      </div>
    )
  }

  if (status === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Redirecting to sign in...
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background px-6">
          <SidebarTrigger className="-ml-2" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {(user.name?.[0] || user.email[0] || "A").toUpperCase()}
            </div>
            <span className="text-sm font-medium">{user.name || user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout()
                router.replace("/auth/login")
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
