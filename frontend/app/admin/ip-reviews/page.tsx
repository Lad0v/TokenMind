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
  FileText,
  ExternalLink,
  Download,
  MessageSquare,
  Building,
  Hash,
  Calendar,
  User,
  Globe,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type IPStatus = "submitted" | "prechecked" | "under_review" | "approved" | "rejected"

interface PatentClaim {
  id: string
  patentNumber: string
  title: string
  owner: string
  ownerEmail: string
  description: string
  submittedAt: string
  status: IPStatus
  country: string
  filingDate: string
  expiryDate: string
  patentApiResult: {
    status: "match" | "no_match" | "pending"
    confidence: number
    details: string
  }
  documents: {
    type: string
    name: string
    url: string
  }[]
  reviewNotes: string
  auditTrail: {
    action: string
    by: string
    at: string
    note?: string
  }[]
}

const mockPatentData: PatentClaim[] = [
  {
    id: "IP-001",
    patentNumber: "US10123456B2",
    title: "Advanced Machine Learning Algorithm for Pattern Recognition",
    owner: "Tech Innovations Inc",
    ownerEmail: "patents@techinnovations.com",
    description: "A novel machine learning algorithm that utilizes deep neural networks for enhanced pattern recognition in complex datasets.",
    submittedAt: "2026-04-03T09:00:00",
    status: "submitted",
    country: "United States",
    filingDate: "2022-03-15",
    expiryDate: "2042-03-15",
    patentApiResult: {
      status: "match",
      confidence: 95,
      details: "Patent verified in USPTO database. Owner name matches registered holder.",
    },
    documents: [
      { type: "Patent Certificate", name: "patent_certificate.pdf", url: "#" },
      { type: "Assignment Agreement", name: "assignment.pdf", url: "#" },
    ],
    reviewNotes: "",
    auditTrail: [
      { action: "Claim Submitted", by: "Tech Innovations Inc", at: "2026-04-03T09:00:00" },
      { action: "Patent API Verification", by: "System", at: "2026-04-03T09:00:30", note: "Match found with 95% confidence" },
    ],
  },
  {
    id: "IP-002",
    patentNumber: "EP3456789A1",
    title: "Sustainable Energy Storage System",
    owner: "Green Energy Solutions",
    ownerEmail: "ip@greenenergy.eu",
    description: "An innovative energy storage system utilizing advanced battery technology for sustainable power management.",
    submittedAt: "2026-04-02T14:30:00",
    status: "prechecked",
    country: "European Union",
    filingDate: "2021-08-20",
    expiryDate: "2041-08-20",
    patentApiResult: {
      status: "match",
      confidence: 88,
      details: "Patent found in EPO database. Minor discrepancy in owner address.",
    },
    documents: [
      { type: "Patent Certificate", name: "ep_patent.pdf", url: "#" },
      { type: "Technical Specifications", name: "tech_specs.pdf", url: "#" },
      { type: "Proof of Ownership", name: "ownership_proof.pdf", url: "#" },
    ],
    reviewNotes: "Address discrepancy noted. Awaiting additional documentation.",
    auditTrail: [
      { action: "Claim Submitted", by: "Green Energy Solutions", at: "2026-04-02T14:30:00" },
      { action: "Patent API Verification", by: "System", at: "2026-04-02T14:30:45", note: "Match with 88% confidence" },
      { action: "Moved to Precheck", by: "System", at: "2026-04-02T14:31:00" },
      { action: "Additional Documents Requested", by: "Admin", at: "2026-04-02T16:00:00" },
    ],
  },
  {
    id: "IP-003",
    patentNumber: "JP2024-123456",
    title: "Quantum Computing Interface Protocol",
    owner: "Quantum Labs Co.",
    ownerEmail: "legal@quantumlabs.jp",
    description: "A revolutionary interface protocol for quantum computing systems enabling seamless integration with classical computing infrastructure.",
    submittedAt: "2026-04-01T10:15:00",
    status: "under_review",
    country: "Japan",
    filingDate: "2023-01-10",
    expiryDate: "2043-01-10",
    patentApiResult: {
      status: "match",
      confidence: 92,
      details: "Patent verified in JPO database. All details match.",
    },
    documents: [
      { type: "Patent Certificate", name: "jp_patent.pdf", url: "#" },
      { type: "Technical Documentation", name: "technical_docs.pdf", url: "#" },
    ],
    reviewNotes: "High-value patent. Requires thorough technical review.",
    auditTrail: [
      { action: "Claim Submitted", by: "Quantum Labs Co.", at: "2026-04-01T10:15:00" },
      { action: "Patent API Verification", by: "System", at: "2026-04-01T10:15:30" },
      { action: "Moved to Under Review", by: "Admin", at: "2026-04-01T11:00:00" },
    ],
  },
  {
    id: "IP-004",
    patentNumber: "US98765432B1",
    title: "Blockchain-based Supply Chain Tracking",
    owner: "Supply Chain Tech LLC",
    ownerEmail: "patents@supplytech.com",
    description: "A blockchain implementation for real-time supply chain tracking and verification.",
    submittedAt: "2026-03-30T16:45:00",
    status: "approved",
    country: "United States",
    filingDate: "2020-11-05",
    expiryDate: "2040-11-05",
    patentApiResult: {
      status: "match",
      confidence: 99,
      details: "Perfect match in USPTO database.",
    },
    documents: [
      { type: "Patent Certificate", name: "patent.pdf", url: "#" },
    ],
    reviewNotes: "All verifications passed. Approved for tokenization.",
    auditTrail: [
      { action: "Claim Submitted", by: "Supply Chain Tech LLC", at: "2026-03-30T16:45:00" },
      { action: "Patent API Verification", by: "System", at: "2026-03-30T16:45:30" },
      { action: "Approved", by: "Admin", at: "2026-03-31T10:00:00", note: "All checks passed" },
    ],
  },
  {
    id: "IP-005",
    patentNumber: "CN202412345678",
    title: "Autonomous Vehicle Navigation System",
    owner: "AutoDrive Technologies",
    ownerEmail: "ip@autodrive.cn",
    description: "Advanced navigation system for autonomous vehicles using AI-powered decision making.",
    submittedAt: "2026-03-28T08:00:00",
    status: "rejected",
    country: "China",
    filingDate: "2024-02-28",
    expiryDate: "2044-02-28",
    patentApiResult: {
      status: "no_match",
      confidence: 0,
      details: "Patent number not found in CNIPA database.",
    },
    documents: [
      { type: "Patent Application", name: "application.pdf", url: "#" },
    ],
    reviewNotes: "Patent not found in official database. Possible fraudulent claim.",
    auditTrail: [
      { action: "Claim Submitted", by: "AutoDrive Technologies", at: "2026-03-28T08:00:00" },
      { action: "Patent API Verification Failed", by: "System", at: "2026-03-28T08:00:30", note: "No match found" },
      { action: "Rejected", by: "Admin", at: "2026-03-28T10:00:00", note: "Invalid patent number" },
    ],
  },
]

function getStatusBadge(status: IPStatus) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="outline" className="text-blue-500 border-blue-500/30">
          <Clock className="mr-1 h-3 w-3" />
          Submitted
        </Badge>
      )
    case "prechecked":
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
          <AlertCircle className="mr-1 h-3 w-3" />
          Prechecked
        </Badge>
      )
    case "under_review":
      return (
        <Badge variant="outline" className="text-orange-500 border-orange-500/30">
          <Eye className="mr-1 h-3 w-3" />
          Under Review
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
  }
}

function getApiStatusBadge(status: "match" | "no_match" | "pending") {
  switch (status) {
    case "match":
      return <Badge className="bg-primary/20 text-primary border-primary/30">Match</Badge>
    case "no_match":
      return <Badge variant="destructive">No Match</Badge>
    case "pending":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Pending</Badge>
  }
}

export default function IPReviewsPage() {
  const [selectedClaim, setSelectedClaim] = React.useState<PatentClaim | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [reviewNote, setReviewNote] = React.useState("")

  const filteredData = mockPatentData.filter((claim) => {
    const matchesStatus = statusFilter === "all" || claim.status === statusFilter
    const matchesSearch =
      claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.patentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const handleAction = (action: "approve" | "reject" | "request_data") => {
    console.log(`Action: ${action} for ${selectedClaim?.id} with note: ${reviewNote}`)
    setSelectedClaim(null)
    setReviewNote("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">IP / Patent Reviews</h1>
        <p className="text-muted-foreground">Review and validate patent claims for tokenization</p>
      </div>

      {/* Important Notice */}
      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Important: Manual Review Required</p>
              <p className="text-sm text-muted-foreground">
                Even if the Patent API returns a match/success, final approval must be made by an Admin. 
                Auto-approval is not supported for patent claims.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Submitted</p>
                <p className="text-2xl font-bold text-foreground">
                  {mockPatentData.filter((c) => c.status === "submitted").length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prechecked</p>
                <p className="text-2xl font-bold text-foreground">
                  {mockPatentData.filter((c) => c.status === "prechecked").length}
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
                <p className="text-sm text-muted-foreground">Under Review</p>
                <p className="text-2xl font-bold text-foreground">
                  {mockPatentData.filter((c) => c.status === "under_review").length}
                </p>
              </div>
              <Eye className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-foreground">
                  {mockPatentData.filter((c) => c.status === "approved").length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-primary/50" />
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
                placeholder="Search by title, patent number, or owner..."
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
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="prechecked">Prechecked</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
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
                <TableHead>Patent</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>API Result</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((claim) => (
                <TableRow key={claim.id} className="border-border">
                  <TableCell className="font-mono text-sm">{claim.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col max-w-xs">
                      <span className="font-medium truncate">{claim.title}</span>
                      <span className="text-xs text-muted-foreground font-mono">{claim.patentNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>{claim.owner}</TableCell>
                  <TableCell>{claim.country}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getApiStatusBadge(claim.patentApiResult.status)}
                      {claim.patentApiResult.status === "match" && (
                        <span className="text-xs text-muted-foreground">
                          {claim.patentApiResult.confidence}%
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(claim.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(claim.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedClaim(claim)
                        setReviewNote(claim.reviewNotes)
                      }}
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <Sheet open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedClaim && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Patent Claim {selectedClaim.id}
                  {getStatusBadge(selectedClaim.status)}
                </SheetTitle>
                <SheetDescription>
                  Review patent details and API verification results
                </SheetDescription>
              </SheetHeader>

              <Tabs defaultValue="details" className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="audit">Audit Trail</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-4 flex flex-col gap-6">
                  {/* Patent Info */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-foreground">Patent Information</h3>
                    <div className="grid gap-3 rounded-lg border border-border p-4 bg-secondary/20">
                      <div className="flex items-center gap-3">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-mono">{selectedClaim.patentNumber}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-sm">{selectedClaim.title}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedClaim.country}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Filed: {selectedClaim.filingDate} | Expires: {selectedClaim.expiryDate}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedClaim.description}</p>
                  </div>

                  <Separator />

                  {/* Owner Info */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-foreground">Owner Information</h3>
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedClaim.owner}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedClaim.ownerEmail}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* API Verification Result */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-foreground">Patent API Verification</h3>
                    <Card className={cn(
                      "border",
                      selectedClaim.patentApiResult.status === "match" 
                        ? "border-primary/30 bg-primary/5" 
                        : selectedClaim.patentApiResult.status === "no_match"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-yellow-500/30 bg-yellow-500/5"
                    )}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium">Verification Result</span>
                          {getApiStatusBadge(selectedClaim.patentApiResult.status)}
                        </div>
                        {selectedClaim.patentApiResult.status === "match" && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm text-muted-foreground">Confidence:</span>
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary"
                                style={{ width: `${selectedClaim.patentApiResult.confidence}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{selectedClaim.patentApiResult.confidence}%</span>
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">{selectedClaim.patentApiResult.details}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Review Notes */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-foreground">Review Notes</h3>
                    <Textarea
                      placeholder="Add review notes..."
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      className="bg-input border-border min-h-[100px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="mt-4">
                  <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-foreground">Uploaded Documents</h3>
                    <div className="grid gap-2">
                      {selectedClaim.documents.map((doc, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{doc.type}</span>
                              <span className="text-xs text-muted-foreground">{doc.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="mt-4">
                  <div className="flex flex-col gap-4">
                    <h3 className="font-semibold text-foreground">Audit Trail</h3>
                    <div className="flex flex-col gap-3">
                      {selectedClaim.auditTrail.map((entry, i) => (
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
                </TabsContent>
              </Tabs>

              <SheetFooter className="mt-6 flex gap-2">
                {selectedClaim.status !== "approved" && selectedClaim.status !== "rejected" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleAction("reject")}
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction("request_data")}
                      className="flex-1"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Request Data
                    </Button>
                    <Button
                      onClick={() => handleAction("approve")}
                      className="flex-1 bg-primary text-primary-foreground"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
