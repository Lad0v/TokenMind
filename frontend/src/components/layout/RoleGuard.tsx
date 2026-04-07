'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

// Global user session mock to simulate auth state dynamically between routes
export const MOCK_SESSION_STORE = {
  role: 'issuer' as 'guest' | 'user' | 'issuer' | 'investor' | 'admin',
  isAuthenticated: true,
  kycStatus: 'approved',
  walletConnected: true,
  address: '2B1qC...',
};

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();

  useEffect(() => {
    if (!allowedRoles.includes(MOCK_SESSION_STORE.role)) {
      router.push('/auth/login');
    }
  }, [allowedRoles, router]);

  if (!allowedRoles.includes(MOCK_SESSION_STORE.role)) {
    return <div className="p-10 text-center text-emerald-500">Redirecting...</div>;
  }

  return <>{children}</>;
}
