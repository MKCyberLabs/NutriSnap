## 2024-06-22 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a recurring pattern across dashboard and layout components (`Navbar`, `MealCategoryCard`, `MealAnalysisTool`) where icon-only buttons (`<Button size="icon">...<Icon />...</Button>`) lacked `aria-label` attributes, making them inaccessible to screen readers.
**Action:** When creating or reviewing components with icon-only buttons, especially those using `size="icon"`, always explicitly set an `aria-label` that clearly describes the button's action.## 2026-06-24 - [Missing ARIA Labels on Navigation and Action Buttons]
**Learning:** Found multiple instances of icon-only buttons (like calendar navigation, delete, and edit actions) missing `aria-label` attributes across dashboard and admin views.
**Action:** Added contextually accurate `aria-label` attributes to improve screen reader accessibility without changing visual styling.
## 2024-03-22 - [Hidden Input Accessibility]
**Learning:** Using `className="hidden"` on file inputs completely removes them from the accessibility tree, making them unreachable by keyboard users. Adding a focus indicator on the wrapper is also crucial since the input itself is visually hidden.
**Action:** Always use `sr-only` instead of `hidden` for file inputs, and ensure the parent `<label>` has `focus-within` styles to visually indicate when the hidden input receives focus.

## 2024-07-26 - [Missing ARIA Labels on Inline Action Buttons]
**Learning:** Found more instances of icon-only buttons missing `aria-label` attributes across dashboard and settings views (e.g. inline confirmation and save reminder buttons).
**Action:** When adding inline forms or state-modifying actions inside larger views, ensure any icon-only `<Button>` (even without `size="icon"` explicitly sometimes, but specifically those just holding an `<Icon />`) always have contextually accurate `aria-label`s.
## 2024-07-01 - [Added missing aria-labels to hydration utility icon buttons]
**Learning:** Utility icon buttons (e.g., date pagination, edit/delete actions) in dynamic pages (like the Hydration tracker) frequently miss `aria-label` attributes for screen readers.
**Action:** Always ensure dynamic icon-only buttons include descriptive `aria-label` attributes that update appropriately with state (e.g., 'Previous day' vs 'Previous week').
