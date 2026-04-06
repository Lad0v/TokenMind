"use client"

import * as React from "react"
import {
  Search,
  Filter,
  Eye,
  Calendar,
  Clock,
  User,
  Activity,
  FileText,
  Shield,
  Coins,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

type AuditCategory = "kyc" | "ip_review" | "asset" | "listing" | "user" | "system"
type AuditSeverity = "info" | "warning" | "error" | "critical"

interface AuditLog {
  id: string
  timestamp: string
  category: AuditCategory
  action: string
  actor: {
    id: string
    name: string
    role: "admin" | "user" | "system"
  }
  target: {
    type: string
    id: string
    name?: string
  }
  severity: AuditSeverity
  ipAddress: string
  userAgent: string
  details: string
  payload: Record<string, unknown>
  changes?: {
    field: string
    oldValue: string
    newValue: string
  }[]
}

const mockAuditLogs: AuditLog[] = [
  {
    id: "LOG-001",
    timestamp: "2026-04-03T14:32:15",
    category: "kyc",
    action: "KYC_APPROVED",
    actor: { id: "ADM-001", name: "Admin User", role: "admin" },
    target: { type: "KYC Application", id: "KYC-001", name: "John Smith" },
    severity: "info",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0",
    details: "KYC application approved after manual review",
    payload: {
      applicationId: "KYC-001",
      userId: "USR-12345",
      status: "approved",
      reviewNotes: "All documents verified successfully",
    },
    changes: [
      { field: "status", oldValue: "pending", newValue: "approved" },
      { field: "reviewedAt", oldValue: "", newValue: "2026-04-03T14:32:15" },
    ],
  },
  {
    id: "LOG-002",
    timestamp: "2026-04-03T14:15:00",
    category: "ip_review",
    action: "PATENT_CLAIM_SUBMITTED",
    actor: { id: "USR-12346", name: "Tech Innovations Inc", role: "user" },
    target: { type: "Patent Claim", id: "IP-001", name: "ML Pattern Recognition Algorithm" },
    severity: "info",
    ipAddress: "203.45.67.89",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.0",
    details: "New patent claim submitted for review",
    payload: {
      claimId: "IP-001",
      patentNumber: "US10123456B2",
      documents: ["patent_certificate.pdf", "assignment.pdf"],
    },
  },
  {
    id: "LOG-003",
    timestamp: "2026-04-03T13:45:30",
    category: "asset",
    action: "ASSET_TOKENIZED",
    actor: { id: "SYS", name: "System", role: "system" },
    target: { type: "Asset", id: "ASSET-002", name: "Sustainable Energy Storage" },
    severity: "info",
    ipAddress: "10.0.0.1",
    userAgent: "VeriMint-System/1.0",
    details: "Asset successfully tokenized on Solana blockchain",
    payload: {
      assetId: "ASSET-002",
      tokenAddress: "4mR2...8vWx",
      totalSupply: 500000,
      transactionHash: "3xYz...9kLm",
    },
  },
  {
    id: "LOG-004",
    timestamp: "2026-04-03T12:30:00",
    category: "kyc",
    action: "KYC_REJECTED",
    actor: { id: "ADM-001", name: "Admin User", role: "admin" },
    target: { type: "KYC Application", id: "KYC-005", name: "Wei Chen" },
    severity: "warning",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0",
    details: "KYC application rejected due to expired document",
    payload: {
      applicationId: "KYC-005",
      reason: "Expired document submitted",
      rejectionCode: "DOC_EXPIRED",
    },
    changes: [
      { field: "status", oldValue: "manual_review", newValue: "rejected" },
    ],
  },
  {
    id: "LOG-005",
    timestamp: "2026-04-03T11:00:00",
    category: "listing",
    action: "LISTING_PAUSED",
    actor: { id: "ADM-002", name: "Security Admin", role: "admin" },
    target: { type: "Listing", id: "LST-003", name: "Biotech Drug Delivery System" },
    severity: "warning",
    ipAddress: "192.168.1.101",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/123.0",
    details: "Listing paused due to compliance review",
    payload: {
      listingId: "LST-003",
      reason: "Compliance review requested",
      pausedBy: "ADM-002",
    },
  },
  {
    id: "LOG-006",
    timestamp: "2026-04-03T10:15:00",
    category: "system",
    action: "LOGIN_FAILED",
    actor: { id: "UNKNOWN", name: "Unknown", role: "user" },
    target: { type: "Auth", id: "AUTH", name: "Login Attempt" },
    severity: "error",
    ipAddress: "45.67.89.123",
    userAgent: "curl/7.68.0",
    details: "Multiple failed login attempts detected",
    payload: {
      attemptedEmail: "admin@verimint.com",
      failedAttempts: 5,
      blocked: true,
    },
  },
  {
    id: "LOG-007",
    timestamp: "2026-04-03T09:00:00",
    category: "ip_review",
    action: "PATENT_CLAIM_APPROVED",
    actor: { id: "ADM-001", name: "Admin User", role: "admin" },
    target: { type: "Patent Claim", id: "IP-004", name: "Blockchain Supply Chain" },
    severity: "info",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0",
    details: "Patent claim approved for tokenization",
    payload: {
      claimId: "IP-004",
      patentNumber: "US98765432B1",
      approvedFor: "tokenization",
    },
  },
  {
    id: "LOG-008",
    timestamp: "2026-04-02T16:00:00",
    category: "user",
    action: "WALLET_CONNECTED",
    actor: { id: "USR-12350", name: "New Investor", role: "user" },
    target: { type: "Wallet", id: "WALLET", name: "Phantom Wallet" },
    severity: "info",
    ipAddress: "78.90.12.34",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/17.0",
    details: "User connected Solana wallet to platform",
    payload: {
      walletAddress: "5xPq...7mNr",
      walletType: "Phantom",
      userId: "USR-12350",
    },
  },
  {
    id: "LOG-009",
    timestamp: "2026-04-02T14:30:00",
    category: "system",
    action: "DATABASE_BACKUP",
    actor: { id: "SYS", name: "System", role: "system" },
    target: { type: "Database", id: "DB-MAIN", name: "Main Database" },
    severity: "info",
    ipAddress: "10.0.0.1",
    userAgent: "VeriMint-Backup/1.0",
    details: "Scheduled database backup completed successfully",
    payload: {
      backupId: "BKP-20260402-001",
      size: "2.5GB",
      duration: "45s",
      location: "s3://verimint-backups/",
    },
  },
  {
    id: "LOG-010",
    timestamp: "2026-04-02T10:00:00",
    category: "system",
    action: "SECURITY_ALERT",
    actor: { id: "SYS", name: "Security System", role: "system" },
    target: { type: "Security", id: "SEC", name: "Intrusion Detection" },
    severity: "critical",
    ipAddress: "10.0.0.1",
    userAgent: "VeriMint-Security/1.0",
    details: "Potential SQL injection attempt detected and blocked",
    payload: {
      attackType: "SQL Injection",
      sourceIp: "123.45.67.89",
      blocked: true,
      endpoint: "/api/search",
    },
  },
]

function getCategoryIcon(category: AuditCategory) {
  switch (category) {
    case "kyc":
      return <User className="h-4 w-4" />
    case "ip_review":
      return <FileText className="h-4 w-4" />
    case "asset":
      return <Coins className="h-4 w-4" />
    case "listing":
      return <Activity className="h-4 w-4" />
    case "user":
      return <User className="h-4 w-4" />
    case "system":
      return <Shield className="h-4 w-4" />
  }
}

function getCategoryBadge(category: AuditCategory) {
  const colors = {
    kyc: "text-blue-500 border-blue-500/30",
    ip_review: "text-purple-500 border-purple-500/30",
    asset: "text-primary border-primary/30",
    listing: "text-cyan-500 border-cyan-500/30",
    user: "text-orange-500 border-orange-500/30",
    system: "text-gray-500 border-gray-500/30",
  }
  const labels = {
    kyc: "KYC",
    ip_review: "IP Review",
    asset: "Asset",
    listing: "Listing",
    user: "User",
    system: "System",
  }
  return (
    <Badge variant="outline" className={colors[category]}>
      {getCategoryIcon(category)}
      <span className="ml-1">{labels[category]}</span>
    </Badge>
  )
}

function getSeverityBadge(severity: AuditSeverity) {
  switch (severity) {
    case "info":
      return (
        <Badge variant="secondary" className="bg-muted">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Info
        </Badge>
      )
    case "warning":
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
          <AlertCircle className="mr-1 h-3 w-3" />
          Warning
        </Badge>
      )
    case "error":
      return (
        <Badge variant="outline" className="text-orange-500 border-orange-500/30">
          <XCircle className="mr-1 h-3 w-3" />
          Error
        </Badge>
      )
    case "critical":
      return (
        <Badge variant="destructive">
          <AlertCircle className="mr-1 h-3 w-3" />
          Critical
        </Badge>
      )
  }
}

function getRoleBadge(role: "admin" | "user" | "system") {
  switch (role) {
    case "admin":
      return <Badge className="bg-primary/20 text-primary border-primary/30">Admin</Badge>
    case "user":
      return <Badge variant="secondary">User</Badge>
    case "system":
      return <Badge variant="outline">System</Badge>
  }
}

export default function AuditLogsPage() {
  const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null)
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [severityFilter, setSeverityFilter] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredData = mockAuditLogs.filter((log) => {
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter
    const matchesSeverity = severityFilter === "all" || log.severity === severityFilter
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSeverity && matchesSearch
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">Track all platform activities and security events</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events Today</p>
                <p className="text-2xl font-bold text-foreground">
                  {mockAuditLogs.filter((l) => 
                    new Date(l.timestamp).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {mockAuditLogs.filter((l) => l.severity === "warning").length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-orange-500">
                  {mockAuditLogs.filter((l) => l.severity === "error").length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-destructive">
                  {mockAuditLogs.filter((l) => l.severity === "critical").length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by action, actor, or target..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] bg-input border-border">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="kyc">KYC</SelectItem>
                  <SelectItem value="ip_review">IP Review</SelectItem>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="listing">Listing</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px] bg-input border-border">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Timestamp</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((log) => (
                <TableRow key={log.id} className="border-border">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryBadge(log.category)}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{log.action}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(log.actor.role)}
                      <span className="text-sm">{log.actor.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col max-w-xs">
                      <span className="text-sm truncate">{log.target.name || log.target.id}</span>
                      <span className="text-xs text-muted-foreground">{log.target.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-xl">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Audit Log {selectedLog.id}
                  {getSeverityBadge(selectedLog.severity)}
                </DialogTitle>
                <DialogDescription>
                  {selectedLog.action} at {new Date(selectedLog.timestamp).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 flex flex-col gap-6 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent">
                {/* Event Info */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Event Information</h3>
                  <div className="grid gap-3 rounded-lg border border-border p-4 bg-secondary/20">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Category</span>
                      {getCategoryBadge(selectedLog.category)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Action</span>
                      <span className="font-mono text-sm">{selectedLog.action}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Timestamp</span>
                      <span className="text-sm">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedLog.details}</p>
                </div>

                <Separator />

                {/* Actor Info */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Actor</h3>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Name</span>
                      <span className="text-sm">{selectedLog.actor.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Role</span>
                      {getRoleBadge(selectedLog.actor.role)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">IP Address</span>
                      <span className="font-mono text-sm">{selectedLog.ipAddress}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Target Info */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Target</h3>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Type</span>
                      <span className="text-sm">{selectedLog.target.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">ID</span>
                      <span className="font-mono text-sm">{selectedLog.target.id}</span>
                    </div>
                    {selectedLog.target.name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Name</span>
                        <span className="text-sm">{selectedLog.target.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Changes */}
                {selectedLog.changes && selectedLog.changes.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-4">
                      <h3 className="font-semibold text-foreground">Changes</h3>
                      <div className="grid gap-2">
                        {selectedLog.changes.map((change, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border border-border p-3 bg-secondary/20"
                          >
                            <span className="text-sm font-medium">{change.field}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-destructive line-through">
                                {change.oldValue || "(empty)"}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-sm text-primary">{change.newValue}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Payload */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Payload</h3>
                  <ScrollArea className="h-[200px] rounded-lg border border-border bg-secondary/20 p-4">
                    <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>

                <Separator />

                {/* Technical Details */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Technical Details</h3>
                  <div className="grid gap-3 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">User Agent</span>
                      <span className="font-mono text-xs break-all">{selectedLog.userAgent}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
