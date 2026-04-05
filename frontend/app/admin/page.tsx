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
      </div>
    </div>
  )
}
