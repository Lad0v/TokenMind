"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Clock,
  Coins,
  FileCheck2,
  Loader2,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { adminApi, claimsApi, marketplaceApi, type AuditLogResponse, type IpClaim, type MarketplaceListing, type VerificationCaseResponse } from "@/lib/api"
import { formatStableDateTime, formatStableMonth } from "@/lib/date-format"

type DashboardKpi = {
  title: string
  value: string
  change: string
  trend: "up" | "down"
  icon: typeof UserCheck
  description: string
}

type RecentActivity = {
  id: string
  action: string
  user: string
  time: string
  status: "success" | "pending" | "rejected"
}

type PendingItem = {
  id: string
  type: string
  title: string
  user: string
  submitted: string
  priority: "high" | "medium" | "low"
  href: string
}

type RegistrationPoint = {
  month: string
  users: number
}

type VerificationPoint = {
  month: string
  approved: number
  rejected: number
  pending: number
}

type ClaimPoint = {
  month: string
  submitted: number
  approved: number
  rejected: number
}

type DashboardState = {
  kpis: DashboardKpi[]
  recentActivity: RecentActivity[]
  pendingItems: PendingItem[]
  registrationData: RegistrationPoint[]
  verificationData: VerificationPoint[]
  claimData: ClaimPoint[]
}

const EMPTY_DASHBOARD: DashboardState = {
  kpis: [],
  recentActivity: [],
  pendingItems: [],
  registrationData: [],
  verificationData: [],
  claimData: [],
}

function getStatusBadge(status: RecentActivity["status"]) {
  switch (status) {
    case "success":
      return <Badge className="border-primary/30 bg-primary/20 text-primary">Completed</Badge>
    case "pending":
      return <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">Pending</Badge>
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>
  }
}

function getPriorityBadge(priority: PendingItem["priority"]) {
  switch (priority) {
    case "high":
      return <Badge variant="destructive">High</Badge>
    case "medium":
      return <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">Medium</Badge>
    case "low":
      return <Badge variant="secondary">Low</Badge>
  }
}

function getMonthsWindow() {
  const months: string[] = []
  const now = new Date()
  const currentUtcMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)

  for (let index = 5; index >= 0; index -= 1) {
    const point = new Date(currentUtcMonth)
    point.setUTCMonth(point.getUTCMonth() - index)
    months.push(point.toISOString().slice(0, 7))
  }

  return months
}

function monthLabel(monthKey: string) {
  return formatStableMonth(new Date(`${monthKey}-01T00:00:00Z`))
}

function monthKeyOf(value?: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.includes("Z") || /[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString().slice(0, 7)
}

function buildRegistrationData(userDates: string[]) {
  const months = getMonthsWindow()
  const counts = new Map(months.map((month) => [month, 0]))

  for (const createdAt of userDates) {
    const key = monthKeyOf(createdAt)
    if (key && counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return months.map((month) => ({
    month: monthLabel(month),
    users: counts.get(month) ?? 0,
  }))
}

function buildVerificationData(cases: VerificationCaseResponse[]) {
  const months = getMonthsWindow()
  const counts = new Map(months.map((month) => [month, { approved: 0, rejected: 0, pending: 0 }]))

  for (const item of cases) {
    const basis = item.reviewed_at ?? item.updated_at ?? item.created_at
    const key = monthKeyOf(basis)
    if (!key || !counts.has(key)) {
      continue
    }

    const target = counts.get(key)
    if (!target) {
      continue
    }

    if (item.status === "approved") {
      target.approved += 1
    } else if (item.status === "rejected") {
      target.rejected += 1
    } else if (item.status === "pending") {
      target.pending += 1
    }
  }

  return months.map((month) => ({
    month: monthLabel(month),
    ...counts.get(month)!,
  }))
}

function buildClaimData(claims: IpClaim[]) {
  const months = getMonthsWindow()
  const counts = new Map(months.map((month) => [month, { submitted: 0, approved: 0, rejected: 0 }]))

  for (const item of claims) {
    const key = monthKeyOf(item.created_at)
    if (!key || !counts.has(key)) {
      continue
    }

    const target = counts.get(key)
    if (!target) {
      continue
    }

    if (item.status === "approved") {
      target.approved += 1
    } else if (item.status === "rejected") {
      target.rejected += 1
    } else {
      target.submitted += 1
    }
  }

  return months.map((month) => ({
    month: monthLabel(month),
    ...counts.get(month)!,
  }))
}

function resolveActivityStatus(item: AuditLogResponse): RecentActivity["status"] {
  if (item.severity === "error" || item.severity === "warning" || item.action.includes("reject")) {
    return "rejected"
  }
  if (item.action.includes("created") || item.action.includes("pending")) {
    return "pending"
  }
  return "success"
}

function humanizeAction(action: string) {
  return action
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildRecentActivity(logs: AuditLogResponse[]) {
  return logs.slice(0, 6).map((item) => ({
    id: item.id,
    action: humanizeAction(item.action),
    user: item.actor?.email ?? item.entity_type,
    time: formatStableDateTime(item.created_at),
    status: resolveActivityStatus(item),
  }))
}

function buildPendingItems(cases: VerificationCaseResponse[], claims: IpClaim[]) {
  const verificationItems = cases
    .filter((item) => item.status === "pending")
    .slice(0, 3)
    .map<PendingItem>((item) => ({
      id: item.id,
      type: "KYC",
      title: item.user?.full_name || item.user?.email || item.id,
      user: item.user?.email || "Unknown user",
      submitted: formatStableDateTime(item.created_at),
      priority: "high",
      href: "/admin/kyc",
    }))

  const claimItems = claims
    .filter((item) => item.status === "submitted" || item.status === "under_review")
    .slice(0, 3)
    .map<PendingItem>((item) => ({
      id: item.id,
      type: "IP Review",
      title: item.patent_number,
      user: item.issuer_email || item.claimed_owner_name,
      submitted: formatStableDateTime(item.created_at),
      priority: item.status === "under_review" ? "high" : "medium",
      href: "/admin/ip-reviews",
    }))

  return [...verificationItems, ...claimItems].slice(0, 6)
}

function buildKpis(
  cases: VerificationCaseResponse[],
  claims: IpClaim[],
  listings: MarketplaceListing[],
  totalUsers: number,
): DashboardKpi[] {
  const pendingKyc = cases.filter((item) => item.status === "pending").length
  const pendingClaims = claims.filter((item) => item.status === "submitted" || item.status === "under_review").length
  const onChainAssets = listings.filter((item) => item.mint_address || item.external_metadata?.tokenization).length
  const activeListings = listings.filter((item) => item.status === "active").length

  return [
    {
      title: "Pending KYC",
      value: String(pendingKyc),
      change: `${cases.filter((item) => item.status === "approved").length} approved`,
      trend: pendingKyc > 0 ? "up" : "down",
      icon: UserCheck,
      description: "Awaiting review",
    },
    {
      title: "Pending IP Reviews",
      value: String(pendingClaims),
      change: `${claims.filter((item) => item.status === "approved").length} approved`,
      trend: pendingClaims > 0 ? "up" : "down",
      icon: FileCheck2,
      description: "Patent claims to review",
    },
    {
      title: "Tokenized Assets",
      value: String(onChainAssets),
      change: `${listings.length} total`,
      trend: onChainAssets > 0 ? "up" : "down",
      icon: Coins,
      description: "Minted or contract-backed assets",
    },
    {
      title: "Active Listings",
      value: String(activeListings),
      change: `${totalUsers} users`,
      trend: activeListings > 0 ? "up" : "down",
      icon: ShoppingCart,
      description: "On marketplace",
    },
  ]
}

export default function AdminDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardState>(EMPTY_DASHBOARD)

  useEffect(() => {
    let cancelled = false

    const loadDashboard = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const [users, verificationCases, claims, listings, auditLogs] = await Promise.all([
          adminApi.listUsers(),
          adminApi.listVerificationCases(),
          claimsApi.list(),
          marketplaceApi.listListings(),
          adminApi.listAuditLogs(),
        ])

        if (cancelled) {
          return
        }

        setDashboard({
          kpis: buildKpis(verificationCases.items, claims.items, listings.items, users.total),
          recentActivity: buildRecentActivity(auditLogs.items),
          pendingItems: buildPendingItems(verificationCases.items, claims.items),
          registrationData: buildRegistrationData(users.items.map((item) => item.created_at)),
          verificationData: buildVerificationData(verificationCases.items),
          claimData: buildClaimData(claims.items),
        })
      } catch (caughtError) {
        if (cancelled) {
          return
        }
        setError(caughtError instanceof Error ? caughtError.message : "Failed to load admin dashboard.")
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => dashboard.kpis, [dashboard.kpis])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Live overview of platform activity, queues and marketplace state</p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{isLoading ? "..." : stat.value}</span>
                <span className={`flex items-center text-xs font-medium ${stat.trend === "up" ? "text-primary" : "text-destructive"}`}>
                  {stat.trend === "up" ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                  {stat.change}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest actions across auth, KYC, IP review and marketplace</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dashboard.recentActivity.length === 0 ? (
              <div className="text-sm text-muted-foreground">No audit activity yet.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {dashboard.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                        {activity.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.user}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(activity.status)}
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Pending Review</CardTitle>
            <CardDescription>Live KYC and IP cases requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex min-h-[180px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dashboard.pendingItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No pending review items.</div>
            ) : (
              <div className="flex flex-col gap-4">
                {dashboard.pendingItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{item.type}</Badge>
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.user} • {item.submitted}</p>
                    </div>
                    {getPriorityBadge(item.priority)}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle>User Registrations</CardTitle>
            <CardDescription>Monthly new user sign-ups from the real database</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard.registrationData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(155, 10%, 25%)" />
                  <XAxis dataKey="month" stroke="hsl(155, 10%, 50%)" fontSize={12} />
                  <YAxis stroke="hsl(155, 10%, 50%)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(160, 10%, 14%)", border: "1px solid hsl(155, 15%, 28%)", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="users" stroke="hsl(155, 70%, 45%)" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle>KYC Verifications</CardTitle>
            <CardDescription>Approved, rejected and pending verification cases per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.verificationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(155, 10%, 25%)" />
                  <XAxis dataKey="month" stroke="hsl(155, 10%, 50%)" fontSize={12} />
                  <YAxis stroke="hsl(155, 10%, 50%)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(160, 10%, 14%)", border: "1px solid hsl(155, 15%, 28%)", borderRadius: "8px" }} />
                  <Bar dataKey="approved" fill="hsl(155, 70%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejected" fill="hsl(27, 80%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="hsl(85, 50%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle>IP Claims by Status</CardTitle>
            <CardDescription>Monthly claim volume split by current status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard.claimData}>
                  <defs>
                    <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(230, 50%, 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(230, 50%, 55%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(27, 80%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(27, 80%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(155, 10%, 25%)" />
                  <XAxis dataKey="month" stroke="hsl(155, 10%, 50%)" fontSize={12} />
                  <YAxis stroke="hsl(155, 10%, 50%)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(160, 10%, 14%)", border: "1px solid hsl(155, 15%, 28%)", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="submitted" stroke="hsl(230, 50%, 55%)" fillOpacity={1} fill="url(#colorSubmitted)" strokeWidth={2} />
                  <Area type="monotone" dataKey="approved" stroke="hsl(155, 70%, 45%)" fillOpacity={1} fill="url(#colorApproved)" strokeWidth={2} />
                  <Area type="monotone" dataKey="rejected" stroke="hsl(27, 80%, 50%)" fillOpacity={1} fill="url(#colorRejected)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex gap-6">
              <LegendDot color="hsl(230, 50%, 55%)" label="Submitted" />
              <LegendDot color="hsl(155, 70%, 45%)" label="Approved" />
              <LegendDot color="hsl(27, 80%, 50%)" label="Rejected" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
