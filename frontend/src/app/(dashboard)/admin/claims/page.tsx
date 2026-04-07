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
  Link as LinkIcon,
  Hash,
  DollarSign,
  Layers,
  ExternalLink,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock Claims data
const ipClaims = [
  {
    id: "CLM-001",
    title: "AI-Powered Music Composition Algorithm",
    type: "patent",
    owner: {
      name: "TechSounds Inc.",
      email: "legal@techsounds.io",
      wallet: "7xN3...8kP2",
      avatar: null,
    },
    status: "pending",
    submittedAt: "2024-01-15T14:30:00Z",
    estimatedValue: 150000,
    tokenSupply: 10000,
    royaltyRate: 5,
    description: "Novel algorithm for generating original music compositions using deep learning and neural networks. The system analyzes musical patterns and creates unique, royalty-free compositions.",
    documents: [
      { name: "patent_application.pdf", type: "patent", url: "#" },
      { name: "technical_specification.pdf", type: "technical", url: "#" },
      { name: "proof_of_ownership.pdf", type: "ownership", url: "#" },
    ],
    externalLinks: [
      { label: "Patent Office Record", url: "#" },
      { label: "Company Website", url: "#" },
    ],
    history: [
      { action: "submitted", date: "2024-01-15T14:30:00Z", actor: "TechSounds Inc." },
    ],
  },
  {
    id: "CLM-002",
    title: "GreenLeaf Organic Logo",
    type: "trademark",
    owner: {
      name: "GreenLeaf Foods",
      email: "ip@greenleaf.com",
      wallet: "4mK9...2jL5",
      avatar: null,
    },
    status: "pending",
    submittedAt: "2024-01-15T10:15:00Z",
    estimatedValue: 50000,
    tokenSupply: 5000,
    royaltyRate: 3,
    description: "Registered trademark for organic food products including the distinctive leaf-shaped logo and brand name \"GreenLeaf\" for use in food and beverage categories.",
    documents: [
      { name: "trademark_certificate.pdf", type: "trademark", url: "#" },
      { name: "brand_guidelines.pdf", type: "brand", url: "#" },
    ],
    externalLinks: [
      { label: "Trademark Registry", url: "#" },
    ],
    history: [
      { action: "submitted", date: "2024-01-15T10:15:00Z", actor: "GreenLeaf Foods" },
    ],
  },
  {
    id: "CLM-003",
    title: "Digital Art Collection: Cyber Dreams",
    type: "copyright",
    owner: {
      name: "Elena Digital Art",
      email: "elena@digitalart.studio",
      wallet: "9pX2...5nM8",
      avatar: null,
    },
    status: "approved",
    submittedAt: "2024-01-14T09:00:00Z",
    approvedAt: "2024-01-14T16:30:00Z",
    estimatedValue: 75000,
    tokenSupply: 1000,
    royaltyRate: 10,
    description: "Collection of 50 unique digital artworks exploring cyberpunk aesthetics and futuristic themes. Each piece is a high-resolution digital painting.",
    documents: [
      { name: "portfolio.pdf", type: "portfolio", url: "#" },
      { name: "copyright_registration.pdf", type: "copyright", url: "#" },
    ],
    externalLinks: [
      { label: "Artist Portfolio", url: "#" },
      { label: "Copyright Office", url: "#" },
    ],
    history: [
      { action: "submitted", date: "2024-01-14T09:00:00Z", actor: "Elena Digital Art" },
      { action: "approved", date: "2024-01-14T16:30:00Z", actor: "Admin" },
    ],
  },
  {
    id: "CLM-004",
    title: "Blockchain Authentication Protocol",
    type: "patent",
    owner: {
      name: "SecureChain Labs",
      email: "patents@securechain.io",
      wallet: "3kL7...9mN4",
      avatar: null,
    },
    status: "rejected",
    submittedAt: "2024-01-13T11:45:00Z",
    rejectedAt: "2024-01-13T18:00:00Z",
    rejectionReason: "Insufficient proof of patent ownership. The submitted documents do not match the patent registry records.",
    estimatedValue: 200000,
    tokenSupply: 20000,
    royaltyRate: 7,
    description: "Patented method for secure authentication using blockchain technology and zero-knowledge proofs.",
    documents: [
      { name: "patent_draft.pdf", type: "patent", url: "#" },
    ],
    externalLinks: [],
    history: [
      { action: "submitted", date: "2024-01-13T11:45:00Z", actor: "SecureChain Labs" },
      { action: "rejected", date: "2024-01-13T18:00:00Z", actor: "Admin", reason: "Insufficient proof of ownership" },
    ],
  },
  {
    id: "CLM-005",
    title: "Symphony No. 7 - Digital Horizons",
    type: "copyright",
    owner: {
      name: "Marcus Chen",
      email: "marcus@composer.pro",
      wallet: "6jK4...1pX9",
      avatar: null,
    },
    status: "pending",
    submittedAt: "2024-01-15T08:30:00Z",
    estimatedValue: 35000,
    tokenSupply: 3500,
    royaltyRate: 8,
    description: "Original orchestral composition featuring 4 movements, combining classical symphony structure with modern electronic elements.",
    documents: [
      { name: "sheet_music.pdf", type: "music", url: "#" },
      { name: "audio_recording.mp3", type: "audio", url: "#" },
      { name: "copyright_certificate.pdf", type: "copyright", url: "#" },
    ],
    externalLinks: [
      { label: "Streaming Platform", url: "#" },
    ],
    history: [
      { action: "submitted", date: "2024-01-15T08:30:00Z", actor: "Marcus Chen" },
    ],
  },
]

type IpClaim = typeof ipClaims[0]

const statusConfig = {
  pending: { label: "Pending", variant: "outline" as const, icon: Clock },
  approved: { label: "Approved", variant: "default" as const, icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive" as const, icon: XCircle },
}

const typeConfig = {
  patent: { label: "Patent", color: "bg-blue-500/10 text-blue-400" },
  trademark: { label: "Trademark", color: "bg-amber-500/10 text-amber-400" },
  copyright: { label: "Copyright", color: "bg-emerald-500/10 text-emerald-400" },
}

export default function ClaimsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selectedClaim, setSelectedClaim] = useState<IpClaim | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const filteredClaims = ipClaims.filter((claim) => {
    const matchesSearch =
      claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter
    const matchesType = typeFilter === "all" || claim.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const pendingCount = ipClaims.filter((c) => c.status === "pending").length

  const openDetails = (claim: IpClaim) => {
    setSelectedClaim(claim)
    setDetailsOpen(true)
  }

  const openActionDialog = (claim: IpClaim, action: "approve" | "reject") => {
    setSelectedClaim(claim)
    setActionType(action)
    setActionDialogOpen(true)
    setRejectionReason("")
  }

  const handleAction = () => {
    console.log(`${actionType} Claim:`, selectedClaim?.id, rejectionReason)
    setActionDialogOpen(false)
    setDetailsOpen(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IP Claims Review</h1>
          <p className="text-muted-foreground">
            {pendingCount} claims pending review
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {ipClaims.filter((c) => c.type === "patent").length}
                </p>
                <p className="text-sm text-muted-foreground">Patents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Hash className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {ipClaims.filter((c) => c.type === "trademark").length}
                </p>
                <p className="text-sm text-muted-foreground">Trademarks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Layers className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {ipClaims.filter((c) => c.type === "copyright").length}
                </p>
                <p className="text-sm text-muted-foreground">Copyrights</p>
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
                placeholder="Search by title, owner or ID..."
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
                    Type: {typeFilter === "all" ? "All" : typeConfig[typeFilter as keyof typeof typeConfig]?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTypeFilter("all")}>All</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("patent")}>Patent</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("trademark")}>Trademark</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("copyright")}>Copyright</DropdownMenuItem>
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
                  <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("approved")}>Approved</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("rejected")}>Rejected</DropdownMenuItem>
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
                <TableHead>IP Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClaims.map((claim) => {
                const StatusIcon = statusConfig[claim.status as keyof typeof statusConfig].icon
                return (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{claim.title}</p>
                        <p className="text-sm text-muted-foreground">{claim.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={typeConfig[claim.type as keyof typeof typeConfig].color}>
                        {typeConfig[claim.type as keyof typeof typeConfig].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={claim.owner.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {claim.owner.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{claim.owner.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(claim.estimatedValue)}</TableCell>
                    <TableCell>
                      {new Date(claim.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[claim.status as keyof typeof statusConfig].variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[claim.status as keyof typeof statusConfig].label}
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
                          <DropdownMenuItem onClick={() => openDetails(claim)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {claim.status === "pending" && (
                            <>
                              <DropdownMenuItem onClick={() => openActionDialog(claim, "approve")}>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openActionDialog(claim, "reject")}>
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

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedClaim && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-xl">{selectedClaim.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <span>{selectedClaim.id}</span>
                      <Badge className={typeConfig[selectedClaim.type as keyof typeof typeConfig].color}>
                        {typeConfig[selectedClaim.type as keyof typeof typeConfig].label}
                      </Badge>
                      <Badge variant={statusConfig[selectedClaim.status as keyof typeof statusConfig].variant}>
                        {statusConfig[selectedClaim.status as keyof typeof statusConfig].label}
                      </Badge>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="owner">Owner</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
                      <p className="text-sm">{selectedClaim.description}</p>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="bg-secondary">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Estimated Value</span>
                          </div>
                          <p className="text-xl font-bold mt-1">
                            {formatCurrency(selectedClaim.estimatedValue)}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Token Supply</span>
                          </div>
                          <p className="text-xl font-bold mt-1">
                            {selectedClaim.tokenSupply.toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-secondary">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Royalty Rate</span>
                          </div>
                          <p className="text-xl font-bold mt-1">{selectedClaim.royaltyRate}%</p>
                        </CardContent>
                      </Card>
                    </div>

                    {selectedClaim.externalLinks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">External Links</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedClaim.externalLinks.map((link, index) => (
                            <Button key={index} variant="outline" size="sm" asChild>
                              <a href={link.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-3 w-3" />
                                {link.label}
                              </a>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="owner" className="mt-4">
                  <Card className="bg-secondary">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src={selectedClaim.owner.avatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg">
                            {selectedClaim.owner.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-3 flex-1">
                          <div>
                            <h3 className="text-lg font-semibold">{selectedClaim.owner.name}</h3>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Email:</span>
                              <span>{selectedClaim.owner.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <LinkIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Wallet:</span>
                              <span className="font-mono">{selectedClaim.owner.wallet}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="documents" className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedClaim.documents.map((doc, index) => (
                      <Card key={index} className="bg-secondary">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{doc.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{doc.type}</p>
                              </div>
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
                    {selectedClaim.history.map((event, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {event.action === "submitted" && <Clock className="h-4 w-4 text-primary" />}
                          {event.action === "approved" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                          {event.action === "rejected" && <XCircle className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium capitalize">{event.action}</p>
                          <p className="text-sm text-muted-foreground">
                            By {event.actor} on {new Date(event.date).toLocaleString()}
                          </p>
                          {event.reason && (
                            <p className="text-sm text-destructive mt-1">Reason: {event.reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              {selectedClaim.status === "rejected" && selectedClaim.rejectionReason && (
                <Card className="bg-destructive/10 border-destructive/20 mt-4">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Rejection Reason</p>
                        <p className="text-sm text-destructive/80">{selectedClaim.rejectionReason}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedClaim.status === "pending" && (
                <DialogFooter className="mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsOpen(false)
                      openActionDialog(selectedClaim, "reject")
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      setDetailsOpen(false)
                      openActionDialog(selectedClaim, "approve")
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
              {actionType === "approve" ? "Approve IP Claim" : "Reject IP Claim"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `Are you sure you want to approve the IP claim "${selectedClaim?.title}"? This will allow tokenization of this asset.`
                : `Please provide a reason for rejecting the IP claim "${selectedClaim?.title}".`}
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
              {actionType === "approve" ? "Approve Claim" : "Reject Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
