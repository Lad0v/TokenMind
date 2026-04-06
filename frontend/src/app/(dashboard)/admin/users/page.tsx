"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Shield,
  Ban,
  CheckCircle2,
  Clock,
  Users,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  CreditCard,
  FileText,
  ShieldCheck,
  Activity,
  Lock,
  Unlock,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock Users data
const users = [
  {
    id: "USR-001",
    name: "Alexander Petrov",
    email: "alex.petrov@email.com",
    wallet: "8xH2K9mN3pL7jF4sD6wQ1rT5vB8cX0yA2eR9",
    avatar: null,
    role: "user",
    status: "active",
    kycStatus: "verified",
    createdAt: "2024-01-05T10:30:00Z",
    lastActive: "2024-01-15T14:20:00Z",
    claimsCount: 3,
    tokensOwned: 15000,
  },
  {
    id: "USR-002",
    name: "Maria Santos",
    email: "maria.santos@email.com",
    wallet: "5kL1mN9pX3jR7sT2vQ8wY4zA6bC0dE1fG2hI",
    avatar: null,
    role: "user",
    status: "active",
    kycStatus: "pending",
    createdAt: "2024-01-10T09:15:00Z",
    lastActive: "2024-01-15T12:45:00Z",
    claimsCount: 1,
    tokensOwned: 0,
  },
  {
    id: "USR-003",
    name: "John Smith",
    email: "john.smith@email.com",
    wallet: "3nP7mK2xL9jF5sD8wQ4rT1vB6cX0yA7eR2iO",
    avatar: null,
    role: "admin",
    status: "active",
    kycStatus: "verified",
    createdAt: "2023-12-01T14:20:00Z",
    lastActive: "2024-01-15T16:00:00Z",
    claimsCount: 0,
    tokensOwned: 0,
  },
  {
    id: "USR-004",
    name: "Elena Volkova",
    email: "elena.v@email.com",
    wallet: "9mK4jL7nP2xQ5sT8wR1vY6zA0bC3dE9fG4hI",
    avatar: null,
    role: "user",
    status: "suspended",
    kycStatus: "rejected",
    createdAt: "2024-01-08T11:00:00Z",
    lastActive: "2024-01-13T15:30:00Z",
    claimsCount: 2,
    tokensOwned: 5000,
    suspendReason: "Multiple failed KYC attempts with fraudulent documents",
  },
  {
    id: "USR-005",
    name: "Kenji Tanaka",
    email: "k.tanaka@email.com",
    wallet: "2pX8nM1kL4jF9sD3wQ7rT0vB5cX6yA8eR1iO",
    avatar: null,
    role: "user",
    status: "active",
    kycStatus: "verified",
    createdAt: "2024-01-12T08:00:00Z",
    lastActive: "2024-01-15T10:15:00Z",
    claimsCount: 5,
    tokensOwned: 42000,
  },
  {
    id: "USR-006",
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    wallet: "6jK4nM9pX2lR7sT5wQ3vY8zA1bC0dE4fG6hI",
    avatar: null,
    role: "moderator",
    status: "active",
    kycStatus: "verified",
    createdAt: "2023-11-15T09:30:00Z",
    lastActive: "2024-01-15T15:45:00Z",
    claimsCount: 0,
    tokensOwned: 0,
  },
  {
    id: "USR-007",
    name: "Michael Chen",
    email: "m.chen@email.com",
    wallet: "4mL8jK2nP6xR1sT9wQ5vY3zA7bC0dE2fG8hI",
    avatar: null,
    role: "user",
    status: "inactive",
    kycStatus: "unverified",
    createdAt: "2024-01-14T16:20:00Z",
    lastActive: "2024-01-14T16:25:00Z",
    claimsCount: 0,
    tokensOwned: 0,
  },
]

type User = typeof users[0]

const roleConfig = {
  user: { label: "User", color: "bg-secondary text-secondary-foreground" },
  admin: { label: "Admin", color: "bg-primary text-primary-foreground" },
  moderator: { label: "Moderator", color: "bg-blue-500/10 text-blue-400" },
}

const statusConfig = {
  active: { label: "Active", variant: "default" as const, icon: CheckCircle2 },
  inactive: { label: "Inactive", variant: "secondary" as const, icon: Clock },
  suspended: { label: "Suspended", variant: "destructive" as const, icon: Ban },
}

const kycStatusConfig = {
  verified: { label: "Verified", color: "text-primary" },
  pending: { label: "Pending", color: "text-amber-400" },
  rejected: { label: "Rejected", color: "text-destructive" },
  unverified: { label: "Unverified", color: "text-muted-foreground" },
}

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<"suspend" | "activate" | "changeRole" | null>(null)
  const [newRole, setNewRole] = useState<string>("")

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesStatus && matchesRole
  })

  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    verified: users.filter((u) => u.kycStatus === "verified").length,
    suspended: users.filter((u) => u.status === "suspended").length,
  }

  const openDetails = (user: User) => {
    setSelectedUser(user)
    setDetailsOpen(true)
  }

  const openActionDialog = (user: User, action: "suspend" | "activate" | "changeRole") => {
    setSelectedUser(user)
    setActionType(action)
    setNewRole(user.role)
    setActionDialogOpen(true)
  }

  const handleAction = () => {
    console.log(`${actionType} User:`, selectedUser?.id, actionType === "changeRole" ? newRole : "")
    setActionDialogOpen(false)
  }

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage platform users, roles, and permissions
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.verified}</p>
                <p className="text-sm text-muted-foreground">KYC Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <UserX className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.suspended}</p>
                <p className="text-sm text-muted-foreground">Suspended</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Role: {roleFilter === "all" ? "All" : roleConfig[roleFilter as keyof typeof roleConfig]?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setRoleFilter("all")}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter("user")}>User</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter("moderator")}>Moderator</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter("admin")}>Admin</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Status: {statusFilter === "all" ? "All" : statusConfig[statusFilter as keyof typeof statusConfig]?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setStatusFilter("all")}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("active")}>Active</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("inactive")}>Inactive</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("suspended")}>Suspended</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead>Claims</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const StatusIcon = statusConfig[user.status as keyof typeof statusConfig].icon
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {user.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleConfig[user.role as keyof typeof roleConfig].color}>
                        {roleConfig[user.role as keyof typeof roleConfig].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${kycStatusConfig[user.kycStatus as keyof typeof kycStatusConfig].color}`}>
                        {kycStatusConfig[user.kycStatus as keyof typeof kycStatusConfig].label}
                      </span>
                    </TableCell>
                    <TableCell>{user.claimsCount}</TableCell>
                    <TableCell>{user.tokensOwned.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[user.status as keyof typeof statusConfig].variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[user.status as keyof typeof statusConfig].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetails(user)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openActionDialog(user, "changeRole")}>
                            <Shield className="mr-2 h-4 w-4" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status === "suspended" ? (
                            <DropdownMenuItem onClick={() => openActionDialog(user, "activate")}>
                              <Unlock className="mr-2 h-4 w-4 text-primary" />
                              Activate User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => openActionDialog(user, "suspend")}>
                              <Lock className="mr-2 h-4 w-4 text-destructive" />
                              Suspend User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedUser.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {selectedUser.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span>{selectedUser.name}</span>
                    <div className="flex gap-2 mt-1">
                      <Badge className={roleConfig[selectedUser.role as keyof typeof roleConfig].color}>
                        {roleConfig[selectedUser.role as keyof typeof roleConfig].label}
                      </Badge>
                      <Badge variant={statusConfig[selectedUser.status as keyof typeof statusConfig].variant}>
                        {statusConfig[selectedUser.status as keyof typeof statusConfig].label}
                      </Badge>
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  User ID: {selectedUser.id}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="profile" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="assets">Assets</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{selectedUser.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Wallet:</span>
                        <span className="font-medium font-mono">{formatWallet(selectedUser.wallet)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">KYC Status:</span>
                        <span className={`font-medium ${kycStatusConfig[selectedUser.kycStatus as keyof typeof kycStatusConfig].color}`}>
                          {kycStatusConfig[selectedUser.kycStatus as keyof typeof kycStatusConfig].label}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Joined:</span>
                        <span className="font-medium">
                          {new Date(selectedUser.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Last Active:</span>
                        <span className="font-medium">
                          {new Date(selectedUser.lastActive).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedUser.status === "suspended" && selectedUser.suspendReason && (
                    <Card className="bg-destructive/10 border-destructive/20">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-2">
                          <Ban className="h-5 w-5 text-destructive mt-0.5" />
                          <div>
                            <p className="font-medium text-destructive">Suspension Reason</p>
                            <p className="text-sm text-destructive/80">{selectedUser.suspendReason}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 pb-4 border-b border-border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Last Login</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(selectedUser.lastActive).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pb-4 border-b border-border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">IP Claims Submitted</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedUser.claimsCount} claims total
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Account Created</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(selectedUser.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="assets" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="bg-secondary">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{selectedUser.claimsCount}</p>
                            <p className="text-sm text-muted-foreground">IP Claims</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-secondary">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <CreditCard className="h-6 w-6 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{selectedUser.tokensOwned.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">Tokens Owned</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => openActionDialog(selectedUser, "changeRole")}>
                  <Shield className="mr-2 h-4 w-4" />
                  Change Role
                </Button>
                {selectedUser.status === "suspended" ? (
                  <Button onClick={() => openActionDialog(selectedUser, "activate")}>
                    <Unlock className="mr-2 h-4 w-4" />
                    Activate User
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={() => openActionDialog(selectedUser, "suspend")}>
                    <Lock className="mr-2 h-4 w-4" />
                    Suspend User
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "suspend" && "Suspend User"}
              {actionType === "activate" && "Activate User"}
              {actionType === "changeRole" && "Change User Role"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "suspend" && `Are you sure you want to suspend ${selectedUser?.name}? They will lose access to the platform.`}
              {actionType === "activate" && `Are you sure you want to activate ${selectedUser?.name}? They will regain access to the platform.`}
              {actionType === "changeRole" && `Select a new role for ${selectedUser?.name}.`}
            </DialogDescription>
          </DialogHeader>

          {actionType === "changeRole" && (
            <div className="py-4">
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === "suspend" ? "destructive" : "default"}
              onClick={handleAction}
            >
              {actionType === "suspend" && "Suspend User"}
              {actionType === "activate" && "Activate User"}
              {actionType === "changeRole" && "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
