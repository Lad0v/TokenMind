'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PUBLIC_ROUTES, USER_ROLES } from '@/config/constants';

interface RouteConfig {
  requiresAuth: boolean;
  allowedRoles?: string[];
}

const ROUTE_CONFIG: Record<string, RouteConfig> = {
  '/': { requiresAuth: false },
  '/auth/login': { requiresAuth: false },
  '/auth/register': { requiresAuth: false },
  '/investor/dashboard': { requiresAuth: true, allowedRoles: [USER_ROLES.INVESTOR] },
  '/investor/my-patents': { requiresAuth: true, allowedRoles: [USER_ROLES.INVESTOR] },
  '/issuer/dashboard': { requiresAuth: true, allowedRoles: [USER_ROLES.ISSUER] },
  '/issuer/claims': { requiresAuth: true, allowedRoles: [USER_ROLES.ISSUER] },
  '/admin/dashboard': { requiresAuth: true, allowedRoles: [USER_ROLES.ADMIN] },
  '/admin/users': { requiresAuth: true, allowedRoles: [USER_ROLES.ADMIN] },
};

export function useProtectedRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, role, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return; // Wait for auth to load

    const routeConfig = ROUTE_CONFIG[pathname] || { requiresAuth: false };

    // Check if route requires authentication
    if (routeConfig.requiresAuth && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // Check if user has correct role
    if (routeConfig.allowedRoles && !routeConfig.allowedRoles.includes(role || '')) {
      // Redirect to appropriate dashboard based on role
      if (role === USER_ROLES.INVESTOR) {
        router.push('/investor/dashboard');
      } else if (role === USER_ROLES.ISSUER) {
        router.push('/issuer/dashboard');
      } else if (role === USER_ROLES.ADMIN) {
        router.push('/admin/dashboard');
      } else {
        router.push('/');
      }
      return;
    }

    // Redirect authenticated users away from login/register
    if (
      isAuthenticated &&
      (pathname === '/auth/login' || pathname === '/auth/register')
    ) {
      if (role === USER_ROLES.INVESTOR) {
        router.push('/investor/dashboard');
      } else if (role === USER_ROLES.ISSUER) {
        router.push('/issuer/dashboard');
      } else if (role === USER_ROLES.ADMIN) {
        router.push('/admin/dashboard');
      } else {
        router.push('/');
      }
    }
  }, [isAuthenticated, role, isLoading, pathname, router]);

  return { isProtected: ROUTE_CONFIG[pathname]?.requiresAuth ?? false };
}

export function withProtection<P extends object>(
  Component: React.ComponentType<P>,
  { requiresAuth = true, allowedRoles = [] }: RouteConfig = { requiresAuth: true }
) {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, role, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (isLoading) return;

      if (requiresAuth && !isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(role || '')) {
        router.push('/');
      }
    }, [isAuthenticated, role, isLoading, router]);

    if (isLoading) {
      return <div>Loading...</div>; // Could be a loading skeleton
    }

    if (requiresAuth && !isAuthenticated) {
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role || '')) {
      return null;
    }

    return <Component {...props} />;
  };
}
