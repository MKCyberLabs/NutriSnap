# Stitch change request — NutriSnap V0.3

Work only in existing Google Stitch project `4448411547551220279`; preserve approved 2D purple aesthetic. Do not delete any pages automatically. The uploaded ZIP contains 55 HTML exports (31 desktop, 24 mobile), including six reference-only design boards. Read `AUDIT_REPORT.md` and `CRUD_ACTION_MATRIX.csv` first.

1. Re-render/fix `onboarding_goal_setup_desktop_1440px` (large blank content), `meal_confirmation_editing_mobile_390px` (blank preview), `today_overview_desktop_1440px` (empty key charts/cards). Re-export `bills_subscriptions_desktop_1440px` preview, currently missing.
2. Add `login_mobile_390px`. Align with registration and actual email/password sign-in; use a reset-password screen only if the app supports it or mark as proposed.
3. Main mobile screens must expose Add, Edit, and Delete/Archive actions with a consistent row/card overflow menu or visible icon. Prioritize Water, Transactions, Accounts, Bills, Loans, Friends & Family, Wishlist, Reminders. Explicit EDIT forms are missing even in the reference board for Bills, Loans and Wishlist; design these. Show full edit and delete-confirmation sheets including Cancel, destructive confirmation, and failure state. Account/loan with history should use Close/Archive rather than blind cascade delete.
4. Standardize mobile navigation as Today, Food, Water, Money, More (Money submenu and role-aware More). Keep desktop nested money routes.
5. Standardize tokens using #6D28D9 primary, #8B5CF6 secondary, #FAFAFC background, #F5F3FF lavender surfaces. Reconcile DESIGN.md YAML/prose contradictions.
6. Ensure dates and financial amounts are mock examples only and never imply real bank linkage, AI certainty, Telegram connection, or saved records before real persistence.
7. Provide an entity-by-entity CRUD action map for each desktop/mobile screen and explicit templates for validation, loading, empty, error, save success, delete confirm and undo where appropriate. Treat reference boards as design documentation, not user-facing routes.
8. Finish with a design QA pass at 390px, 768px, and 1440px. Provide project screen title inventory and export all updated screens as HTML+PNG, not just screenshots.

Do not implement backend logic. Do not overwrite production or move files into the app repository.