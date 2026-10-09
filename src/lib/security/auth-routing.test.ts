import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPostLoginRedirect,
  getAdminPageAccess,
  getProductPageAccess,
} from './auth-routing';

test('AUTH-UI-001: ADMIN valid login lands on /today', () => {
  const dest = getPostLoginRedirect({
    role: 'ADMIN',
    onboarded: true,
    requiresPasswordReset: false,
  });
  assert.equal(dest, '/today');
});

test('AUTH-UI-002: USER valid login lands on /today', () => {
  const dest = getPostLoginRedirect({
    role: 'USER',
    onboarded: true,
    requiresPasswordReset: false,
  });
  assert.equal(dest, '/today');
});

test('AUTH-UI-003: Password reset required redirect takes precedence to /reset-password', () => {
  const destAdmin = getPostLoginRedirect({
    role: 'ADMIN',
    onboarded: true,
    requiresPasswordReset: true,
  });
  assert.equal(destAdmin, '/reset-password');

  const destUser = getPostLoginRedirect({
    role: 'USER',
    onboarded: false,
    requiresPasswordReset: true,
  });
  assert.equal(destUser, '/reset-password');
});

test('AUTH-UI-004: Non-onboarded user lands on /onboarding', () => {
  const dest = getPostLoginRedirect({
    role: 'USER',
    onboarded: false,
    requiresPasswordReset: false,
  });
  assert.equal(dest, '/onboarding');
});

test('AUTH-UI-005: ADMIN can open /dashboard (Food)', () => {
  const access = getProductPageAccess({
    role: 'ADMIN',
    onboarded: true,
  });
  assert.equal(access.allowed, true);
  assert.equal(access.redirect, undefined);
});

test('AUTH-UI-006: ADMIN can open /hydration (Water)', () => {
  const access = getProductPageAccess({
    role: 'ADMIN',
    onboarded: true,
  });
  assert.equal(access.allowed, true);
});

test('AUTH-UI-007: ADMIN can open /finance (Money)', () => {
  const access = getProductPageAccess({
    role: 'ADMIN',
    onboarded: true,
  });
  assert.equal(access.allowed, true);
});

test('AUTH-UI-008: ADMIN can open /reminders', () => {
  const access = getProductPageAccess({
    role: 'ADMIN',
    onboarded: true,
  });
  assert.equal(access.allowed, true);
});

test('AUTH-UI-009: ADMIN can open /admin', () => {
  const access = getAdminPageAccess({
    role: 'ADMIN',
    onboarded: true,
  });
  assert.equal(access.allowed, true);
});

test('AUTH-UI-010: USER cannot access /admin and is safely redirected to /today', () => {
  const access = getAdminPageAccess({
    role: 'USER',
    onboarded: true,
  });
  assert.equal(access.allowed, false);
  assert.equal(access.redirect, '/today');
});

test('AUTH-UI-011: Unauthenticated visitor denied /admin and sent to /', () => {
  const access = getAdminPageAccess(null);
  assert.equal(access.allowed, false);
  assert.equal(access.redirect, '/');

  const productAccess = getProductPageAccess(null);
  assert.equal(productAccess.allowed, false);
  assert.equal(productAccess.redirect, '/');
});

test('SOL-R005-004: Unauthenticated visitors avoid redirect loops for password recovery', () => {
  // Unauthenticated visitors accessing protected routes are sent to '/'
  const productAccess = getProductPageAccess(null);
  assert.equal(productAccess.allowed, false);
  assert.equal(productAccess.redirect, '/');

  // Authenticated sessions requiring reset properly route to /reset-password
  const authenticatedReset = getPostLoginRedirect({
    role: 'USER',
    onboarded: true,
    requiresPasswordReset: true,
  });
  assert.equal(authenticatedReset, '/reset-password');

  // Unauthenticated users (null session) must not be navigated to /reset-password
  // because /reset-password immediately redirects unauthenticated users back to '/',
  // causing an infinite redirect loop. The login page provides an inline/modal help notice instead.
  const unauthenticatedSession = null;
  const access = getProductPageAccess(unauthenticatedSession);
  assert.equal(access.allowed, false);
  assert.equal(access.redirect, '/');
});
