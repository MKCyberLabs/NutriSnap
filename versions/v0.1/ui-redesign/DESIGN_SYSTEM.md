# Design System Specification

## 1. Brand

Name: NutriSnap
Tagline: **Eat Well · Drink More · Manage Smart · Live Better**

Brand mark implementation for v0.1:
- Use Lucide `Leaf` or `Sprout` as the canonical in-app mark.
- Do not require a new raster logo asset.
- Desktop: green mark + black `NutriSnap` wordmark.
- Mobile: mark may be omitted when space is tight; wordmark remains.

## 2. Typography

Font family: Inter.
Do not introduce another UI font.

Scale:
- Display/Page title: 30px / 36px, 700.
- H2: 22px / 28px, 700.
- H3/Card title: 16px / 22px, 600.
- Body: 14px / 20px, 400.
- Strong body: 14px / 20px, 600.
- Small: 12px / 16px, 400-500.
- Caption: 11px / 14px, 500.

Numeric money values:
- 24-30px on primary KPI;
- tabular numerals where possible;
- always ₹ and two decimals in Money views unless the existing formatter intentionally suppresses .00.

## 3. Color tokens

Replace global magenta brand tokens.

Recommended CSS variables:

```css
:root {
  --background: 144 33% 98%;
  --foreground: 150 20% 10%;
  --card: 0 0% 100%;
  --card-foreground: 150 20% 10%;

  --primary: 145 72% 39%;
  --primary-foreground: 0 0% 100%;

  --secondary: 145 45% 94%;
  --secondary-foreground: 145 55% 24%;

  --muted: 150 18% 96%;
  --muted-foreground: 150 8% 42%;

  --accent: 145 45% 94%;
  --accent-foreground: 145 55% 24%;

  --border: 145 14% 90%;
  --input: 145 14% 88%;
  --ring: 145 72% 39%;
  --radius: 0.875rem;
}
```

Concrete semantic references:
- Brand green: #16A34A
- Brand dark: #0F7A38
- Mint surface: #EAF8EF
- Blue: #2F80ED
- Blue surface: #EAF3FF
- Amber: #F59E0B
- Amber surface: #FFF4DF
- Red: #EF4444
- Red surface: #FDECEC
- Ink: #111827
- Muted text: #667085
- App background: #F7FAF8
- Border: #E5ECE8
- White: #FFFFFF

Semantics:
- green = primary / success / income / healthy completion;
- blue = hydration / informational;
- amber = bills / upcoming / attention;
- red = expense / destructive / overdue;
- gray = neutral / disabled / metadata.

## 4. Spacing

Use 4px base rhythm.

Allowed primary spacing:
4, 8, 12, 16, 20, 24, 32, 40.

Desktop content:
- sidebar width: 232px;
- page horizontal padding: 28px;
- page vertical padding: 24px;
- card gap: 16px;
- section gap: 24px.

Mobile:
- horizontal padding: 16px;
- section gap: 20px;
- card gap: 12px;
- bottom safe padding: 88px.

## 5. Radius

- KPI/card: 14px.
- Dialog: 18px.
- Input: 10px.
- Button: 10px.
- Pill/chip: 999px.
- Sidebar active item: 10px.

Avoid decorative 2rem+ radii everywhere.

## 6. Elevation

Default card:
`border border-[#E5ECE8] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]`

Interactive hover:
`shadow-[0_6px_18px_rgba(16,24,40,0.08)]`

No glassmorphism as the default style.
No heavy blurred backgrounds.
No large colored shadows.

## 7. Buttons

Primary:
- green background;
- white text;
- 40px desktop default height;
- 44-48px for primary mobile form actions.

Secondary:
- white;
- border;
- dark text.

Danger:
- pale red or red primary only for destructive confirmation.

Icon-only:
- minimum 40x40 desktop;
- minimum 44x44 touch.

## 8. Cards

KPI cards use pale semantic tint only when helpful.
Do not tint entire page.

KPI structure:
- label;
- value;
- optional icon;
- optional contextual note;
- no fake trend badge.

## 9. Forms

- label above field;
- help/error under field;
- 44px minimum field height mobile;
- required fields visibly marked only if necessary;
- validation inline plus toast only for global failure;
- no `prompt()` based forms.

## 10. Motion

Use restrained motion:
- 120-200ms color/shadow transitions;
- modal entrance via existing Radix;
- avoid large spring cascades across every dashboard card;
- respect reduced motion.

## 11. Iconography

Use existing Lucide dependency only.

Canonical mapping:
- Today: House
- Food: Utensils
- Water: Droplets
- Money: WalletCards
- Accounts: Landmark
- Transactions: ArrowLeftRight
- Bills: ReceiptText
- Reminders: Bell
- Settings: Settings
- Admin: ShieldCheck
- Income: ArrowUpRight
- Expense: ArrowDownRight
- Transfer: ArrowLeftRight
- Recharge: Smartphone
- Credit card: CreditCard
- Subscription: Repeat2

Do not mix emoji with Lucide in primary navigation.
