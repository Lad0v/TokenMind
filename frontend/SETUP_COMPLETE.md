# API Integration Setup Complete ✅

**Date**: April 6, 2026  
**Status**: Infrastructure ready for development  
**Backend API Version**: v3.1 (Solana Wallet Required, Simplified Registration)

## 📁 Files Created

### Core API Infrastructure

| File | Purpose |
|------|---------|
| **`/types/api.ts`** | TypeScript interfaces for all API requests/responses |
| **`/lib/api-client.ts`** | Main Axios client with token management & interceptors |
| **`/lib/auth-context.tsx`** | React context for app-wide auth state |
| **`/config/constants.ts`** | Configuration values & constants |

### Hooks & Utilities

| File | Purpose |
|------|---------|
| **`/hooks/use-api.ts`** | React hooks for all API endpoints |
| **`/hooks/use-wallet.ts`** | React hooks for Phantom wallet integration |
| **`/lib/wallet-helper.ts`** | Solana wallet utilities (connect, validate, sign) |
| **`/lib/route-protection.tsx`** | Route guards & role-based access control |
| **`/lib/error-handler.ts`** | Error parsing & user-friendly messages |
| **`/lib/validation.ts`** | Zod schemas for form validation |
| **`/lib/async-utils.ts`** | Utilities for async operations (debounce, retry, cache) |

### Documentation

| File | Purpose |
|------|---------|
| **`API_INTEGRATION_GUIDE.md`** | Comprehensive usage guide with examples |
| **`SETUP_COMPLETE.md`** | This file |

## 🚀 Quick Start

### 1. Setup Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 2. Initialize AuthProvider

In `app/layout.tsx`:

```tsx
import { AuthProvider } from '@/lib/auth-context';

export default function RootLayout({ children }) {
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

### 3. Use in Components

```tsx
'use client';
import { useWallet } from '@/hooks/use-wallet';
import { useLoginWithWallet } from '@/hooks/use-api';

export function LoginPage() {
  const { walletAddress, connect, isLoading } = useWallet();
  const { execute: login } = useLoginWithWallet();

  const handleLogin = async () => {
    if (!walletAddress) {
      await connect();
    } else {
      await login({ wallet_address: walletAddress });
    }
  };

  return (
    <button onClick={handleLogin} disabled={isLoading}>
      {walletAddress ? 'Login' : 'Connect Wallet'}
    </button>
  );
}
```

## 📊 Architecture Overview

```
┌─────────────────────────────────────────┐
│         React Components                │
│  (Pages, Forms, Dashboards)             │
└────────────┬────────────────────────────┘
             │
             ├─→ useApi Hooks
             ├─→ useAuth Context
             ├─→ useWallet Hooks
             │
┌────────────▼────────────────────────────┐
│      API Client Layer                   │
│  (api-client, auth-context)             │
└────────────┬────────────────────────────┘
             │
             ├─→ Token Management
             ├─→ Request/Response Interceptors
             ├─→ Auto Token Refresh
             │
┌────────────▼────────────────────────────┐
│      Axios HTTP Client                  │
│  (HTTP/1.1 with Interceptors)           │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│  Backend API                            │
│  (http://localhost:8000/api/v1)         │
└─────────────────────────────────────────┘
```

## 🔐 Authentication Flow

### Registration + Login (Investor)

```
1. connectPhantomWallet()
   ↓
2. POST /auth/register
   ├─ email
   ├─ solana_wallet_address
   └─ legal_name, country (optional)
   ↓
3. POST /auth/login/wallet
   ├─ wallet_address
   └─ Returns: access_token + refresh_token
   ↓
4. GET /auth/me
   └─ User is authenticated!
```

### Patent Submission + Issuer Upgrade

```
1. Submit patent
   POST /auth/submit-patent
   ├─ patent details
   ├─ email & phone
   └─ Returns: submission_id, otp_sent_to
   ↓
2. Verify OTP
   POST /auth/submit-patent/verify-otp
   ├─ email, otp_code, submission_id
   └─ Returns: new access_token (role: issuer)
   ↓
3. User is now an issuer!
```

## 📝 API Endpoints Summary

### Auth (8 endpoints)
- `POST /auth/register` - Create investor account
- `POST /auth/login/wallet` - Login with Solana wallet
- `POST /auth/submit-patent` - Submit patent with OTP verification
- `POST /auth/submit-patent/verify-otp` - Verify OTP and upgrade to issuer
- `POST /auth/otp-send` - Send OTP
- `POST /auth/otp-verify` - Verify OTP
- `POST /auth/refresh` - Refresh access token
- `DELETE /auth/logout` - Logout

### Users (6 endpoints)
- `GET /users/profile` - Get profile
- `PUT /users/profile` - Update profile
- `POST /users/verification/documents` - Upload verification docs
- `GET /users/verification/status` - Check verification status
- `POST /users/upgrade-to-issuer` - Upgrade to issuer (alternative flow)
- `DELETE /users/account` - Delete account

### IP Claims (3 endpoints)
- `GET /ip-claims` - List claims (with pagination & filters)
- `GET /ip-claims/{id}` - Get single claim
- `POST /ip-claims/{id}/documents` - Upload claim document
- `POST /ip-claims/{id}/review` - Review claim (admin)

### Patents (1 endpoint)
- `POST /patents/precheck/international` - Check patent existence

## 🎯 Key Features Implemented

✅ **Automatic Token Management**
- Tokens stored in localStorage
- Auto-refresh on expiration
- Auto-retry on 401
- Clear on logout

✅ **Type Safety**
- Full TypeScript support
- All API types defined
- Zod schema validation

✅ **Error Handling**
- Consistent error parsing
- User-friendly messages
- Error type detection

✅ **Wallet Integration**
- Phantom wallet connection
- Wallet validation
- Message signing support
- Account change listeners

✅ **React Hooks**
- useApi - Generic API calls
- useAuth - Auth state
- useWallet - Wallet operations
- useProtectedRoute - Route guards

✅ **Route Protection**
- withProtection HOC
- Role-based access control
- Automatic redirects
- Route configuration

✅ **Utilities**
- API caching
- Debounce/Throttle
- Retry logic
- Request deduplication
- Operation queue

## 🛠️ Development Workflow

### To create login page:

```tsx
// app/auth/login/page.tsx
'use client';

import { useWallet } from '@/hooks/use-wallet';
import { useLoginWithWallet } from '@/hooks/use-api';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { walletAddress, connect, isLoading: walletLoading } = useWallet();
  const { execute: login, loading: loginLoading } = useLoginWithWallet();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    // Redirect handled by component
  }

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      // Error shown via useWallet hook
    }
  };

  const handleLogin = async () => {
    try {
      await login({ wallet_address: walletAddress! });
    } catch (error) {
      // Error shown via useLoginWithWallet hook
    }
  };

  return (
    <div>
      {!walletAddress ? (
        <button onClick={handleConnect} disabled={walletLoading}>
          {walletLoading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <>
          <div>Connected: {walletAddress}</div>
          <button onClick={handleLogin} disabled={loginLoading}>
            {loginLoading ? 'Logging in...' : 'Login'}
          </button>
        </>
      )}
    </div>
  );
}
```

### To create protected investor page:

```tsx
// app/investor/dashboard/page.tsx
'use client';

import { withProtection } from '@/lib/route-protection';
import { USER_ROLES } from '@/config/constants';
import { useAuth } from '@/lib/auth-context';
import { useIpClaims } from '@/hooks/use-api';

function InvestorDashboard() {
  const { user } = useAuth();
  const { data: claims, loading } = useIpClaims();

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <div>My Patents: {claims?.total || 0}</div>
    </div>
  );
}

export default withProtection(InvestorDashboard, {
  requiresAuth: true,
  allowedRoles: [USER_ROLES.INVESTOR],
});
```

## 📚 Next Steps for Frontend Team

1. **Create Auth Pages**
   - Login page with wallet connection
   - Registration form
   - Password reset flow

2. **Build User Flows**
   - Investor dashboard
   - Patent submission wizard
   - Profile management
   - Document verification

3. **Implement Admin Features**
   - Patent review interface
   - User management
   - Analytics dashboard

4. **Add UI/UX**
   - Loading states & skeletons
   - Error boundaries & fallbacks
   - Toast notifications
   - Form feedback

5. **Testing**
   - Unit tests for hooks
   - Integration tests for flows
   - E2E tests with mock backend

## 📞 Support

- See `API_INTEGRATION_GUIDE.md` for detailed usage examples
- Check `/types/api.ts` for available types
- Review individual hook files for specific hook documentation

---

**Everything is ready for development!** Start implementing the UI components and pages. All API infrastructure is in place and type-safe.
