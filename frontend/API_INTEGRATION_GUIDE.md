# Frontend API Integration Guide

> **Status**: Infrastructure setup complete ✅ | Ready for component development

## Overview

The frontend has been set up with a complete API integration infrastructure based on the backend API documentation. All endpoints are type-safe, with automatic token management and error handling.

## Architecture

```
/types/api.ts                  → TypeScript interfaces for all API responses
/lib/api-client.ts            → Main API client (Axios + token management)
/lib/auth-context.tsx         → App-wide authentication state
/lib/route-protection.tsx     → Route guards & role-based access control
/lib/error-handler.ts         → Error parsing & user-friendly messages
/lib/validation.ts            → Zod schemas for form validation
/hooks/use-api.ts             → React hooks for API calls
/config/constants.ts          → Configuration & constants
```

## Setup

### 1. Environment Configuration

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 2. Wrap App with AuthProvider

In your `app/layout.tsx`:

```typescript
import { AuthProvider } from '@/lib/auth-context';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

## Usage Examples

### Authentication Flow

#### Register with Solana Wallet

```typescript
'use client';

import { useRegister } from '@/hooks/use-api';
import { registerSchema } from '@/lib/validation';
import { getUserFriendlyErrorMessage } from '@/lib/error-handler';

export function RegisterForm() {
  const { execute: register, loading, error } = useRegister();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await register({
        email: formData.get('email') as string,
        solana_wallet_address: formData.get('wallet') as string,
        legal_name: formData.get('legal_name') as string,
      });

      // Show success message
      toast.success('Registration successful! Please login with your wallet.');
    } catch (err) {
      toast.error(getUserFriendlyErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

#### Login with Wallet

```typescript
'use client';

import { useLoginWithWallet } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';

export function LoginForm() {
  const { execute: login, loading } = useLoginWithWallet();
  const { isAuthenticated } = useAuth();

  const handleLogin = async (walletAddress: string) => {
    try {
      await login({ wallet_address: walletAddress });
      // Component will auto-redirect via useLoginWithWallet hook
    } catch (err) {
      toast.error(getUserFriendlyErrorMessage(err));
    }
  };

  return (
    // ... Login UI
  );
}
```

### Patent Submission Flow

#### Step 1: Submit Patent

```typescript
const { execute: submitPatent, loading } = useSubmitPatent();

const handlePatentSubmit = async (patentData: types.SubmitPatentRequest) => {
  try {
    const result = await submitPatent(patentData);
    // result.submission_id and result.otp_sent_to available
    // Store submission_id for next step
    setSubmissionId(result.submission_id);
    setOtpEmail(result.otp_sent_to);
    navigateToOtpVerificationStep();
  } catch (err) {
    toast.error(getUserFriendlyErrorMessage(err));
  }
};
```

#### Step 2: Verify OTP

```typescript
const { execute: verifyOTP, loading } = useVerifyPatentOTP();

const handleOtpVerify = async (code: string) => {
  try {
    const result = await verifyOTP({
      email: otpEmail,
      code,
      submission_id: submissionId,
    });
    
    if (result.role_upgraded) {
      toast.success('Patent verified! You\'ve been upgraded to issuer.');
      // Navigate to issuer dashboard
    }
  } catch (err) {
    const message = getUserFriendlyErrorMessage(err);
    toast.error(message);
  }
};
```

### User Profile & Verification

#### Load Profile

```typescript
'use client';

import { useUserProfile } from '@/hooks/use-api';

export function ProfilePage() {
  const { data: profile, loading, error, execute: loadProfile } = useUserProfile();

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <div>
      {loading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      {profile && <ProfileDisplay profile={profile} />}
    </div>
  );
}
```

#### Upload Verification Documents

```typescript
const { execute: uploadDocs, loading } = useUploadVerificationDocuments();

const handleDocumentUpload = async (
  idDocument: File,
  selfie: File,
  address: string
) => {
  try {
    const result = await uploadDocs({
      id_document: idDocument,
      selfie: selfie,
      user_address: address,
    });

    toast.success('Documents uploaded successfully!');
    // Show status with result.status
  } catch (err) {
    toast.error(getUserFriendlyErrorMessage(err));
  }
};
```

### IP Claims Management

#### List IP Claims

```typescript
const { data: claimsData, loading, execute: loadClaims } = useIpClaims({
  status: 'submitted',
  skip: 0,
  limit: 20,
});

useEffect(() => {
  loadClaims();
}, []);

// Access: claimsData?.items and claimsData?.total
```

#### Review Claim (Admin)

```typescript
const { execute: reviewClaim, loading } = useReviewClaim();

const handleReviewClaim = async (claimId: string, decision: 'approve' | 'reject') => {
  try {
    await reviewClaim(claimId, {
      decision,
      notes: 'Looks good!',
    });
    toast.success('Claim reviewed successfully!');
    reloadClaims();
  } catch (err) {
    toast.error(getUserFriendlyErrorMessage(err));
  }
};
```

### Patent Precheck

```typescript
const { execute: precheck, loading, data } = usePrecheckpatentInternational();

const handlePrecheck = async (patentNumber: string, countryCode: 'US' | 'EP' | 'WO') => {
  try {
    const result = await precheck({
      patent_number: patentNumber,
      country_code: countryCode,
      include_analytics: true,
    });

    if (result.exists) {
      console.log('Patent record found:', result.normalized_record);
      console.log('Recommendation:', result.recommendation);
    } else {
      console.log('Patent not found in database');
    }
  } catch (err) {
    toast.error(getUserFriendlyErrorMessage(err));
  }
};
```

## Route Protection

### Using withProtection HOC

```typescript
import { withProtection } from '@/lib/route-protection';
import { USER_ROLES } from '@/config/constants';

function InvestorDashboard() {
  return <div>Investor Dashboard</div>;
}

export default withProtection(InvestorDashboard, {
  requiresAuth: true,
  allowedRoles: [USER_ROLES.INVESTOR],
});
```

### Using useProtectedRoute Hook

```typescript
'use client';

import { useProtectedRoute } from '@/lib/route-protection';

export function AdminPage() {
  useProtectedRoute(); // Automatically checks auth and redirects if unauthorized

  return <div>Admin Dashboard</div>;
}
```

## Error Handling

All API errors are automatically caught and can be handled with `getUserFriendlyErrorMessage`:

```typescript
try {
  await apiCall();
} catch (err) {
  const message = getUserFriendlyErrorMessage(err);
  toast.error(message); // Shows user-friendly error message
}
```

### Error Types

- **401 Unauthorized**: Token expired or invalid - user is redirected to login
- **403 Forbidden**: User doesn't have permission
- **404 Not Found**: Resource not found
- **422 Validation Error**: Invalid form data
- **500 Server Error**: Backend error

## Form Validation

All forms have schemas in `/lib/validation.ts`:

```typescript
import { submitPatentSchema, ReviewClaimFormData } from '@/lib/validation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function PatentForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubmitPatentFormData>({
    resolver: zodResolver(submitPatentSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('patent_number')} />
      {errors.patent_number && <span>{errors.patent_number.message}</span>}
    </form>
  );
}
```

## Token Management

Tokens are automatically managed:
- Stored in localStorage after login
- Automatically added to all API requests
- Automatically refreshed when expired
- Cleared on logout

### Manual Token Operations

```typescript
import { apiClient } from '@/lib/api-client';

// Check token validity
if (apiClient.hasValidToken()) {
  // User is authenticated
}

// Get current tokens
const accessToken = apiClient.getStoredAccessToken();
const refreshToken = apiClient.getStoredRefreshToken();

// Manual token refresh (usually automatic)
await apiClient.refreshToken(refreshToken);
```

## Authentication State

Use `useAuth()` hook anywhere in your app:

```typescript
import { useAuth } from '@/lib/auth-context';

function Header() {
  const { user, isAuthenticated, role, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginLink />;
  }

  return (
    <div>
      <span>Welcome, {user?.name}</span>
      <span>Role: {role}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Common Patterns

### Protected API Call with Loading State

```typescript
export function MyComponent() {
  const { data, loading, error, execute } = useApi(apiFunction);

  useEffect(() => {
    execute();
  }, [execute]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorAlert error={error} />;
  return <Content data={data} />;
}
```

### Form with API Submission

```typescript
const { execute: submit, loading } = useApi(apiFunction);
const { register, handleSubmit, formState } = useForm();

const onSubmit = async (data: FormData) => {
  try {
    await submit(data);
    toast.success('Success!');
  } catch (err) {
    toast.error(getUserFriendlyErrorMessage(err));
  }
};

return <form onSubmit={handleSubmit(onSubmit)}>{/* form */}</form>;
```

## Next Steps

1. Create page components for each flow (auth, investor, issuer, admin)
2. Implement UI components for forms and displays
3. Add toast notifications for user feedback
4. Implement error boundaries
5. Add loading skeletons
6. Implement real-time updates if needed (WebSocket)

---

For questions about specific endpoints, refer to backend API documentation or check the type definitions in `/types/api.ts`.
