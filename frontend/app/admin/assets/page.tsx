"use client"

import * as React from "react"
import {
  Search,
  Filter,
  Eye,
  Coins,
  Clock,
  CheckCircle2,
  Pause,
  Archive,
  ExternalLink,
  Copy,
  MoreVertical,
  TrendingUp,
  DollarSign,
  Package,
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
} from "@/components/ui/sheet"
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

type AssetStatus = "pending_tokenization" | "tokenized" | "listed" | "paused" | "archived"

interface Asset {
  id: string
  name: string
  patentNumber: string
  owner: string
  ownerEmail: string
  status: AssetStatus
  tokenAddress?: string
  totalSupply?: number
  circulatingSupply?: number
  pricePerToken?: number
  marketCap?: number
  createdAt: string
  tokenizedAt?: string
  listingId?: string
  category: string
  description: string
}

const mockAssets: Asset[] = [
  {
    id: "ASSET-001",
    name: "ML Pattern Recognition Algorithm",
    patentNumber: "US10123456B2",
    owner: "Tech Innovations Inc",
    ownerEmail: "patents@techinnovations.com",
    status: "listed",
    tokenAddress: "7xK9...3nPq",
    totalSupply: 1000000,
    circulatingSupply: 350000,
    pricePerToken: 2.45,
    marketCap: 857500,
    createdAt: "2026-03-15T10:00:00",
    tokenizedAt: "2026-03-20T14:30:00",
    listingId: "LST-001",
    category: "Software",
    description: "Advanced machine learning algorithm for pattern recognition",
  },
  {
    id: "ASSET-002",
    name: "Sustainable Energy Storage",
    patentNumber: "EP3456789A1",
    owner: "Green Energy Solutions",
    ownerEmail: "ip@greenenergy.eu",
    status: "tokenized",
    tokenAddress: "4mR2...8vWx",
    totalSupply: 500000,
    circulatingSupply: 0,
    pricePerToken: 5.00,
    marketCap: 0,
    createdAt: "2026-03-18T09:00:00",
    tokenizedAt: "2026-03-25T11:00:00",
    category: "Energy",
    description: "Innovative battery technology for sustainable power management",
  },
  {
    id: "ASSET-003",
    name: "Quantum Computing Interface",
    patentNumber: "JP2024-123456",
    owner: "Quantum Labs Co.",
    ownerEmail: "legal@quantumlabs.jp",
    status: "pending_tokenization",
    createdAt: "2026-04-01T10:15:00",
    category: "Hardware",
    description: "Revolutionary interface protocol for quantum computing systems",
  },
  {
    id: "ASSET-004",
    name: "Blockchain Supply Chain",
    patentNumber: "US98765432B1",
    owner: "Supply Chain Tech LLC",
    ownerEmail: "patents@supplytech.com",
    status: "listed",
    tokenAddress: "9pL5...2hNk",
    totalSupply: 2000000,
    circulatingSupply: 1200000,
    pricePerToken: 1.25,
    marketCap: 1500000,
    createdAt: "2026-02-10T14:00:00",
    tokenizedAt: "2026-02-15T16:00:00",
    listingId: "LST-002",
    category: "Software",
    description: "Blockchain implementation for supply chain tracking",
  },
  {
    id: "ASSET-005",
    name: "Biotech Drug Delivery System",
    patentNumber: "US11223344B1",
    owner: "BioMed Research Inc",
    ownerEmail: "ip@biomed.com",
    status: "paused",
    tokenAddress: "3kJ8...6qRt",
    totalSupply: 750000,
    circulatingSupply: 425000,
    pricePerToken: 8.50,
    marketCap: 3612500,
    createdAt: "2026-01-20T08:00:00",
    tokenizedAt: "2026-01-28T10:00:00",
    listingId: "LST-003",
    category: "Biotech",
    description: "Novel drug delivery system using nanotechnology",
  },
  {
    id: "ASSET-006",
    name: "Autonomous Navigation v1",
    patentNumber: "DE202400001",
    owner: "AutoDrive GmbH",
    ownerEmail: "patents@autodrive.de",
    status: "archived",
    tokenAddress: "1mN4...9sYz",
    totalSupply: 300000,
    circulatingSupply: 0,
    pricePerToken: 0,
    marketCap: 0,
    createdAt: "2025-11-01T12:00:00",
    tokenizedAt: "2025-11-10T14:00:00",
    category: "Automotive",
    description: "First generation autonomous vehicle navigation system",
  },
]

function getStatusBadge(status: AssetStatus) {
  switch (status) {
    case "pending_tokenization":
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
          <Clock className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
    case "tokenized":
      return (
        <Badge variant="outline" className="text-blue-500 border-blue-500/30">
          <Coins className="mr-1 h-3 w-3" />
          Tokenized
        </Badge>
      )
    case "listed":
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Listed
        </Badge>
      )
    case "paused":
      return (
        <Badge variant="outline" className="text-orange-500 border-orange-500/30">
          <Pause className="mr-1 h-3 w-3" />
          Paused
        </Badge>
      )
    case "archived":
      return (
        <Badge variant="secondary">
          <Archive className="mr-1 h-3 w-3" />
          Archived
        </Badge>
      )
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export default function AssetsPage() {
  const [selectedAsset, setSelectedAsset] = React.useState<Asset | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredData = mockAssets.filter((asset) => {
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter
    const matchesSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.patentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const totalMarketCap = mockAssets.reduce((sum, a) => sum + (a.marketCap || 0), 0)
  const totalTokenized = mockAssets.filter((a) => a.tokenAddress).length
  const totalListed = mockAssets.filter((a) => a.status === "listed").length

  const handleAction = (action: "pause" | "archive" | "resume") => {
    console.log(`Action: ${action} for ${selectedAsset?.id}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assets Management</h1>
        <p className="text-muted-foreground">Manage tokenized IP assets and their listings</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold text-foreground">{mockAssets.length}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tokenized</p>
                <p className="text-2xl font-bold text-foreground">{totalTokenized}</p>
              </div>
              <Coins className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Listings</p>
                <p className="text-2xl font-bold text-foreground">{totalListed}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Market Cap</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalMarketCap)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/50" />
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
                placeholder="Search by name, patent, or owner..."
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
                  <SelectItem value="pending_tokenization">Pending</SelectItem>
                  <SelectItem value="tokenized">Tokenized</SelectItem>
                  <SelectItem value="listed">Listed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
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
                <TableHead>Asset</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Token Supply</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Market Cap</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((asset) => (
                <TableRow key={asset.id} className="border-border">
                  <TableCell>
                    <div className="flex flex-col max-w-xs">
                      <span className="font-medium truncate">{asset.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{asset.patentNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{asset.owner}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{asset.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {asset.totalSupply ? (
                      <div className="flex flex-col">
                        <span className="text-sm">{formatNumber(asset.totalSupply)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatNumber(asset.circulatingSupply || 0)} circulating
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {asset.pricePerToken ? (
                      <span className="font-medium">${asset.pricePerToken.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {asset.marketCap ? (
                      <span className="font-medium">{formatCurrency(asset.marketCap)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(asset.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAsset(asset)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedAsset(asset)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {asset.tokenAddress && (
                            <DropdownMenuItem>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View on Explorer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {asset.status === "listed" && (
                            <DropdownMenuItem className="text-orange-500">
                              <Pause className="mr-2 h-4 w-4" />
                              Pause Listing
                            </DropdownMenuItem>
                          )}
                          {asset.status === "paused" && (
                            <DropdownMenuItem className="text-primary">
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Resume Listing
                            </DropdownMenuItem>
                          )}
                          {asset.status !== "archived" && (
                            <DropdownMenuItem className="text-destructive">
                              <Archive className="mr-2 h-4 w-4" />
                              Archive Asset
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedAsset && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedAsset.name}
                  {getStatusBadge(selectedAsset.status)}
                </SheetTitle>
                <SheetDescription>
                  {selectedAsset.id} | {selectedAsset.patentNumber}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 flex flex-col gap-6">
                {/* Token Info */}
                {selectedAsset.tokenAddress && (
                  <>
                    <div className="flex flex-col gap-4">
                      <h3 className="font-semibold text-foreground">Token Information</h3>
                      <Card className="bg-secondary/20 border-border">
                        <CardContent className="pt-6">
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Token Address</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{selectedAsset.tokenAddress}</span>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Total Supply</span>
                              <span className="font-medium">{formatNumber(selectedAsset.totalSupply || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Circulating</span>
                              <span className="font-medium">{formatNumber(selectedAsset.circulatingSupply || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Price per Token</span>
                              <span className="font-medium">${selectedAsset.pricePerToken?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Market Cap</span>
                              <span className="font-medium text-primary">
                                {formatCurrency(selectedAsset.marketCap || 0)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Asset Details */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Asset Details</h3>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Category</span>
                      <Badge variant="outline">{selectedAsset.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Owner</span>
                      <span className="text-sm">{selectedAsset.owner}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-sm">{selectedAsset.ownerEmail}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm">
                        {new Date(selectedAsset.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedAsset.tokenizedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tokenized</span>
                        <span className="text-sm">
                          {new Date(selectedAsset.tokenizedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-foreground">Description</h3>
                  <p className="text-sm text-muted-foreground">{selectedAsset.description}</p>
                </div>

                {/* Actions */}
                {selectedAsset.status !== "archived" && selectedAsset.tokenAddress && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-4">
                      <h3 className="font-semibold text-foreground">Actions</h3>
                      <div className="flex gap-2">
                        {selectedAsset.status === "listed" && (
                          <Button
                            variant="outline"
                            className="flex-1 text-orange-500 border-orange-500/30"
                            onClick={() => handleAction("pause")}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            Pause Listing
                          </Button>
                        )}
                        {selectedAsset.status === "paused" && (
                          <Button
                            variant="outline"
                            className="flex-1 text-primary border-primary/30"
                            onClick={() => handleAction("resume")}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Resume Listing
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="flex-1 text-destructive border-destructive/30"
                          onClick={() => handleAction("archive")}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
