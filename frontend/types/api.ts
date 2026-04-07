// API Response Types
export interface ApiError {
  detail: string;
}

// ============ AUTH TYPES ============
export interface RegisterRequest {
  email: string;
  solana_wallet_address: string;
  legal_name?: string;
  country?: string;
}

export interface RegisterResponse {
  message: string;
}

export interface LoginWalletRequest {
  wallet_address: string;
  network?: string;
}

export interface LoginWalletResponse {
  access_token: string;
  refresh_token: string;
  role: 'investor' | 'issuer' | 'admin';
  is_new_user: boolean;
}

export interface SubmitPatentRequest {
  patent_number: string;
  patent_title: string;
  claimed_owner_name: string;
  email: string;
  phone: string;
  description?: string;
  jurisdiction?: 'US' | 'EP' | 'WO';
}

export interface SubmitPatentResponse {
  message: string;
  otp_sent_to: string;
  otp_purpose: 'patent_submission';
  submission_id: string;
}

export interface VerifyPatentOTPRequest {
  email: string;
  code: string;
  submission_id: string;
}

export interface VerifyPatentOTPResponse {
  verified: boolean;
  role_upgraded: boolean;
  new_role: 'issuer';
  access_token: string;
  refresh_token: string;
}

export interface OTPSendRequest {
  identifier: string;
  purpose:
    | 'register'
    | 'login'
    | 'password_reset'
    | 'issuer_upgrade'
    | 'patent_submission'
    | 'patent_submission_phone';
}

export interface OTPVerifyRequest {
  identifier: string;
  code: string;
  purpose: 'register' | 'login' | 'password_reset' | 'issuer_upgrade';
}

export interface OTPVerifyResponse {
  verified: boolean;
  verified_token: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  role: 'investor' | 'issuer' | 'admin';
  access_token: string;
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface PasswordResetRequest {
  email: string;
  new_password: string;
}

export interface PasswordResetResponse {
  message: string;
}

export interface CurrentUserResponse {
  id: string;
  email: string | null;
  name: string;
  role: 'investor' | 'issuer' | 'admin';
  status: 'active' | 'inactive' | 'blocked';
  verification_status: string;
}

// ============ USER TYPES ============
export interface ProfileRead {
  legal_name: string;
  country: string;
}

export interface ProfileUpdateRequest {
  legal_name?: string;
  country?: string;
}

export interface VerificationDocumentsRequest {
  id_document: File;
  selfie: File;
  video?: File;
  user_address: string;
}

export interface VerificationDocumentsResponse {
  id: string;
  user_id: string;
  patent_name: string | null;
  patent_address: string | null;
  user_address: string;
  id_document_url: string;
  selfie_url: string;
  video_url: string | null;
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  reviewer_notes: string | null;
  created_at: string;
}

export interface VerificationStatusResponse {
  id: string;
  user_id: string;
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  reviewer_notes: string | null;
  created_at: string;
}

export interface UpgradeToIssuerResponse {
  message: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
}

// ============ IP CLAIMS TYPES ============
export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'prechecked'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface IpClaimMetadata {
  [key: string]: unknown;
}

export interface IpClaim {
  id: string;
  issuer_user_id: string;
  patent_number: string;
  patent_title: string;
  claimed_owner_name: string;
  description: string;
  jurisdiction: 'US' | 'EP' | 'WO';
  status: ClaimStatus;
  prechecked: boolean;
  precheck_status: string | null;
  source_id: string | null;
  checked_at: string | null;
  patent_metadata: IpClaimMetadata;
  external_metadata: IpClaimMetadata;
  created_at: string;
  updated_at: string;
}

export interface IpClaimsListResponse {
  total: number;
  items: IpClaim[];
}

export interface IpClaimsListParams {
  status?: ClaimStatus;
  skip?: number;
  limit?: number;
}

export interface UploadDocumentRequest {
  file: File;
  doc_type?: string;
}

export interface UploadDocumentResponse {
  success: boolean;
  file_path: string;
}

export interface ReviewClaimRequest {
  decision: 'approve' | 'reject' | 'request_more_data';
  notes?: string;
}

export interface ReviewClaimResponse {
  success: boolean;
  message: string;
}

// ============ PATENTS TYPES ============
export interface PatentAssignee {
  name: string;
  type: 'company' | 'individual';
  country: string;
}

export interface PatentInventor {
  name: string;
  country: string;
}

export interface NormalizedPatentRecord {
  source: string;
  source_id: string;
  country_code: string;
  kind_code: string;
  title: string;
  abstract: string;
  filing_date: string;
  publication_date: string;
  grant_date: string;
  status: string;
  assignees: PatentAssignee[];
  inventors: PatentInventor[];
  cpc_classes: string[];
  citations_count: number;
}

export interface PrecheckInternationalRequest {
  patent_number: string;
  country_code: 'US' | 'EP' | 'WO';
  kind_code?: string;
  include_analytics?: boolean;
}

export interface PrecheckInternationalResponse {
  exists: boolean;
  primary_source: string;
  normalized_record: NormalizedPatentRecord;
  recommendation: 'recommended' | 'not_recommended';
  warnings: string[];
  cached: boolean;
}

// ============ MARKETPLACE TYPES ============
export interface MarketplaceListing {
  id: string;
  patentNumber: string;
  title: string;
  issuer: string;
  status: 'active' | 'inactive' | 'sold_out';
  priceModel: 'fixed' | 'auction';
  price: string;
  availableTokens: number;
  totalTokens: number;
  category: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface MarketplaceListingsResponse {
  total: number;
  items: MarketplaceListing[];
}

export interface MarketplaceCategoriesResponse {
  categories: MarketplaceCategory[];
}

// ============ COMMON TYPES ============
export interface PaginationParams {
  skip?: number;
  limit?: number;
}

export type UserRole = 'investor' | 'issuer' | 'admin';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}
