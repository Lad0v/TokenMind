'use client';
import { AppShell } from '@/components/layout/AppShell';
import { MOCK_SESSION_STORE } from '@/components/layout/RoleGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Pass the globally mocked role into AppShell
  return (
    <AppShell role={MOCK_SESSION_STORE.role}>
      {children}
    </AppShell>
  );
}
