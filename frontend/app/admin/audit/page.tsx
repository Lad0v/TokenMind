"use client"

import * as React from "react"
import { Activity, AlertCircle, CheckCircle2, RefreshCw, Search, Shield, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ApiError, adminApi, type AuditLogResponse } from "@/lib/api"
import { useRoleGuard } from "@/lib/use-role-guard"

function getSeverityBadge(severity: string) {
  switch (severity) {
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
          <Shield className="mr-1 h-3 w-3" />
          Critical
        </Badge>
      )
    case "info":
    default:
      return (
        <Badge variant="secondary" className="bg-muted">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Info
        </Badge>
      )
  }
}

export default function AuditLogsPage() {
  const { status, isAuthorized } = useRoleGuard(["admin", "compliance_officer"])
  const [items, setItems] = React.useState<AuditLogResponse[]>([])
  const [selectedLog, setSelectedLog] = React.useState<AuditLogResponse | null>(null)
  const [categoryFilter, setCategoryFilter] = React.useState("all")
  const [severityFilter, setSeverityFilter] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadLogs = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await adminApi.listAuditLogs()
      setItems(response.items)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message)
      } else if (caughtError instanceof Error) {
        setError(caughtError.message)
      } else {
        setError("Не удалось загрузить audit logs.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (isAuthorized) {
      void loadLogs()
    }
  }, [isAuthorized, loadLogs])

  const filteredData = React.useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
      const matchesSeverity = severityFilter === "all" || item.severity === severityFilter
      const haystack = [item.action, item.entity_type, item.entity_id, item.actor?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      const matchesSearch = haystack.includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSeverity && matchesSearch
    })
  }, [categoryFilter, items, searchQuery, severityFilter])

  if (status === "loading" || !isAuthorized) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading audit logs...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground">Список построен на `/api/v1/admin/audit-logs`</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadLogs()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Events</p>
            <p className="text-2xl font-bold text-foreground">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Warnings</p>
            <p className="text-2xl font-bold text-yellow-500">{items.filter((item) => item.severity === "warning").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Errors</p>
            <p className="text-2xl font-bold text-orange-500">{items.filter((item) => item.severity === "error").length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Security</p>
            <p className="text-2xl font-bold text-primary">{items.filter((item) => item.category === "system").length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by action or entity..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9 bg-input border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px] bg-input border-border">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="kyc">KYC</SelectItem>
                  <SelectItem value="ip_review">IP Review</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px] bg-input border-border">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                <TableHead>Timestamp</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Загрузка audit logs...
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Audit log entries not found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={item.id} className="border-border">
                    <TableCell className="text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{item.actor?.email || "system"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.entity_type}</span>
                        <span className="text-xs text-muted-foreground">{item.entity_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getSeverityBadge(item.severity)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(item)}>
                        <Activity className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedLog.action}</DialogTitle>
                <DialogDescription>
                  {selectedLog.entity_type} / {selectedLog.entity_id}
                </DialogDescription>
              </DialogHeader>

              <pre className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-background/70 p-4 text-xs text-muted-foreground">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
