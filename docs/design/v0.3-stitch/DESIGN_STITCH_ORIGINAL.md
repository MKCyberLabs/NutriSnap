---
name: NutriSnap Precision Health & Wealth
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#4a4455'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#7b7486'
  outline-variant: '#ccc3d7'
  surface-tint: '#7331df'
  primary: '#5300b7'
  on-primary: '#ffffff'
  primary-container: '#6d28d9'
  on-primary-container: '#dac5ff'
  inverse-primary: '#d3bbff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#3f4049'
  on-tertiary: '#ffffff'
  tertiary-container: '#575761'
  on-tertiary-container: '#cfcdd9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ebddff'
  primary-fixed-dim: '#d3bbff'
  on-primary-fixed: '#250059'
  on-primary-fixed-variant: '#5b00c5'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#e3e1ed'
  tertiary-fixed-dim: '#c7c5d1'
  on-tertiary-fixed: '#1a1b23'
  on-tertiary-fixed-variant: '#46464f'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  numeric-metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style
The design system positions metabolic health alongside personal asset management as dual pillars of vitality. It merges the analytical authority of wealth management software with the crisp, life-affirming clarity of modern preventive health. 

The aesthetic is strictly two-dimensional, clinical yet warm, and built on a high-order flat-card architecture. It avoids superficial decorations—there are no blurry glassmorphic panels, skeuomorphic bevels, or muddy gradients. Instead, the interface relies on deliberate proportional harmony, expansive negative space, razor-sharp typographic hierarchy, and surgical 1px boundaries. Interactions must evoke precision, control, calm clarity, and absolute reliability.

## Colors
The palette balances authoritative deep royal purple `#6D28D9` with active violet `#8B5CF6`, framed by a luminous, low-fatigue backdrop:
- **Canvas & Backgrounds:** The base viewport runs on `#FAFAFC`, while elevated analytical modules sit on pure `#FFFFFF`. Tinted tint surfaces, selection pools, and metric highlight backgrounds use `#F5F3FF`.
- **Text & Contrast:** Primary text is strictly `#1E293B` (yielding >10:1 contrast on white), while secondary metadata, captions, and structural keys use `#64748B` (retaining full WCAG AA compliance).
- **Boundaries & Dividers:** Card perimeter rules, table separators, and input borders utilize `#E2E8F0` at 1px solid stroke width.
- **Functional Semantics:** Success/Yield uses `#059669` (with a `#ECFDF5` wash), Attention/Deficit uses `#DC2626` (with a `#FEF2F2` wash), and Caution/Pending uses `#D97706` (with a `#FFFBEB` wash).

## Typography
Inter delivers clean, legible rendering across all screens. Letter-spacing tightens slightly on larger headings to reinforce impact and solid structure, while secondary labels and micro-metrics use neutral tracking to preserve tabular clarity. 

All financial and nutritional values, timestamps, and key statistical points must activate tabular numerals (`font-feature-settings: "tnum" 1, "cv05" 1`) to ensure vertical alignment in tables, lists, and comparative stat modules.

## Layout & Spacing
The layout follows an 8pt architectural rhythm, organized into a 12-column responsive fluid grid on desktop (`>1024px`), an 8-column layout on tablet (`768px - 1023px`), and a 4-column system on mobile (`<768px`).

- **Grid Dynamics:** Canvas width caps at 1280px for desktop dashboard readability, framed with a 32px (`2rem`) outer margin. On mobile screens, outer margins collapse to 16px (`1rem`) to maximize card surface area while maintaining safe-area compliance.
- **Section Rhythm:** Related controls and label-value pairs cluster via `space-xs` (4px) and `space-sm` (8px). Structural padding inside cards uses `space-lg` (24px) on desktop and `space-md` (16px) on mobile. Section blocks divide via `space-xl` (36px).

## Elevation & Depth
Depth in this system is strictly planar, clean, and controlled. It avoids dramatic drops or multi-colored glow effects. Visual hierarchy is achieved through a combination of crisp 1px borders and subtle 2D structural shadows:

- **Flat Canvas:** Surface 0 sits on `#FAFAFC`.
- **Card Tier (Resting):** Pure `#FFFFFF` surface bounded by a 1px solid stroke in `#E2E8F0` with a subtle elevation profile: `0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Card Tier (Hover / Interactive):** Retains the 1px boundary in `#8B5CF6`, accompanied by an elevated profile: `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Floating / Modal Layers:** Dropdowns, dialogs, and popovers maintain `#FFFFFF` backed by `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)` with a 1px border of `#E2E8F0`.

## Shapes
Geometry is disciplined, balanced, and deliberately geometric. It bridges friendly organic health cues with structured fintech order:
- **Core Cards & Dashboards:** 16px border-radius (`rounded-lg`).
- **Interactive Controls (Inputs, Standard Buttons):** 12px border-radius.
- **Micro UI & Badges:** Rounded pills (`border-radius: 9999px`) provide contrast against rectangular cards.
- **Large Presentation Panels / Drawers:** 18px border-radius (`rounded-xl`).

## Components

### Buttons
All buttons maintain a minimum interactive hit area of 44px by 44px. Visible focus states utilize an offset ring: `outline: 2px solid #6D28D9; outline-offset: 2px`.
- **Primary:** Filled `#6D28D9` with `#FFFFFF` text. Hover transitions to `#5B21B6`. Active scales to 0.99 with background `#4C1D95`.
- **Secondary:** Filled `#F5F3FF` with `#6D28D9` text. Hover transitions to `#EDE9FE`.
- **Outline:** Transparent background, 1px solid `#E2E8F0` border, `#1E293B` text. Hover initiates a `#F8FAFC` fill and `#CBD5E1` border.
- **Ghost:** Transparent background with `#64748B` text. Hover transitions to `#F5F3FF` background with `#6D28D9` text.

### Pill Badges & Chips
Rendered with `border-radius: 9999px`, height 24px, and horizontal padding of 10px:
- **Neutral:** Background `#F1F5F9`, text `#475569`.
- **Active / Primary:** Background `#F5F3FF`, text `#6D28D9`, border 1px solid `#DDD6FE`.
- **Health / Wealth Surpluses:** Background `#ECFDF5`, text `#047857`, border 1px solid `#A7F3D0`.

### Input Fields
Inputs are 44px tall with a 12px radius, a 1px solid `#E2E8F0` border, and a pure `#FFFFFF` background. Text is set at 14px in `#1E293B`, with placeholders in `#94A3B8`. Focused fields transition to a border of `#6D28D9` alongside a crisp focus ring: `box-shadow: 0 0 0 3px rgba(109, 40, 217, 0.15)`.

### Checkboxes & Radio Controls
Interactive hit area is padded to 44px. Visual glyphs measure 18px by 18px with a 1.5px `#CBD5E1` border. When checked, the fill shifts to `#6D28D9` with a white checkmark or center pip. Radii: checkboxes use 4px, radio buttons use 9999px.

### Navigation Items
- **Desktop Sidebar:** 40px tall nav links with 12px corner radii. Inactive states use `#64748B` with 20px line icons; active states use `#F5F3FF` background, `#6D28D9` text, and bold icon variants.
- **Mobile Bottom Bar:** 64px fixed dock on `#FFFFFF` with a 1px `#E2E8F0` top border. Each destination features an icon and an 11px label, hitting an minimum hit box of 48px by 48px.

### Stat Cards & Metric Gauges
- **Stat Cards:** Built on a `#FFFFFF` base with a 16px radius and 1px `#E2E8F0` border. Padding is 20px. The layout features an upper row with a label (`13px`, `#64748B`) and a 24px pill status badge, followed by the metric display (`numeric-metric`, `#1E293B`), and a bottom caption showing nutritional tracking or net cash value trends.
- **Linear Metric Gauges:** 6px tall progress track in `#F1F5F9` with a rounded cap. Active progress fills in flat `#6D28D9` (daily calorie or budget limits) or `#8B5CF6` (macronutrient or portfolio split), avoiding skeuomorphic gloss and gradients.