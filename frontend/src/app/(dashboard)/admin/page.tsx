"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  FileCheck,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

// Mock data for charts
const registrationData = [
  { month: "Jan", users: 45 },
  { month: "Feb", users: 52 },
  { month: "Mar", users: 78 },
  { month: "Apr", users: 110 },
  { month: "May", users: 156 },
  { month: "Jun", users: 203 },
]

const kycData = [
  { month: "Jan", approved: 32, rejected: 8, pending: 5 },
  { month: "Feb", approved: 41, rejected: 6, pending: 5 },
  { month: "Mar", approved: 58, rejected: 12, pending: 8 },
  { month: "Apr", approved: 89, rejected: 15, pending: 6 },
  { month: "May", approved: 124, rejected: 22, pending: 10 },
  { month: "Jun", approved: 168, rejected: 25, pending: 10 },
]

const claimsData = [
  { month: "Jan", patents: 12, trademarks: 18, copyrights: 8 },
  { month: "Feb", patents: 15, trademarks: 22, copyrights: 12 },
  { month: "Mar", patents: 21, trademarks: 28, copyrights: 18 },
  { month: "Apr", patents: 28, trademarks: 35, copyrights: 24 },
  { month: "May", patents: 35, trademarks: 42, copyrights: 31 },
  { month: "Jun", patents: 45, trademarks: 52, copyrights: 38 },
]

// Mock recent activity
const recentActivity = [
  { id: 1, type: "kyc", action: "approved", user: "alex.eth", time: "2 min ago" },
  { id: 2, type: "claim", action: "submitted", user: "maria.sol", time: "15 min ago" },
  { id: 3, type: "kyc", action: "rejected", user: "john_doe", time: "32 min ago" },
  { id: 4, type: "claim", action: "approved", user: "elena.nft", time: "1 hour ago" },
  { id: 5, type: "user", action: "registered", user: "new_user_42", time: "2 hours ago" },
]

const stats = [
  {
    title: "Total Users",
    value: "2,847",
    change: "+12.5%",
    trend: "up",
    icon: Users,
    description: "vs last month",
  },
  {
    title: "KYC Pending",
    value: "23",
    change: "-8.2%",
    trend: "down",
    icon: ShieldCheck,
    description: "vs last month",
  },
  {
    title: "IP Claims",
    value: "1,234",
    change: "+23.1%",
    trend: "up",
    icon: FileCheck,
    description: "vs last month",
  },
  {
    title: "Approval Rate",
    value: "94.2%",
    change: "+2.4%",
    trend: "up",
    icon: TrendingUp,
    description: "vs last month",
  },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of VeriMint platform activity
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/admin/kyc">View KYC Queue</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/claims">Review Claims</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center gap-1 text-xs">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-primary" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={
                    stat.trend === "up" ? "text-primary" : "text-destructive"
                  }
                >
                  {stat.change}
                </span>
                <span className="text-muted-foreground">{stat.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* User Registrations Chart */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>User Registrations</CardTitle>
            <CardDescription>Monthly new user sign-ups</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={registrationData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(155, 10%, 25%)" />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(155, 10%, 50%)"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(155, 10%, 50%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(160, 10%, 14%)",
                      border: "1px solid hsl(155, 15%, 28%)",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="hsl(155, 70%, 45%)"
                    fillOpacity={1}
                    fill="url(#colorUsers)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* KYC Status Chart */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>KYC Verifications</CardTitle>
            <CardDescription>Monthly verification outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kycData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(155, 10%, 25%)" />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(155, 10%, 50%)"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(155, 10%, 50%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(160, 10%, 14%)",
                      border: "1px solid hsl(155, 15%, 28%)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="approved"
                    fill="hsl(155, 70%, 45%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="rejected"
                    fill="hsl(27, 80%, 50%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    fill="hsl(85, 50%, 50%)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IP Claims & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* IP Claims by Type */}
        <Card className="bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle>IP Claims by Type</CardTitle>
            <CardDescription>Monthly claims categorized by IP type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={claimsData}>
                  <defs>
                    <linearGradient id="colorPatents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(155, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTrademarks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(230, 50%, 55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(230, 50%, 55%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCopyrights" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(85, 50%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(85, 50%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(155, 10%, 25%)" />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(155, 10%, 50%)"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(155, 10%, 50%)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(160, 10%, 14%)",
                      border: "1px solid hsl(155, 15%, 28%)",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="patents"
                    stroke="hsl(155, 70%, 45%)"
                    fillOpacity={1}
                    fill="url(#colorPatents)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="trademarks"
                    stroke="hsl(230, 50%, 55%)"
                    fillOpacity={1}
                    fill="url(#colorTrademarks)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="copyrights"
                    stroke="hsl(85, 50%, 50%)"
                    fillOpacity={1}
                    fill="url(#colorCopyrights)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex gap-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Patents</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "hsl(230, 50%, 55%)" }} />
                <span className="text-sm text-muted-foreground">Trademarks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "hsl(85, 50%, 50%)" }} />
                <span className="text-sm text-muted-foreground">Copyrights</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
                >
                  <div className="mt-0.5">
                    {activity.action === "approved" && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {activity.action === "rejected" && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {activity.action === "submitted" && (
                      <AlertCircle className="h-4 w-4 text-warning" />
                    )}
                    {activity.action === "registered" && (
                      <Users className="h-4 w-4 text-info" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {activity.user}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.type === "kyc" && "KYC "}
                      {activity.type === "claim" && "IP Claim "}
                      {activity.type === "user" && "User "}
                      {activity.action}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Pending Actions</CardTitle>
          <CardDescription>Items requiring your attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/admin/kyc"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">KYC Verifications</p>
                  <p className="text-sm text-muted-foreground">23 pending</p>
                </div>
              </div>
              <Badge variant="secondary">Urgent</Badge>
            </Link>
            <Link
              href="/admin/claims"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">IP Claims</p>
                  <p className="text-sm text-muted-foreground">12 pending</p>
                </div>
              </div>
              <Badge variant="outline">Review</Badge>
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">New Users</p>
                  <p className="text-sm text-muted-foreground">5 today</p>
                </div>
              </div>
              <Badge variant="outline">Info</Badge>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
