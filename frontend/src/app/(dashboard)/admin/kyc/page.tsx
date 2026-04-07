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
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  FileText,
  User,
  Calendar,
  Mail,
  Globe,
  CreditCard,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock KYC data
const kycApplications = [
  {
    id: "KYC-001",
    user: {
      name: "Alexander Petrov",
      email: "alex.petrov@email.com",
      wallet: "8xH2...3kP9",
      avatar: null,
    },
    status: "pending",
    documentType: "Passport",
    country: "Russia",
    submittedAt: "2024-01-15T10:30:00Z",
    documents: [
      { name: "passport_front.jpg", type: "passport", url: "#" },
      { name: "passport_back.jpg", type: "passport", url: "#" },
      { name: "selfie_verification.jpg", type: "selfie", url: "#" },
    ],
    personalInfo: {
      fullName: "Alexander Mikhailovich Petrov",
      dateOfBirth: "1990-05-15",
      nationality: "Russian",
      address: "Moscow, Russia",
      phone: "+7 999 123 4567",
    },
  },
  {
    id: "KYC-002",
    user: {
      name: "Maria Santos",
      email: "maria.santos@email.com",
      wallet: "5kL1...9mN2",
      avatar: null,
    },
    status: "pending",
    documentType: "Driver License",
    country: "Brazil",
    submittedAt: "2024-01-15T09:15:00Z",
    documents: [
      { name: "drivers_license.jpg", type: "license", url: "#" },
      { name: "selfie_verification.jpg", type: "selfie", url: "#" },
    ],
    personalInfo: {
      fullName: "Maria Elena Santos",
      dateOfBirth: "1985-11-22",
      nationality: "Brazilian",
      address: "Sao Paulo, Brazil",
      phone: "+55 11 9876 5432",
    },
  },
  {
    id: "KYC-003",
    user: {
      name: "John Smith",
      email: "john.smith@email.com",
      wallet: "3nP7...2xK5",
      avatar: null,
    },
    status: "approved",
    documentType: "Passport",
    country: "USA",
    submittedAt: "2024-01-14T14:20:00Z",
    approvedAt: "2024-01-14T16:45:00Z",
    documents: [
      { name: "passport.jpg", type: "passport", url: "#" },
      { name: "selfie_verification.jpg", type: "selfie", url: "#" },
    ],
    personalInfo: {
      fullName: "John William Smith",
      dateOfBirth: "1992-03-10",
      nationality: "American",
      address: "New York, USA",
      phone: "+1 555 123 4567",
    },
  },
  {
    id: "KYC-004",
    user: {
      name: "Elena Volkova",
      email: "elena.v@email.com",
      wallet: "9mK4...7jL3",
      avatar: null,
    },
    status: "rejected",
    documentType: "ID Card",
    country: "Germany",
    submittedAt: "2024-01-13T11:00:00Z",
    rejectedAt: "2024-01-13T15:30:00Z",
    rejectionReason: "Document quality too low, face not clearly visible",
    documents: [
      { name: "id_card_front.jpg", type: "id", url: "#" },
      { name: "id_card_back.jpg", type: "id", url: "#" },
      { name: "selfie.jpg", type: "selfie", url: "#" },
    ],
    personalInfo: {
      fullName: "Elena Dmitrievna Volkova",
      dateOfBirth: "1988-07-28",
      nationality: "German",
      address: "Berlin, Germany",
      phone: "+49 30 1234 5678",
    },
  },
  {
    id: "KYC-005",
    user: {
      name: "Kenji Tanaka",
      email: "k.tanaka@email.com",
      wallet: "2pX8...4nM1",
      avatar: null,
    },
    status: "pending",
    documentType: "Passport",
    country: "Japan",
    submittedAt: "2024-01-15T08:00:00Z",
    documents: [
      { name: "passport.jpg", type: "passport", url: "#" },
      { name: "residence_card.jpg", type: "residence", url: "#" },
      { name: "selfie_verification.jpg", type: "selfie", url: "#" },
    ],
    personalInfo: {
      fullName: "Kenji Tanaka",
      dateOfBirth: "1995-09-03",
      nationality: "Japanese",
      address: "Tokyo, Japan",
      phone: "+81 3 1234 5678",
    },
  },
]

type KycApplication = typeof kycApplications[0]

const statusConfig = {
  pending: { label: "Pending", variant: "outline" as const, icon: Clock },
  approved: { label: "Approved", variant: "default" as const, icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive" as const, icon: XCircle },
}

export default function KycPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedKyc, setSelectedKyc] = useState<KycApplication | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const filteredApplications = kycApplications.filter((app) => {
    const matchesSearch =
      app.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || app.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const pendingCount = kycApplications.filter((a) => a.status === "pending").length

  const openDetails = (kyc: KycApplication) => {
    setSelectedKyc(kyc)
    setDetailsOpen(true)
  }

  const openActionDialog = (kyc: KycApplication, action: "approve" | "reject") => {
    setSelectedKyc(kyc)
    setActionType(action)
    setActionDialogOpen(true)
    setRejectionReason("")
  }

  const handleAction = () => {
    // Here you would make the API call
    console.log(`${actionType} KYC:`, selectedKyc?.id, rejectionReason)
    setActionDialogOpen(false)
    setDetailsOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">KYC Verification Queue</h1>
          <p className="text-muted-foreground">
            {pendingCount} applications pending review
          </p>
        </div>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Status: {statusFilter === "all" ? "All" : statusConfig[statusFilter as keyof typeof statusConfig]?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("approved")}>
                  Approved
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("rejected")}>
                  Rejected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <TableHead>Document</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map((app) => {
                const StatusIcon = statusConfig[app.status as keyof typeof statusConfig].icon
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={app.user.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {app.user.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{app.user.name}</p>
                          <p className="text-sm text-muted-foreground">{app.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{app.documentType}</TableCell>
                    <TableCell>{app.country}</TableCell>
                    <TableCell>
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[app.status as keyof typeof statusConfig].variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[app.status as keyof typeof statusConfig].label}
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
                          <DropdownMenuItem onClick={() => openDetails(app)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {app.status === "pending" && (
                            <>
                              <DropdownMenuItem onClick={() => openActionDialog(app, "approve")}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openActionDialog(app, "reject")}>
                                <XCircle className="mr-2 h-4 w-4 text-destructive" />
                                Reject
                              </DropdownMenuItem>
                            </>
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

      {/* Details Dialog.  //// Modal  */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedKyc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedKyc.user.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedKyc.user.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span>{selectedKyc.user.name}</span>
                    <Badge
                      variant={statusConfig[selectedKyc.status as keyof typeof statusConfig].variant}
                      className="ml-3"
                    >
                      {statusConfig[selectedKyc.status as keyof typeof statusConfig].label}
                    </Badge>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  Application ID: {selectedKyc.id}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="personal" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="personal">Personal Info</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Full Name:</span>
                        <span className="font-medium">{selectedKyc.personalInfo.fullName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Date of Birth:</span>
                        <span className="font-medium">{selectedKyc.personalInfo.dateOfBirth}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Nationality:</span>
                        <span className="font-medium">{selectedKyc.personalInfo.nationality}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{selectedKyc.user.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Wallet:</span>
                        <span className="font-medium font-mono">{selectedKyc.user.wallet}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Document Type:</span>
                        <span className="font-medium">{selectedKyc.documentType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="font-medium">{selectedKyc.personalInfo.address}</p>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedKyc.documents.map((doc, index) => (
                      <Card key={index} className="bg-secondary">
                        <CardContent className="p-4">
                          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-3">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{doc.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{doc.type}</p>
                            </div>
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 pb-4 border-b border-border">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Application Submitted</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(selectedKyc.submittedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {selectedKyc.status === "approved" && selectedKyc.approvedAt && (
                      <div className="flex items-start gap-3 pb-4 border-b border-border">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Application Approved</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(selectedKyc.approvedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedKyc.status === "rejected" && selectedKyc.rejectedAt && (
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </div>
                        <div>
                          <p className="font-medium">Application Rejected</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(selectedKyc.rejectedAt).toLocaleString()}
                          </p>
                          {selectedKyc.rejectionReason && (
                            <p className="text-sm text-destructive mt-1">
                              Reason: {selectedKyc.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {selectedKyc.status === "pending" && (
                <DialogFooter className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsOpen(false)
                      openActionDialog(selectedKyc, "reject")
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setDetailsOpen(false)
                      openActionDialog(selectedKyc, "approve")
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve KYC Application" : "Reject KYC Application"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `Are you sure you want to approve the KYC application for ${selectedKyc?.user.name}?`
                : `Please provide a reason for rejecting the KYC application for ${selectedKyc?.user.name}.`}
            </DialogDescription>
          </DialogHeader>

          {actionType === "reject" && (
            <div className="py-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={actionType === "reject" && !rejectionReason.trim()}
            >
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
