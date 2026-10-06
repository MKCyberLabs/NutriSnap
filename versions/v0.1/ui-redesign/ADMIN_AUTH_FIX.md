# Admin Login / Routing Fix

## Observed issue

Current login code contains:

```ts
if (data.requiresPasswordReset) {
  router.push('/reset-password');
} else if (data.role === 'ADMIN') {
  router.push('/admin');
} else {
  router.push(data.onboarded ? '/dashboard' : '/onboarding');
}
```

Food also contains an ADMIN redirect to `/admin`.

This makes an admin identity unable to naturally use the normal NutriSnap product.

## Required behavior

### Login landing

```text
requiresPasswordReset?
  YES -> /reset-password
  NO  -> onboarded?
           NO  -> /onboarding
           YES -> /today
```

Role does not determine the normal home.

### Admin authorization

Role only determines whether:
- Admin navigation is visible;
- `/admin` is authorized.

An ADMIN is also a normal NutriSnap user.

### Page guards

Food, Water, Today, Money, Reminders, Settings:
- require authenticated user;
- enforce onboarding where appropriate;
- DO NOT redirect because user is ADMIN.

Admin:
- require authenticated user;
- require role ADMIN;
- non-admin -> safe redirect to `/today` or unauthorized state.

## Tests

AUTH-UI-001 ADMIN valid login -> /today.
AUTH-UI-002 USER valid login -> /today.
AUTH-UI-003 password reset -> /reset-password.
AUTH-UI-004 non-onboarded -> /onboarding.
AUTH-UI-005 ADMIN can open /dashboard.
AUTH-UI-006 ADMIN can open /hydration.
AUTH-UI-007 ADMIN can open /finance.
AUTH-UI-008 ADMIN can open /reminders.
AUTH-UI-009 ADMIN can open /admin.
AUTH-UI-010 USER cannot access /admin.
AUTH-UI-011 logout clears session and returns login.

Do not weaken server-side session checks.
