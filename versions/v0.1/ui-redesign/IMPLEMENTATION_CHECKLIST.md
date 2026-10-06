# Implementation Checklist

Mark each item with:
- [ ] NOT STARTED
- [~] IN PROGRESS
- [x] PASS
- [!] BLOCKED

## UI-000 Baseline
- [x] UI-0001 branch is `feature/v0.1-ui-redesign`.
- [x] UI-0002 worktree clean.
- [x] UI-0003 current main baseline present.
- [x] UI-0004 full existing v0.1 test gate PASS.
- [x] UI-0005 before screenshots captured.
- [x] UI-0006 UAT/prod boundaries confirmed.

## UI-100 Design system
- [x] UI-1001 green global tokens.
- [x] UI-1002 Inter hierarchy.
- [x] UI-1003 radius/elevation normalized.
- [x] UI-1004 semantic tones.
- [x] UI-1005 Brand component.
- [x] UI-1006 MetricCard.
- [x] UI-1007 SectionCard.
- [x] UI-1008 Empty/Error/Loading states.
- [x] UI-1009 StatusPill/MoneyAmount.
- [x] UI-1010 old global magenta removed from primary design system.

## UI-200 Shell
- [x] UI-2001 AppShell.
- [x] UI-2002 DesktopSidebar.
- [x] UI-2003 MobileTopBar.
- [x] UI-2004 MobileBottomNav exactly Today/Food/Water/Money/More.
- [x] UI-2005 More sheet includes Reminders/Settings/Admin-if-role/Logout.
- [x] UI-2006 active route states.
- [x] UI-2007 Money nested desktop routes.
- [x] UI-2008 no duplicate page-level navbars.

## UI-300 Auth/admin routing
- [x] UI-3001 admin login lands /today.
- [x] UI-3002 normal user lands /today.
- [x] UI-3003 reset flow preserved.
- [x] UI-3004 onboarding flow preserved.
- [x] UI-3005 admin no longer redirected away from Food.
- [x] UI-3006 admin role gate remains on /admin.
- [x] UI-3007 tests AUTH-UI-001..011.

## UI-400 Today
- [x] UI-4001 page header.
- [x] UI-4002 4 KPI cards real data.
- [x] UI-4003 Today's Focus.
- [x] UI-4004 Recent Transactions real data helper.
- [x] UI-4005 Health & Wellness card.
- [x] UI-4006 empty/error/partial states.
- [x] UI-4007 Quick Add.
- [x] UI-4008 mobile layout.
- [x] UI-4009 no fake trend percentages.

## UI-500 Money
- [x] UI-5001 overview.
- [x] UI-5002 accounts route.
- [x] UI-5003 transactions route.
- [x] UI-5004 bills route.
- [x] UI-5005 forms use existing actions/services.
- [x] UI-5006 transfer semantics unchanged.
- [x] UI-5007 Paid idempotency unchanged.
- [x] UI-5008 responsive lists/cards.
- [x] UI-5009 empty states.

## UI-600 Food + Water
- [x] UI-6001 Food in AppShell.
- [x] UI-6002 Food ADMIN access works.
- [x] UI-6003 Food existing features preserved.
- [x] UI-6004 Water in AppShell.
- [x] UI-6005 Water blue is local accent only.
- [x] UI-6006 Water existing features preserved.
- [x] UI-6007 no mobile overflow.

## UI-700 Reminders / Settings / Admin
- [x] UI-7001 Reminders filters.
- [x] UI-7002 Reminder rows.
- [x] UI-7003 add/edit flow.
- [x] UI-7004 Settings page.
- [x] UI-7005 Admin common shell.
- [x] UI-7006 Admin mobile usability.
- [x] UI-7007 no secret/session fields exposed.

## UI-800 Accessibility/responsive
- [x] UI-8001 360px.
- [x] UI-8002 390px.
- [x] UI-8003 768px.
- [x] UI-8004 1024px.
- [x] UI-8005 1440px.
- [x] UI-8006 keyboard navigation.
- [x] UI-8007 focus visible.
- [x] UI-8008 touch targets.
- [x] UI-8009 no horizontal overflow.
- [x] UI-8010 semantic headings/labels.

## UI-900 Final gate
- [x] UI-9001 analysis contract.
- [x] UI-9002 typecheck.
- [x] UI-9003 build.
- [x] UI-9004 finance tests.
- [x] UI-9005 reminder tests.
- [x] UI-9006 today tests.
- [x] UI-9007 security tests.
- [x] UI-9008 life-hub tests.
- [x] UI-9009 local verify script.
- [x] UI-9010 new UI/auth tests.
- [x] UI-9011 browser matrix.
- [x] UI-9012 screenshots.
- [x] UI-9013 git diff --check.
- [x] UI-9014 secret scan.
- [x] UI-9015 clean branch + pushed.
- [x] UI-9016 PR opened; agent does not merge.
