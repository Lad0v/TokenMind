import { clearAuthTokens, loadAuthTokens, saveAuthTokens, type AuthTokens } from '@/lib/auth-storage'

export type UserRole =
  | 'user'
  | 'issuer'
  | 'investor'
  | 'admin'
  | 'compliance_officer'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  role: UserRole
  access_token: string | null
  refresh_token: string | null
}

export interface WalletLoginChallengeRequest {
  wallet_address: string
  network?: string
}

export interface WalletLoginChallengeResponse {
  wallet_address: string
  network: string
  message: string
  challenge_token: string
}

export interface WalletLoginVerifyRequest {
  wallet_address: string
  network?: string
  message: string
  signature: string
  challenge_token: string
}

export interface RegisterRequest {
  email: string
  password: string
  role: UserRole
  legal_name?: string
  country?: string
  wallet_address?: string
}

export interface RegisterResponse {
  message: string
  user_id?: string | null
}

export interface AuthMeResponse {
  id: string
  email: string
  name: string | null
  role: UserRole
  status: string
  verification_status: string | null
}

export interface ProfileResponse {
  legal_name?: string | null
  country?: string | null
}

export interface UserWallet {
  id: string
  wallet_address: string
  network: string
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface VerificationCaseResponse {
  id: string
  user_id: string
  patent_name?: string | null
  patent_address?: string | null
  user_address?: string | null
  id_document_url?: string | null
  selfie_url?: string | null
  status: string
  reviewer_notes?: string | null
  created_at: string
  updated_at: string
  reviewed_by?: string | null
  reviewed_at?: string | null
  user?: {
    id: string
    email: string
    role: UserRole
    status: string
    full_name?: string | null
  }
}

export interface VerificationCaseListResponse {
  total: number
  skip: number
  limit: number
  items: VerificationCaseResponse[]
}

export interface VerificationCaseReviewRequest {
  decision: 'approved' | 'rejected'
  notes?: string
}

export interface PatentPrecheckResponse {
  status: string
  patent_number: string
  title?: string | null
  owner?: string | null
  metadata?: Record<string, unknown> | null
  source_id?: string | null
  prechecked: boolean
  message?: string | null
}

export interface IpClaimDocument {
  id: string
  file_url: string
  doc_type?: string | null
  uploaded_at: string
  created_by_user_id?: string | null
}

export interface IpClaimReview {
  id: string
  reviewer_id?: string | null
  reviewer_email?: string | null
  decision: 'approve' | 'reject' | 'request_more_data'
  notes?: string | null
  created_at: string
}

export interface IpClaim {
  id: string
  issuer_user_id: string
  issuer_email?: string | null
  issuer_name?: string | null
  patent_number: string
  patent_title?: string | null
  claimed_owner_name: string
  description?: string | null
  jurisdiction?: string | null
  status: string
  prechecked: boolean
  precheck_status?: string | null
  source_id?: string | null
  checked_at?: string | null
  patent_metadata?: Record<string, unknown> | null
  external_metadata?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  documents: IpClaimDocument[]
  reviews: IpClaimReview[]
}

export interface IpClaimListResponse {
  total: number
  items: IpClaim[]
}

export interface MarketplaceStats {
  active_listings: number
  total_available_tokens: number
  total_volume_sol: number
  floor_price_sol?: number | null
}

export interface MarketplaceListing {
  id: string
  claim_id?: string | null
  created_by_user_id?: string | null
  title: string
  patent_number: string
  description?: string | null
  issuer_name: string
  category?: string | null
  jurisdiction?: string | null
  token_symbol: string
  token_name?: string | null
  price_per_token_sol: number
  total_tokens: number
  available_tokens: number
  settlement_currency: string
  network: string
  treasury_wallet_address: string
  mint_address?: string | null
  external_metadata?: Record<string, unknown> | null
  status: string
  created_at: string
  updated_at: string
  sold_tokens: number
  purchase_count: number
  volume_sol: number
}

export interface MarketplaceListingsResponse {
  total: number
  stats: MarketplaceStats
  items: MarketplaceListing[]
}

export interface MarketplacePurchase {
  id: string
  user_id: string
  listing_id: string
  quantity: number
  price_per_token_sol: number
  quoted_total_sol: number
  total_sol: number
  expected_lamports: number
  payment_wallet_address: string
  treasury_wallet_address: string
  reference_code: string
  tx_signature?: string | null
  status: string
  failure_reason?: string | null
  payment_metadata?: Record<string, unknown> | null
  expires_at: string
  confirmed_at?: string | null
  created_at: string
  updated_at: string
  listing: MarketplaceListing
}

export interface MarketplaceTransactionRequest {
  network: string
  rpc_url: string
  treasury_wallet_address: string
  purchaser_wallet_address: string
  amount_sol: number
  amount_lamports: number
  expires_at: string
}

export interface MarketplacePurchaseIntentResponse {
  purchase: MarketplacePurchase
  transaction: MarketplaceTransactionRequest
}

export interface MarketplacePurchaseHistoryResponse {
  total: number
  items: MarketplacePurchase[]
}

export interface MarketplaceHolding {
  listing_id: string
  title: string
  patent_number: string
  issuer_name: string
  token_symbol: string
  quantity: number
  avg_price_per_token_sol: number
  invested_sol: number
  latest_price_per_token_sol: number
  current_value_sol: number
  network: string
  settlement_currency: string
  status: string
}

export interface MarketplacePortfolioSummary {
  total_positions: number
  total_tokens: number
  invested_sol: number
  current_value_sol: number
}

export interface MarketplaceHoldingsResponse {
  summary: MarketplacePortfolioSummary
  items: MarketplaceHolding[]
}

export interface AuditLogResponse {
  id: string
  action: string
  entity_type: string
  entity_id?: string | null
  payload?: Record<string, unknown> | null
  created_at: string
  category: string
  severity: string
  actor?: {
    id?: string | null
    email?: string | null
  } | null
}

export interface AuditLogListResponse {
  total: number
  skip: number
  limit: number
  items: AuditLogResponse[]
}

export interface AdminUserResponse {
  id: string
  email: string
  role: UserRole
  status: string
  created_at: string
  updated_at: string
  profile?: {
    full_name?: string | null
    country?: string | null
    organization_name?: string | null
    preferred_language?: string | null
  } | null
}

export interface AdminUserListResponse {
  total: number
  skip: number
  limit: number
  items: AdminUserResponse[]
}

function resolveApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '')
  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`
  }

  return 'http://localhost:8000/api/v1'
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, message: string, detail: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function buildUrl(path: string) {
  const apiBaseUrl = resolveApiBaseUrl()
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function getBackendOrigin() {
  return resolveApiBaseUrl().replace(/\/api\/v1$/, '')
}

export function toBackendAssetUrl(path?: string | null) {
  if (!path) {
    return null
  }

  return `${getBackendOrigin()}/${path.replace(/^\/+/, '')}`
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

function readErrorMessage(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail
  }

  if (detail && typeof detail === 'object') {
    if ('detail' in detail) {
      return readErrorMessage((detail as { detail: unknown }).detail)
    }
    if ('message' in detail && typeof (detail as { message?: unknown }).message === 'string') {
      return (detail as { message: string }).message
    }
    if ('code' in detail && typeof (detail as { code?: unknown }).code === 'string') {
      return (detail as { code: string }).code
    }
  }

  return 'Request failed'
}

async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  const payload = await parseResponse(response)
  if (!response.ok) {
    throw new ApiError(response.status, readErrorMessage(payload), payload)
  }

  const data = payload as LoginResponse
  if (!data.access_token || !data.refresh_token) {
    throw new ApiError(response.status, 'Token refresh returned an invalid payload', payload)
  }

  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  }
  saveAuthTokens(tokens)
  return tokens
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string
    body?: BodyInit | object | null
    headers?: HeadersInit
    auth?: boolean
  } = {},
): Promise<T> {
  const { method = 'GET', body, headers, auth = true } = options
  const requestHeaders = new Headers(headers)
  const tokens = auth ? loadAuthTokens() : null

  if (auth && tokens?.accessToken) {
    requestHeaders.set('Authorization', `Bearer ${tokens.accessToken}`)
  }

  let requestBody: BodyInit | undefined
  if (
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  ) {
    requestBody = body
  } else if (typeof body === 'string') {
    requestBody = body
  } else if (body != null) {
    requestHeaders.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  const execute = async (accessToken?: string) => {
    const nextHeaders = new Headers(requestHeaders)
    if (auth && accessToken) {
      nextHeaders.set('Authorization', `Bearer ${accessToken}`)
    }

    return fetch(buildUrl(path), {
      method,
      headers: nextHeaders,
      body: requestBody,
    })
  }

  let response = await execute(tokens?.accessToken)

  if (auth && response.status === 401 && tokens?.refreshToken) {
    try {
      const refreshedTokens = await refreshAccessToken(tokens.refreshToken)
      response = await execute(refreshedTokens.accessToken)
    } catch {
      clearAuthTokens()
      throw new ApiError(401, 'Session expired. Please sign in again.', null)
    }
  }

  const payload = await parseResponse(response)
  if (!response.ok) {
    throw new ApiError(response.status, readErrorMessage(payload), payload)
  }

  return payload as T
}

export function getDefaultRouteForRole(role: UserRole) {
  switch (role) {
    case 'admin':
    case 'compliance_officer':
      return '/admin'
    case 'investor':
      return '/marketplace?tab=portfolio'
    case 'issuer':
    case 'user':
    default:
      return '/issuer'
  }
}

export const authApi = {
  register(payload: RegisterRequest) {
    return apiRequest<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },
  login(payload: LoginRequest) {
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },
  createWalletLoginChallenge(payload: WalletLoginChallengeRequest) {
    return apiRequest<WalletLoginChallengeResponse>('/auth/wallet/challenge', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },
  verifyWalletLogin(payload: WalletLoginVerifyRequest) {
    return apiRequest<LoginResponse>('/auth/wallet/verify', {
      method: 'POST',
      body: payload,
      auth: false,
    })
  },
  logout(refreshToken: string) {
    return apiRequest<{ success: boolean; message: string }>('/auth/logout', {
      method: 'DELETE',
      body: { refresh_token: refreshToken },
      auth: false,
    })
  },
  me() {
    return apiRequest<AuthMeResponse>('/auth/me')
  },
}

export const userApi = {
  getProfile() {
    return apiRequest<ProfileResponse>('/users/profile')
  },
  updateProfile(payload: ProfileResponse) {
    return apiRequest<ProfileResponse>('/users/profile', {
      method: 'PUT',
      body: payload,
    })
  },
  getVerificationStatus() {
    return apiRequest<VerificationCaseResponse>('/users/verification/status')
  },
  submitVerificationDocuments(payload: FormData) {
    return apiRequest<VerificationCaseResponse>('/users/verification/documents', {
      method: 'POST',
      body: payload,
    })
  },
  reviewVerificationCase(caseId: string, decision: 'approved' | 'rejected', notes: string) {
    const formData = new FormData()
    formData.set('decision', decision)
    formData.set('notes', notes)
    return apiRequest<VerificationCaseResponse>(`/users/verification/review/${caseId}`, {
      method: 'POST',
      body: formData,
    })
  },
  listWallets() {
    return apiRequest<UserWallet[]>('/users/wallets')
  },
  linkWallet(payload: { wallet_address: string; network?: string; is_primary?: boolean }) {
    return apiRequest<UserWallet>('/users/wallets', {
      method: 'POST',
      body: payload,
    })
  },
  unlinkWallet(walletId: string) {
    return apiRequest<{ success: boolean; message: string }>(`/users/wallets/${walletId}`, {
      method: 'DELETE',
    })
  },
}

export const claimsApi = {
  list(status?: string) {
    const params = new URLSearchParams()
    if (status) {
      params.set('status', status)
    }
    params.set('skip', '0')
    params.set('limit', '100')

    return apiRequest<IpClaimListResponse>(`/ip-claims?${params.toString()}`)
  },
  getById(claimId: string) {
    return apiRequest<IpClaim>(`/ip-claims/${claimId}`)
  },
  create(payload: {
    patent_number: string
    patent_title?: string
    claimed_owner_name: string
    description?: string
    jurisdiction?: string
    precheck_snapshot?: Record<string, unknown>
  }) {
    return apiRequest<IpClaim>('/ip-claims', {
      method: 'POST',
      body: payload,
    })
  },
  uploadDocument(claimId: string, file: File, docType?: string) {
    const formData = new FormData()
    formData.set('file', file)
    if (docType) {
      formData.set('doc_type', docType)
    }

    return apiRequest<IpClaimDocument>(`/ip-claims/${claimId}/documents`, {
      method: 'POST',
      body: formData,
    })
  },
  review(
    claimId: string,
    payload: { decision: 'approve' | 'reject' | 'request_more_data'; notes?: string },
  ) {
    return apiRequest<IpClaim>(`/ip-claims/${claimId}/review`, {
      method: 'POST',
      body: payload,
    })
  },
  precheck(payload: {
    patent_number: string
    jurisdiction?: string
    claimed_owner_name?: string
  }) {
    return apiRequest<PatentPrecheckResponse>('/ip/precheck', {
      method: 'POST',
      body: payload,
    })
  },
}

export const adminApi = {
  listUsers() {
    const params = new URLSearchParams()
    params.set('skip', '0')
    params.set('limit', '100')
    return apiRequest<AdminUserListResponse>(`/users?${params.toString()}`)
  },
  listVerificationCases(status?: string) {
    const params = new URLSearchParams()
    params.set('skip', '0')
    params.set('limit', '100')
    if (status && status !== 'all') {
      params.set('status', status)
    }
    return apiRequest<VerificationCaseListResponse>(`/admin/verification-cases?${params.toString()}`)
  },
  getVerificationCase(caseId: string) {
    return apiRequest<VerificationCaseResponse>(`/admin/verification-cases/${caseId}`)
  },
  reviewVerificationCase(caseId: string, payload: VerificationCaseReviewRequest) {
    return apiRequest<VerificationCaseResponse>(`/admin/verification-cases/${caseId}/review`, {
      method: 'POST',
      body: payload,
    })
  },
  listAuditLogs() {
    const params = new URLSearchParams()
    params.set('skip', '0')
    params.set('limit', '200')
    return apiRequest<AuditLogListResponse>(`/admin/audit-logs?${params.toString()}`)
  },
}

export const marketplaceApi = {
  listListings() {
    return apiRequest<MarketplaceListingsResponse>('/marketplace/listings', {
      auth: false,
    })
  },
  createListing(payload: {
    claim_id?: string
    title: string
    patent_number: string
    description?: string
    issuer_name: string
    category?: string
    jurisdiction?: string
    token_symbol: string
    token_name?: string
    price_per_token_sol: number
    total_tokens: number
    network?: string
    treasury_wallet_address?: string
    mint_address?: string
    external_metadata?: Record<string, unknown>
  }) {
    return apiRequest<MarketplaceListing>('/marketplace/listings', {
      method: 'POST',
      body: payload,
    })
  },
  getListing(listingId: string) {
    return apiRequest<MarketplaceListing>(`/marketplace/listings/${listingId}`, {
      auth: false,
    })
  },
  getHistory() {
    return apiRequest<MarketplacePurchaseHistoryResponse>('/marketplace/history')
  },
  getHoldings() {
    return apiRequest<MarketplaceHoldingsResponse>('/marketplace/holdings')
  },
  createPurchase(payload: { listing_id: string; quantity: number }) {
    return apiRequest<MarketplacePurchaseIntentResponse>('/marketplace/purchases', {
      method: 'POST',
      body: payload,
    })
  },
  confirmPurchase(purchaseId: string, payload: { tx_signature: string }) {
    return apiRequest<MarketplacePurchase>(`/marketplace/purchases/${purchaseId}/confirm`, {
      method: 'POST',
      body: payload,
    })
  },
}
