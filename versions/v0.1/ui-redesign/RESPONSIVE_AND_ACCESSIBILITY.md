# Responsive & Accessibility Specification

## Breakpoints

### Mobile 360-639
- no desktop sidebar;
- mobile top bar;
- fixed bottom nav;
- content single column;
- 16px side padding;
- bottom padding >= 88px;
- dialogs max 94vw;
- forms single column;
- finance tables rendered as cards/lists.

### Tablet 640-1023
- no persistent sidebar unless layout remains spacious;
- bottom nav may remain through 767;
- 768-1023 may use compact top/side navigation at agent discretion only if no layout duplication;
- KPI grid 2 columns;
- forms may use 2 columns.

### Desktop >= 1024
- 232px persistent sidebar;
- main content min-width 0;
- KPI grid 4 columns;
- dashboard middle row 3 columns with proportions 1.1fr 1.4fr 0.9fr;
- max content width about 1440px, not narrow 1152px if space exists.

## Mobile bottom nav

Height about 64px plus safe area.
Items:
Today / Food / Water / Money / More.

Each touch target >= 44x44.
Active item green.
Text 10-11px.

## Sidebar

Width 232px.
Sticky/fixed full viewport.
Logo region 72px high.
Nav row 40px.
Active background mint.
Nested Money children indented 28px.

Footer:
user name/email or name/role;
settings/logout via More/footer controls.

## Accessibility

Must pass:
- semantic `nav`, `main`, headings;
- only one H1 per page;
- labels for form controls;
- visible focus ring;
- keyboard modal operation from Radix;
- icon-only buttons have aria-label;
- color is not sole status indicator;
- meaningful empty/error text;
- minimum target size 44px on mobile;
- tables have headings on desktop;
- responsive cards preserve labels on mobile;
- no text smaller than 10px;
- respect `prefers-reduced-motion`.

## Contrast

Primary green on white must meet AA for text/buttons.
Muted text must remain readable; avoid very pale gray for body copy.
Red/green financial values include sign and/or label, not color alone.

## Overflow requirements

At viewport 360px:
- document body `scrollWidth <= clientWidth + 1`;
- no clipped modal actions;
- no hidden form submit;
- no horizontally scrolling main navigation;
- transaction/account list may internally truncate text but not amount.

## Browser screenshot checkpoints

Required:
- Login desktop 1440x900
- Today desktop 1440x900
- Today mobile 390x844
- Money desktop 1440x900
- Accounts mobile 390x844
- Add Transaction mobile 390x844
- Reminders mobile 390x844
- Food desktop
- Water mobile
- Admin desktop
