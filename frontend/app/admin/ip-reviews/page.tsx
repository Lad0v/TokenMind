"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Clock, Eye, FileText, Search, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, claimsApi, toBackendAssetUrl, type IpClaim } from "@/lib/api"
import { useRoleGuard } from "@/lib/use-role-guard"

function getStatusBadge(status: string) {
  switch (status) {
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
    case "prechecked":
      return (
        <Badge variant="outline" className="text-cyan-500 border-cyan-500/30">
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
    case "submitted":
    default:
      return (
        <Badge variant="outline" className="text-blue-500 border-blue-500/30">
          <Clock className="mr-1 h-3 w-3" />
          Submitted
        </Badge>
      )
  }
}

export default function IPReviewsPage() {
  const { status, isAuthorized } = useRoleGuard(["admin", "compliance_officer"])
  const [items, setItems] = React.useState<IpClaim[]>([])
  const [selectedClaim, setSelectedClaim] = React.useState<IpClaim | null>(null)
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [reviewNote, setReviewNote] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadClaims = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await claimsApi.list()
      setItems(response.items)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось загрузить очередь IP claims.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (isAuthorized) {
      void loadClaims()
    }
  }, [isAuthorized, loadClaims])

  const filteredData = React.useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesSearch =
        item.patent_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.claimed_owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.patent_title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [items, searchQuery, statusFilter])

  const handleAction = async (decision: "approve" | "reject" | "request_more_data") => {
    if (!selectedClaim) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const updated = await claimsApi.review(selectedClaim.id, {
        decision,
        notes: reviewNote || undefined,
      })
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedClaim(updated)
      setReviewNote("")
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось обновить статус claim.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading IP review queue...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">IP / Patent Reviews</h1>
        <p className="text-muted-foreground">Очередь привязана к `/api/v1/ip-claims` и review endpoint</p>
      </div>

      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Manual approval remains mandatory</p>
              <p className="text-sm text-muted-foreground">
                Даже при успешном precheck final decision должен приниматься человеком.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {["submitted", "prechecked", "under_review", "approved"].map((claimStatus) => (
          <Card key={claimStatus} className="bg-card border-border">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{claimStatus}</p>
              <p className="text-2xl font-bold text-foreground">
                {items.filter((item) => item.status === claimStatus).length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by patent number or owner..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-input border-border">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="prechecked">Prechecked</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Patent</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Precheck</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border">
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Загрузка claims...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Claims не найдены.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className="border-border">
                    <TableCell>
                      <div className="flex flex-col max-w-xs">
                        <span className="font-medium truncate">{item.patent_title || item.patent_number}</span>
                        <span className="text-xs text-muted-foreground font-mono">{item.patent_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.claimed_owner_name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.precheck_status || "n/a"}</span>
                        <span className="text-xs text-muted-foreground">{item.source_id || "manual"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedClaim(item)
                          setReviewNote("")
                        }}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
        <DialogContent className="max-w-2xl">
          {selectedClaim && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Patent Claim {selectedClaim.id}
                  {getStatusBadge(selectedClaim.status)}
                </DialogTitle>
                <DialogDescription>
                  Review backend claim payload and supporting documents
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="rounded-lg border border-border bg-secondary/20 p-4">
                  <p className="text-sm font-medium text-foreground">{selectedClaim.patent_title || selectedClaim.patent_number}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedClaim.description || "Описание отсутствует"}</p>
                </div>

                <div className="rounded-lg border border-border bg-secondary/20 p-4">
                  <p className="text-sm font-medium text-foreground">Documents</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {selectedClaim.documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Документы пока не загружены.</p>
                    ) : (
                      selectedClaim.documents.map((document) => (
                        <Button key={document.id} variant="outline" size="sm" asChild className="justify-start">
                          <a href={toBackendAssetUrl(document.file_url) ?? "#"} target="_blank" rel="noreferrer">
                            <FileText className="mr-2 h-4 w-4" />
                            {document.doc_type || document.file_url}
                          </a>
                        </Button>
                      ))
                    )}
                  </div>
                </div>

                <Textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Review notes"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedClaim(null)}>
                  Close
                </Button>
                <Button variant="outline" disabled={isSubmitting} onClick={() => void handleAction("request_more_data")}>
                  Request Data
                </Button>
                <Button variant="outline" disabled={isSubmitting} onClick={() => void handleAction("reject")}>
                  Reject
                </Button>
                <Button disabled={isSubmitting} onClick={() => void handleAction("approve")}>
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
