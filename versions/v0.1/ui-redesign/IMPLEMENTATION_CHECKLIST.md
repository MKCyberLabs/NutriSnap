# Implementation Checklist

Mark each item with:
- [ ] NOT STARTED
- [~] IN PROGRESS
- [x] PASS
- [!] BLOCKED

## UI-000 Baseline
- [ ] UI-0001 branch is `feature/v0.1-ui-redesign`.
- [ ] UI-0002 worktree clean.
- [ ] UI-0003 current main baseline present.
- [ ] UI-0004 full existing v0.1 test gate PASS.
- [ ] UI-0005 before screenshots captured.
- [ ] UI-0006 UAT/prod boundaries confirmed.

## UI-100 Design system
- [ ] UI-1001 green global tokens.
- [ ] UI-1002 Inter hierarchy.
- [ ] UI-1003 radius/elevation normalized.
- [ ] UI-1004 semantic tones.
- [ ] UI-1005 Brand component.
- [ ] UI-1006 MetricCard.
- [ ] UI-1007 SectionCard.
- [ ] UI-1008 Empty/Error/Loading states.
- [ ] UI-1009 StatusPill/MoneyAmount.
- [ ] UI-1010 old global magenta removed from primary design system.

## UI-200 Shell
- [ ] UI-2001 AppShell.
- [ ] UI-2002 DesktopSidebar.
- [ ] UI-2003 MobileTopBar.
- [ ] UI-2004 MobileBottomNav exactly Today/Food/Water/Money/More.
- [ ] UI-2005 More sheet includes Reminders/Settings/Admin-if-role/Logout.
- [ ] UI-2006 active route states.
- [ ] UI-2007 Money nested desktop routes.
- [ ] UI-2008 no duplicate page-level navbars.

## UI-300 Auth/admin routing
- [ ] UI-3001 admin login lands /today.
- [ ] UI-3002 normal user lands /today.
- [ ] UI-3003 reset flow preserved.
- [ ] UI-3004 onboarding flow preserved.
- [ ] UI-3005 admin no longer redirected away from Food.
- [ ] UI-3006 admin role gate remains on /admin.
- [ ] UI-3007 tests AUTH-UI-001..011.

## UI-400 Today
- [ ] UI-4001 page header.
- [ ] UI-4002 4 KPI cards real data.
- [ ] UI-4003 Today's Focus.
- [ ] UI-4004 Recent Transactions real data helper.
- [ ] UI-4005 Health & Wellness card.
- [ ] UI-4006 empty/error/partial states.
- [ ] UI-4007 Quick Add.
- [ ] UI-4008 mobile layout.
- [ ] UI-4009 no fake trend percentages.

## UI-500 Money
- [ ] UI-5001 overview.
- [ ] UI-5002 accounts route.
- [ ] UI-5003 transactions route.
- [ ] UI-5004 bills route.
- [ ] UI-5005 forms use existing actions/services.
- [ ] UI-5006 transfer semantics unchanged.
- [ ] UI-5007 Paid idempotency unchanged.
- [ ] UI-5008 responsive lists/cards.
- [ ] UI-5009 empty states.

## UI-600 Food + Water
- [ ] UI-6001 Food in AppShell.
- [ ] UI-6002 Food ADMIN access works.
- [ ] UI-6003 Food existing features preserved.
- [ ] UI-6004 Water in AppShell.
- [ ] UI-6005 Water blue is local accent only.
- [ ] UI-6006 Water existing features preserved.
- [ ] UI-6007 no mobile overflow.

## UI-700 Reminders / Settings / Admin
- [ ] UI-7001 Reminders filters.
- [ ] UI-7002 Reminder rows.
- [ ] UI-7003 add/edit flow.
- [ ] UI-7004 Settings page.
- [ ] UI-7005 Admin common shell.
- [ ] UI-7006 Admin mobile usability.
- [ ] UI-7007 no secret/session fields exposed.

## UI-800 Accessibility/responsive
- [ ] UI-8001 360px.
- [ ] UI-8002 390px.
- [ ] UI-8003 768px.
- [ ] UI-8004 1024px.
- [ ] UI-8005 1440px.
- [ ] UI-8006 keyboard navigation.
- [ ] UI-8007 focus visible.
- [ ] UI-8008 touch targets.
- [ ] UI-8009 no horizontal overflow.
- [ ] UI-8010 semantic headings/labels.

## UI-900 Final gate
- [ ] UI-9001 analysis contract.
- [ ] UI-9002 typecheck.
- [ ] UI-9003 build.
- [ ] UI-9004 finance tests.
- [ ] UI-9005 reminder tests.
- [ ] UI-9006 today tests.
- [ ] UI-9007 security tests.
- [ ] UI-9008 life-hub tests.
- [ ] UI-9009 local verify script.
- [ ] UI-9010 new UI/auth tests.
- [ ] UI-9011 browser matrix.
- [ ] UI-9012 screenshots.
- [ ] UI-9013 git diff --check.
- [ ] UI-9014 secret scan.
- [ ] UI-9015 clean branch + pushed.
- [ ] UI-9016 PR opened; agent does not merge.
