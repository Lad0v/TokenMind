import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import * as types from '@/types/api';

// Store keys in localStorage
const TOKEN_STORAGE_KEY = 'token_pair';
const USER_ROLE_KEY = 'user_role';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const tokenPair = this.getStoredTokens();
        if (tokenPair?.access_token) {
          config.headers.Authorization = `Bearer ${tokenPair.access_token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
        };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          const tokenPair = this.getStoredTokens();

          if (tokenPair?.refresh_token) {
            try {
              const refreshed = await this.refreshToken(tokenPair.refresh_token);
              this.storeTokens({
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token,
              });

              originalRequest.headers.Authorization = `Bearer ${refreshed.access_token}`;
              return this.axiosInstance(originalRequest);
            } catch (refreshError) {
              // Refresh failed, clear tokens and redirect to login
              this.clearTokens();
              window.location.href = '/auth/login';
              return Promise.reject(refreshError);
            }
          } else {
            // No refresh token, redirect to login
            this.clearTokens();
            window.location.href = '/auth/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Token management
  private storeTokens(tokens: types.TokenPair): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    }
  }

  private getStoredTokens(): types.TokenPair | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  // Role management
  storeUserRole(role: types.UserRole): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_ROLE_KEY, role);
    }
  }

  getStoredUserRole(): types.UserRole | null {
    if (typeof window === 'undefined') return null;
    const role = localStorage.getItem(USER_ROLE_KEY);
    return (role as types.UserRole) || null;
  }

  clearUserRole(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_ROLE_KEY);
    }
  }

  // ============ AUTH ENDPOINTS ============

  async register(data: types.RegisterRequest): Promise<types.RegisterResponse> {
    const response = await this.axiosInstance.post<types.RegisterResponse>(
      '/auth/register',
      data
    );
    return response.data;
  }

  async loginWithWallet(
    data: types.LoginWalletRequest
  ): Promise<types.LoginWalletResponse> {
    const response = await this.axiosInstance.post<types.LoginWalletResponse>(
      '/auth/login/wallet',
      data
    );
    const loginResponse = response.data;
    this.storeTokens({
      access_token: loginResponse.access_token,
      refresh_token: loginResponse.refresh_token,
    });
    this.storeUserRole(loginResponse.role);
    return loginResponse;
  }

  async submitPatent(data: types.SubmitPatentRequest): Promise<types.SubmitPatentResponse> {
    const response = await this.axiosInstance.post<types.SubmitPatentResponse>(
      '/auth/submit-patent',
      data
    );
    return response.data;
  }

  async verifyPatentOTP(
    data: types.VerifyPatentOTPRequest
  ): Promise<types.VerifyPatentOTPResponse> {
    const response = await this.axiosInstance.post<types.VerifyPatentOTPResponse>(
      '/auth/submit-patent/verify-otp',
      data
    );
    const verifyResponse = response.data;
    if (verifyResponse.verified) {
      this.storeTokens({
        access_token: verifyResponse.access_token,
        refresh_token: verifyResponse.refresh_token,
      });
      this.storeUserRole(verifyResponse.new_role);
    }
    return verifyResponse;
  }

  async sendOTP(data: types.OTPSendRequest): Promise<{ success: boolean }> {
    const response = await this.axiosInstance.post<{ success: boolean }>(
      '/auth/otp-send',
      data
    );
    return response.data;
  }

  async verifyOTP(data: types.OTPVerifyRequest): Promise<types.OTPVerifyResponse> {
    const response = await this.axiosInstance.post<types.OTPVerifyResponse>(
      '/auth/otp-verify',
      data
    );
    return response.data;
  }

  private async refreshToken(refreshToken: string): Promise<types.RefreshTokenResponse> {
    const response = await this.axiosInstance.post<types.RefreshTokenResponse>(
      '/auth/refresh',
      { refresh_token: refreshToken }
    );
    return response.data;
  }

  async logout(refreshToken: string): Promise<types.LogoutResponse> {
    try {
      const response = await this.axiosInstance.delete<types.LogoutResponse>(
        '/auth/logout',
        {
          data: { refresh_token: refreshToken },
        }
      );
      return response.data;
    } finally {
      this.clearTokens();
      this.clearUserRole();
    }
  }

  async resetPassword(data: types.PasswordResetRequest): Promise<types.PasswordResetResponse> {
    const response = await this.axiosInstance.put<types.PasswordResetResponse>(
      '/auth/password-reset',
      data
    );
    return response.data;
  }

  async getCurrentUser(): Promise<types.CurrentUserResponse> {
    const response = await this.axiosInstance.get<types.CurrentUserResponse>('/auth/me');
    return response.data;
  }

  // ============ USER ENDPOINTS ============

  async getProfile(): Promise<types.ProfileRead> {
    const response = await this.axiosInstance.get<types.ProfileRead>('/users/profile');
    return response.data;
  }

  async updateProfile(data: types.ProfileUpdateRequest): Promise<types.ProfileRead> {
    const response = await this.axiosInstance.put<types.ProfileRead>('/users/profile', data);
    return response.data;
  }

  async uploadVerificationDocuments(
    data: types.VerificationDocumentsRequest
  ): Promise<types.VerificationDocumentsResponse> {
    const formData = new FormData();
    formData.append('id_document', data.id_document);
    formData.append('selfie', data.selfie);
    if (data.video) {
      formData.append('video', data.video);
    }
    formData.append('user_address', data.user_address);

    const response = await this.axiosInstance.post<types.VerificationDocumentsResponse>(
      '/users/verification/documents',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async getVerificationStatus(): Promise<types.VerificationStatusResponse> {
    const response = await this.axiosInstance.get<types.VerificationStatusResponse>(
      '/users/verification/status'
    );
    return response.data;
  }

  async upgradeToIssuer(): Promise<types.UpgradeToIssuerResponse> {
    const response = await this.axiosInstance.post<types.UpgradeToIssuerResponse>(
      '/users/upgrade-to-issuer'
    );
    return response.data;
  }

  async deleteAccount(): Promise<types.DeleteAccountResponse> {
    const response = await this.axiosInstance.delete<types.DeleteAccountResponse>(
      '/users/account'
    );
    this.clearTokens();
    this.clearUserRole();
    return response.data;
  }

  // ============ IP CLAIMS ENDPOINTS ============

  async getIpClaims(params?: types.IpClaimsListParams): Promise<types.IpClaimsListResponse> {
    const response = await this.axiosInstance.get<types.IpClaimsListResponse>(
      '/ip-claims',
      { params }
    );
    return response.data;
  }

  async getIpClaim(claimId: string): Promise<types.IpClaim> {
    const response = await this.axiosInstance.get<types.IpClaim>(
      `/ip-claims/${claimId}`
    );
    return response.data;
  }

  async uploadClaimDocument(
    claimId: string,
    data: types.UploadDocumentRequest
  ): Promise<types.UploadDocumentResponse> {
    const formData = new FormData();
    formData.append('file', data.file);
    if (data.doc_type) {
      formData.append('doc_type', data.doc_type);
    }

    const response = await this.axiosInstance.post<types.UploadDocumentResponse>(
      `/ip-claims/${claimId}/documents`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async reviewClaim(
    claimId: string,
    data: types.ReviewClaimRequest
  ): Promise<types.ReviewClaimResponse> {
    const response = await this.axiosInstance.post<types.ReviewClaimResponse>(
      `/ip-claims/${claimId}/review`,
      data
    );
    return response.data;
  }

  // ============ PATENTS ENDPOINTS ============

  async precheckPatentInternational(
    data: types.PrecheckInternationalRequest
  ): Promise<types.PrecheckInternationalResponse> {
    const response = await this.axiosInstance.post<types.PrecheckInternationalResponse>(
      '/patents/precheck/international',
      data
    );
    return response.data;
  }

  // ============ MARKETPLACE ENDPOINTS ============

  async getMarketplaceListings(params?: {
    skip?: number;
    limit?: number;
    category?: string;
    search?: string;
  }): Promise<types.MarketplaceListingsResponse> {
    const response = await this.axiosInstance.get<types.MarketplaceListingsResponse>(
      '/marketplace/listings',
      { params }
    );
    return response.data;
  }

  async getMarketplaceCategories(): Promise<types.MarketplaceCategoriesResponse> {
    const response = await this.axiosInstance.get<types.MarketplaceCategoriesResponse>(
      '/marketplace/categories'
    );
    return response.data;
  }

  // ============ UTILITY METHODS ============

  getStoredAccessToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.access_token || null;
  }

  getStoredRefreshToken(): string | null {
    const tokens = this.getStoredTokens();
    return tokens?.refresh_token || null;
  }

  hasValidToken(): boolean {
    return !!this.getStoredAccessToken();
  }

  isTokenExpired(): boolean {
    const token = this.getStoredAccessToken();
    if (!token) return true;

    try {
      // Decode JWT to check exp claim
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const decoded = JSON.parse(atob(parts[1]));
      const expirationTime = decoded.exp * 1000;
      return Date.now() >= expirationTime;
    } catch {
      return true;
    }
  }
}

export const apiClient = new ApiClient();

// ============ MARKETPLACE EXPORTS ============
// Convenience functions for marketplace operations
export async function fetchListings(params?: {
  skip?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<types.MarketplaceListingsResponse> {
  return apiClient.getMarketplaceListings(params);
}

export async function fetchCategories(): Promise<types.MarketplaceCategoriesResponse> {
  return apiClient.getMarketplaceCategories();
}

// Re-export marketplace types for convenience
export type { MarketplaceListing } from '@/types/api';
export type { MarketplaceCategory } from '@/types/api';
export type { MarketplaceListingsResponse } from '@/types/api';
export type { MarketplaceCategoriesResponse } from '@/types/api';

// Role management utilities
export function getUserRole(): types.UserRole | null {
  return apiClient.getStoredUserRole();
}

export function setUserRole(role: types.UserRole): void {
  apiClient.storeUserRole(role);
}

export function clearUserRole(): void {
  apiClient.clearUserRole();
}
