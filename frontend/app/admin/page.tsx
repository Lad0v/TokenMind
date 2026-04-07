"use client"

import {
  UserCheck,
  FileCheck2,
  Coins,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from "recharts";


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


const stats = [
  {
    title: "Pending KYC",
    value: "23",
    change: "+5",
    trend: "up",
    icon: UserCheck,
    description: "Awaiting review",
  },
  {
    title: "Pending IP Reviews",
    value: "12",
    change: "+3",
    trend: "up",
    icon: FileCheck2,
    description: "Patent claims to review",
  },
  {
    title: "Assets Awaiting Tokenization",
    value: "8",
    change: "-2",
    trend: "down",
    icon: Coins,
    description: "Ready for minting",
  },
  {
    title: "Active Listings",
    value: "156",
    change: "+12",
    trend: "up",
    icon: ShoppingCart,
    description: "On marketplace",
  },
]

const recentActivity = [
  {
    id: 1,
    type: "kyc",
    action: "KYC Approved",
    user: "John Smith",
    time: "2 min ago",
    status: "success",
  },
  {
    id: 2,
    type: "ip",
    action: "Patent Claim Submitted",
    user: "Tech Corp Ltd",
    time: "15 min ago",
    status: "pending",
  },
  {
    id: 3,
    type: "asset",
    action: "Asset Tokenized",
    user: "Innovation Labs",
    time: "1 hour ago",
    status: "success",
  },
  {
    id: 4,
    type: "kyc",
    action: "KYC Rejected",
    user: "Anonymous User",
    time: "2 hours ago",
    status: "rejected",
  },
  {
    id: 5,
    type: "listing",
    action: "New Listing Created",
    user: "Patent Holder Inc",
    time: "3 hours ago",
    status: "success",
  },
]

const pendingItems = [
  {
    id: 1,
    type: "KYC",
    title: "Identity Verification",
    user: "Alice Johnson",
    submitted: "10 min ago",
    priority: "high",
  },
  {
    id: 2,
    type: "IP Review",
    title: "US Patent #12345678",
    user: "Tech Innovations Inc",
    submitted: "30 min ago",
    priority: "medium",
  },
  {
    id: 3,
    type: "KYC",
    title: "Business Verification",
    user: "Global Solutions LLC",
    submitted: "1 hour ago",
    priority: "low",
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge className="bg-primary/20 text-primary border-primary/30">Completed</Badge>
    case "pending":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Pending</Badge>
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return <Badge variant="destructive">High</Badge>
    case "medium":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Medium</Badge>
    case "low":
      return <Badge variant="secondary">Low</Badge>
    default:
      return <Badge variant="secondary">{priority}</Badge>
  }
}

export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of platform activity and pending tasks</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{stat.value}</span>
                <span
                  className={`flex items-center text-xs font-medium ${
                    stat.trend === "up" ? "text-primary" : "text-destructive"
                  }`}
                >
                  {stat.trend === "up" ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {stat.change}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
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
          </CardContent>
        </Card>

        {/* Pending Items */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Pending Review</CardTitle>
            <CardDescription>Items requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.user} • {item.submitted}
                    </p>
                  </div>
                  {getPriorityBadge(item.priority)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Graphics ------------------------------------------- */}

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
      </div>
    </div>
  )
}
