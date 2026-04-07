'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import * as types from '@/types/api';

// Generic hook for API calls
export function useApi<T, Args extends any[] = []>(
  apiFn: (...args: Args) => Promise<T>,
  onError?: (error: unknown) => void
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: Args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(...(args as any));
        setData(result);
        return result;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFn, onError]
  );

  return { data, loading, error, execute };
}

// ============ AUTH HOOKS ============

export function useRegister() {
  return useApi((data: types.RegisterRequest) => apiClient.register(data));
}

export function useLoginWithWallet() {
  const router = useRouter();
  return useApi(
    (data: types.LoginWalletRequest) => apiClient.loginWithWallet(data),
    () => router.push('/dashboard')
  );
}

export function useSubmitPatent() {
  return useApi((data: types.SubmitPatentRequest) =>
    apiClient.submitPatent(data)
  );
}

export function useVerifyPatentOTP() {
  const router = useRouter();
  return useApi(
    (data: types.VerifyPatentOTPRequest) => apiClient.verifyPatentOTP(data),
    () => router.push('/dashboard')
  );
}

export function useSendOTP() {
  return useApi((data: types.OTPSendRequest) => apiClient.sendOTP(data));
}

export function useVerifyOTP() {
  return useApi((data: types.OTPVerifyRequest) => apiClient.verifyOTP(data));
}

export function useLogout() {
  const router = useRouter();
  return useApi(
    async () => {
      const refreshToken = apiClient.getStoredRefreshToken();
      if (!refreshToken) throw new Error('No refresh token found');
      return apiClient.logout(refreshToken);
    },
    () => router.push('/auth/login')
  );
}

export function useCurrentUser() {
  return useApi(() => apiClient.getCurrentUser());
}

export function usePasswordReset() {
  return useApi((data: types.PasswordResetRequest) =>
    apiClient.resetPassword(data)
  );
}

// ============ USER HOOKS ============

export function useUserProfile() {
  return useApi(() => apiClient.getProfile());
}

export function useUpdateProfile() {
  return useApi((data: types.ProfileUpdateRequest) =>
    apiClient.updateProfile(data)
  );
}

export function useUploadVerificationDocuments() {
  return useApi((data: types.VerificationDocumentsRequest) =>
    apiClient.uploadVerificationDocuments(data)
  );
}

export function useVerificationStatus() {
  return useApi(() => apiClient.getVerificationStatus());
}

export function useUpgradeToIssuer() {
  return useApi(() => apiClient.upgradeToIssuer());
}

export function useDeleteAccount() {
  const router = useRouter();
  return useApi(
    () => apiClient.deleteAccount(),
    () => router.push('/auth/login')
  );
}

// ============ IP CLAIMS HOOKS ============

export function useIpClaims(params?: types.IpClaimsListParams) {
  return useApi(() => apiClient.getIpClaims(params), undefined);
}

export function useIpClaim(claimId: string) {
  return useApi(() => apiClient.getIpClaim(claimId));
}

export function useUploadClaimDocument() {
  return useApi((claimId: string, data: types.UploadDocumentRequest) =>
    apiClient.uploadClaimDocument(claimId, data)
  );
}

export function useReviewClaim() {
  return useApi((claimId: string, data: types.ReviewClaimRequest) =>
    apiClient.reviewClaim(claimId, data)
  );
}

// ============ PATENTS HOOKS ============

export function usePrecheckpatentInternational() {
  return useApi((data: types.PrecheckInternationalRequest) =>
    apiClient.precheckPatentInternational(data)
  );
}
