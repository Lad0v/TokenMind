"use client"

import * as React from "react"
import {
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Mail,
  Calendar,
  FileText,
  Download,
  ChevronDown,
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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

type KYCStatus = "pending" | "approved" | "rejected" | "manual_review"

interface KYCApplication {
  id: string
  userId: string
  fullName: string
  email: string
  documentType: string
  submittedAt: string
  status: KYCStatus
  riskLevel: "low" | "medium" | "high"
  country: string
  documents: {
    type: string
    name: string
    url: string
  }[]
  auditTrail: {
    action: string
    by: string
    at: string
    note?: string
  }[]
}

const mockKYCData: KYCApplication[] = [
  {
    id: "KYC-001",
    userId: "USR-12345",
    fullName: "John Smith",
    email: "john.smith@email.com",
    documentType: "Passport",
    submittedAt: "2026-04-03T10:30:00",
    status: "pending",
    riskLevel: "low",
    country: "United States",
    documents: [
      { type: "Passport", name: "passport_front.jpg", url: "#" },
      { type: "Selfie", name: "selfie_verification.jpg", url: "#" },
    ],
    auditTrail: [
      { action: "Application Submitted", by: "System", at: "2026-04-03T10:30:00" },
      { action: "Auto-verification Started", by: "System", at: "2026-04-03T10:30:05" },
    ],
  },
  {
    id: "KYC-002",
    userId: "USR-12346",
    fullName: "Maria Garcia",
    email: "maria.g@company.com",
    documentType: "National ID",
    submittedAt: "2026-04-03T09:15:00",
    status: "manual_review",
    riskLevel: "medium",
    country: "Spain",
    documents: [
      { type: "National ID", name: "id_front.jpg", url: "#" },
      { type: "National ID", name: "id_back.jpg", url: "#" },
      { type: "Selfie", name: "selfie.jpg", url: "#" },
    ],
    auditTrail: [
      { action: "Application Submitted", by: "System", at: "2026-04-03T09:15:00" },
      { action: "Auto-verification Failed", by: "System", at: "2026-04-03T09:15:30", note: "Document quality issue" },
      { action: "Moved to Manual Review", by: "System", at: "2026-04-03T09:16:00" },
    ],
  },
  {
    id: "KYC-003",
    userId: "USR-12347",
    fullName: "Alex Johnson",
    email: "alex.j@startup.io",
    documentType: "Driver License",
    submittedAt: "2026-04-02T16:45:00",
    status: "approved",
    riskLevel: "low",
    country: "Canada",
    documents: [
      { type: "Driver License", name: "license_front.jpg", url: "#" },
      { type: "Selfie", name: "selfie.jpg", url: "#" },
    ],
    auditTrail: [
      { action: "Application Submitted", by: "System", at: "2026-04-02T16:45:00" },
      { action: "Auto-verification Passed", by: "System", at: "2026-04-02T16:45:30" },
      { action: "Approved", by: "Admin", at: "2026-04-02T17:00:00" },
    ],
  },
  {
    id: "KYC-004",
    userId: "USR-12348",
    fullName: "Tech Solutions Ltd",
    email: "contact@techsolutions.com",
    documentType: "Business Registration",
    submittedAt: "2026-04-02T14:20:00",
    status: "pending",
    riskLevel: "high",
    country: "United Kingdom",
    documents: [
      { type: "Business Registration", name: "registration.pdf", url: "#" },
      { type: "Director ID", name: "director_passport.jpg", url: "#" },
      { type: "Proof of Address", name: "utility_bill.pdf", url: "#" },
    ],
    auditTrail: [
      { action: "Application Submitted", by: "System", at: "2026-04-02T14:20:00" },
    ],
  },
  {
    id: "KYC-005",
    userId: "USR-12349",
    fullName: "Wei Chen",
    email: "wei.chen@mail.com",
    documentType: "Passport",
    submittedAt: "2026-04-01T11:00:00",
    status: "rejected",
    riskLevel: "high",
    country: "Singapore",
    documents: [
      { type: "Passport", name: "passport.jpg", url: "#" },
    ],
    auditTrail: [
      { action: "Application Submitted", by: "System", at: "2026-04-01T11:00:00" },
      { action: "Auto-verification Failed", by: "System", at: "2026-04-01T11:00:30", note: "Document expired" },
      { action: "Rejected", by: "Admin", at: "2026-04-01T12:00:00", note: "Expired document submitted" },
    ],
  },
]

function getStatusBadge(status: KYCStatus) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
    case "approved":
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      )
    case "rejected":
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      )
    case "manual_review":
      return (
        <Badge variant="outline" className="text-orange-500 border-orange-500/30">
          <AlertCircle className="mr-1 h-3 w-3" />
          Manual Review
        </Badge>
      )
  }
}

function getRiskBadge(risk: "low" | "medium" | "high") {
  switch (risk) {
    case "low":
      return <Badge variant="secondary" className="bg-primary/10 text-primary">Low</Badge>
    case "medium":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Medium</Badge>
    case "high":
      return <Badge variant="destructive">High</Badge>
  }
}

export default function KYCReviewPage() {
  const [selectedKYC, setSelectedKYC] = React.useState<KYCApplication | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [reviewNote, setReviewNote] = React.useState("")

  const filteredData = mockKYCData.filter((kyc) => {
    const matchesStatus = statusFilter === "all" || kyc.status === statusFilter
    const matchesSearch =
      kyc.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kyc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kyc.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const handleAction = (action: "approve" | "reject" | "manual_review") => {
    // In production, this would call an API
    console.log(`Action: ${action} for ${selectedKYC?.id} with note: ${reviewNote}`)
    setSelectedKYC(null)
    setReviewNote("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KYC Review Queue</h1>
        <p className="text-muted-foreground">Review and manage user identity verification requests</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-foreground">
                  {mockKYCData.filter((k) => k.status === "pending").length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Manual Review</p>
                <p className="text-2xl font-bold text-foreground">
                  {mockKYCData.filter((k) => k.status === "manual_review").length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Today</p>
                <p className="text-2xl font-bold text-foreground">12</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected Today</p>
                <p className="text-2xl font-bold text-foreground">3</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive/50" />
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
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-input border-border">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="manual_review">Manual Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
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
                <TableHead>ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((kyc) => (
                <TableRow key={kyc.id} className="border-border">
                  <TableCell className="font-mono text-sm">{kyc.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{kyc.fullName}</span>
                      <span className="text-xs text-muted-foreground">{kyc.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>{kyc.documentType}</TableCell>
                  <TableCell>{kyc.country}</TableCell>
                  <TableCell>{getRiskBadge(kyc.riskLevel)}</TableCell>
                  <TableCell>{getStatusBadge(kyc.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(kyc.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedKYC(kyc)}
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
      <Dialog open={!!selectedKYC} onOpenChange={() => setSelectedKYC(null)}>
        <DialogContent className="max-w-xl">
          {selectedKYC && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  KYC Application {selectedKYC.id}
                  {getStatusBadge(selectedKYC.status)}
                </DialogTitle>
                <DialogDescription>
                  Review user verification documents and take action
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 flex flex-col gap-6 max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent">
                {/* User Info */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">User Information</h3>
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{selectedKYC.fullName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{selectedKYC.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Submitted {new Date(selectedKYC.submittedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Risk Level:</span>
                      {getRiskBadge(selectedKYC.riskLevel)}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Documents */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Documents</h3>
                  <div className="grid gap-2">
                    {selectedKYC.documents.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{doc.type}</span>
                            <span className="text-xs text-muted-foreground">{doc.name}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Audit Trail */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Audit Trail</h3>
                  <div className="flex flex-col gap-3">
                    {selectedKYC.auditTrail.map((entry, i) => (
                      <div key={i} className="flex flex-col gap-1 border-l-2 border-border pl-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{entry.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.at).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">by {entry.by}</span>
                        {entry.note && (
                          <span className="text-xs text-yellow-500 mt-1">{entry.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Review Notes */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Review Notes</h3>
                  <Textarea
                    placeholder="Add notes about this application..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="bg-input border-border"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                {selectedKYC.status !== "approved" && selectedKYC.status !== "rejected" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleAction("reject")}
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    {selectedKYC.status !== "manual_review" && (
                      <Button
                        variant="outline"
                        onClick={() => handleAction("manual_review")}
                        className="flex-1"
                      >
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Manual Review
                      </Button>
                    )}
                    <Button
                      onClick={() => handleAction("approve")}
                      className="flex-1 bg-primary text-primary-foreground"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
