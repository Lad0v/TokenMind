"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Clock, Download, Eye, Search, XCircle } from "lucide-react"

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
import { ApiError, adminApi, toBackendAssetUrl, type VerificationCaseResponse } from "@/lib/api"
import { formatStableDate } from "@/lib/date-format"
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
    case "pending":
    default:
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
  }
}

export default function KYCReviewPage() {
  const { status, isAuthorized } = useRoleGuard(["admin", "compliance_officer"])
  const [items, setItems] = React.useState<VerificationCaseResponse[]>([])
  const [selectedCase, setSelectedCase] = React.useState<VerificationCaseResponse | null>(null)
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [reviewNote, setReviewNote] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadCases = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await adminApi.listVerificationCases()
      setItems(response.items)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось загрузить очередь верификации.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (isAuthorized) {
      void loadCases()
    }
  }, [isAuthorized, loadCases])

  const filteredData = React.useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      const matchesSearch =
        item.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase())
      return !!matchesStatus && !!matchesSearch
    })
  }, [items, searchQuery, statusFilter])

  const handleAction = async (decision: "approved" | "rejected") => {
    if (!selectedCase) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const updated = await adminApi.reviewVerificationCase(selectedCase.id, {
        decision,
        notes: reviewNote || undefined,
      })
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSelectedCase(updated)
      setReviewNote(updated.reviewer_notes || "")
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось обновить verification case.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading KYC queue...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KYC Review Queue</h1>
        <p className="text-muted-foreground">Очередь взята из `/api/v1/admin/verification-cases`</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-foreground">{items.filter((item) => item.status === "pending").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-primary">{items.filter((item) => item.status === "approved").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-destructive">{items.filter((item) => item.status === "rejected").length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user or case id..."
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
                <SelectItem value="pending">Pending</SelectItem>
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
                <TableHead>Case ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Загрузка очереди...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Нет элементов для отображения.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className="border-border">
                    <TableCell className="font-mono text-sm">{item.id}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.user?.full_name || item.user?.email || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">{item.user?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatStableDate(item.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCase(item)
                          setReviewNote(item.reviewer_notes || "")
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

      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl">
          {selectedCase && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Verification Case {selectedCase.id}
                  {getStatusBadge(selectedCase.status)}
                </DialogTitle>
                <DialogDescription>
                  Review uploaded documents and make a compliance decision
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="rounded-lg border border-border bg-secondary/20 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {selectedCase.user?.full_name || selectedCase.user?.email}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedCase.user_address}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Button variant="outline" asChild disabled={!selectedCase.id_document_url}>
                    <a href={toBackendAssetUrl(selectedCase.id_document_url) ?? "#"} target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      ID document
                    </a>
                  </Button>
                  <Button variant="outline" asChild disabled={!selectedCase.selfie_url}>
                    <a href={toBackendAssetUrl(selectedCase.selfie_url) ?? "#"} target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Selfie
                    </a>
                  </Button>
                </div>

                <Textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Review notes"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedCase(null)}>
                  Close
                </Button>
                <Button variant="outline" disabled={isSubmitting} onClick={() => void handleAction("rejected")}>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button disabled={isSubmitting} onClick={() => void handleAction("approved")}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
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
