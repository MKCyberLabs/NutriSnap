/**
 * Pure routing decision logic for authentication, onboarding, and role-based access.
 * Governed by ADMIN_AUTH_FIX.md and TEST_MATRIX.md AUTH-UI-001..011.
 */

export interface AuthRoutingUser {
  id?: string;
  email?: string;
  role?: 'ADMIN' | 'USER' | string;
  onboarded?: boolean;
  requiresPasswordReset?: boolean;
}

/**
 * Computes destination route upon successful login.
 * - Password reset wins over all.
 * - Non-onboarded goes to /onboarding.
 * - Both onboarded ADMIN and USER go to /today.
 */
export function getPostLoginRedirect(user: AuthRoutingUser): string {
  if (user.requiresPasswordReset) {
    return '/reset-password';
  }
  if (!user.onboarded) {
    return '/onboarding';
  }
  return '/today';
}

/**
 * Access guard for /admin route.
 * - Unauthenticated -> '/'
 * - Authenticated non-admin -> '/today'
 * - Authenticated ADMIN -> allowed
 */
export function getAdminPageAccess(user: AuthRoutingUser | null): {
  allowed: boolean;
  redirect?: string;
} {
  if (!user) {
    return { allowed: false, redirect: '/' };
  }
  if (user.role !== 'ADMIN') {
    return { allowed: false, redirect: '/today' };
  }
  return { allowed: true };
}

/**
 * Access guard for general product pages (/today, /dashboard, /hydration, /finance, /reminders, /settings).
 * - Unauthenticated -> '/'
 * - Not onboarded -> '/onboarding'
 * - Onboarded (both ADMIN and USER) -> allowed
 */
export function getProductPageAccess(user: AuthRoutingUser | null): {
  allowed: boolean;
  redirect?: string;
} {
  if (!user) {
    return { allowed: false, redirect: '/' };
  }
  if (!user.onboarded) {
    return { allowed: false, redirect: '/onboarding' };
  }
  return { allowed: true };
}
