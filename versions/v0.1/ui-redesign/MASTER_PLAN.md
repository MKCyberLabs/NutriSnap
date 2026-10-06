# Master Plan — NutriSnap v0.1 UI/UX Redesign

## Product statement

NutriSnap v0.1 is one daily life dashboard for:

**Health**
- Food
- Water

**Wealth**
- Accounts
- Transactions
- Bills / Subscriptions / Recharge / EMI

**Shared**
- Today
- Quick Add
- Reminders
- Settings

The redesign must make these modules feel like one product.

## Visual hierarchy

Desktop:
1. Persistent left sidebar.
2. Thin page header / action row.
3. Main content canvas.
4. Summary metrics first.
5. Daily focus and recent activity second.
6. Detailed module content below.

Mobile:
1. Compact top app bar.
2. Page content.
3. Sticky bottom navigation.
4. Floating or prominent context action only when necessary.

## Implementation phases

### Phase UI-0 — Freeze & baseline
- Verify branch and clean worktree.
- Run current v0.1 software gate.
- Capture before screenshots for Today, Food, Water, Money, Reminders, Login, Admin.
- Do not implement until baseline is recorded.

### Phase UI-1 — Design system + shell
Implement shared tokens and components first:
- green brand palette;
- typography;
- elevations;
- card system;
- AppShell;
- DesktopSidebar;
- MobileBottomNav;
- MobileMoreSheet;
- TopBar;
- PageHeader;
- common empty/loading/error states.

No page-specific one-off shell styling after this phase.

### Phase UI-2 — Auth and routing correction
Fix admin behavior:
- successful onboarded ADMIN -> `/today`, not `/admin`;
- successful onboarded USER -> `/today`;
- password-reset requirement still wins;
- onboarding requirement still wins;
- Food/Water/Money pages must allow ADMIN to use the normal application;
- Admin page is an explicit role-gated destination.

### Phase UI-3 — Today dashboard
Rebuild `/today` to match the reference layout using real data only:
- 4 summary cards;
- Today's Focus;
- Recent Activity/Transactions;
- Health & Wellness;
- upcoming obligation/reminder information;
- Quick Add.

### Phase UI-4 — Money experience
Split the current large Finance presentation into a coherent Money experience:
- Overview;
- Accounts;
- Transactions;
- Bills & Subscriptions.
Use shared components and preserve existing actions/services.

### Phase UI-5 — Health pages
Restyle Food and Water inside the same shell without removing existing functionality.
The domain-specific blue water semantic color is allowed inside content, but the global shell remains NutriSnap green/neutral.

### Phase UI-6 — Reminders + Settings + Admin
- unified reminder list;
- clear filter chips;
- readable recurrence/status;
- settings becomes a page on mobile and may reuse existing SettingsModal content;
- Admin receives same shell but remains management-oriented.

### Phase UI-7 — Responsive & interaction polish
- 360px;
- 390px;
- 768px;
- 1024px;
- 1440px.
Validate dialogs, tables, sidebars, bottom nav, sticky actions, scrolling, touch targets.

### Phase UI-8 — Browser gate
AGY-Manickam uses browser mode against UAT.
Capture screenshots and execute `TEST_MATRIX.md`.

### Phase UI-9 — Final PR
- clean branch;
- full software gate;
- visual evidence;
- no merge by agent;
- owner decides merge.

## Hard product decisions

1. **Green is the primary brand color.** Pink/magenta is removed from the global design tokens.
2. **Today is the default home for all onboarded users**, including ADMIN.
3. **Admin is not a separate product home.**
4. **Desktop uses a sidebar; mobile uses bottom navigation.**
5. **No invented trends.** If backend does not provide trend delta, do not render +2.4%, +12%, etc.
6. **No invented recent transaction data.** Query real recent transactions if the section needs them.
7. **No hidden business semantics changes while redesigning UI.**
8. **Single agent only:** AGY-Manickam performs implementation, browser testing, fixes, documentation, and final report.
