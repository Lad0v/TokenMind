'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { getDefaultRouteForRole, type UserRole } from '@/lib/api'
import { useSession } from '@/components/providers/session-provider'

export function useRoleGuard(allowedRoles: UserRole[]) {
  const router = useRouter()
  const { status, user } = useSession()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/login')
      return
    }

    if (status === 'authenticated' && user && !allowedRoles.includes(user.role)) {
      router.replace(getDefaultRouteForRole(user.role))
    }
  }, [allowedRoles, router, status, user])

  return {
    status,
    user,
    isAuthorized: status === 'authenticated' && !!user && allowedRoles.includes(user.role),
  }
}
