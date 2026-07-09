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
## 2026-06-28 - [Accessibility: ARIA Labels for Icon Buttons]
**Learning:** Icon-only buttons lacking 'aria-label' are inaccessible to screen readers. Standard Radix UI / Shadcn buttons used for actions like 'Previous'/'Next' and 'Edit'/'Delete' often default to icon-only content visually, requiring explicit ARIA labels.
**Action:** Always add descriptive 'aria-label' attributes to any button where the primary content is an icon (e.g., <Button size="icon">) to ensure they are properly read by screen readers.
## 2024-10-25 - [Missing ARIA Labels on Custom Toggle Buttons]
**Learning:** Found custom button groups (like the day of the week selector in `SettingsModal.tsx`) missing important accessibility attributes. They lacked contextually descriptive `aria-label`s, the `aria-pressed` state to indicate selection, and `type="button"` which is a best practice. Furthermore, they did not implement `focus-visible` styles which hurts keyboard navigation usability.
**Action:** Always add full-text `aria-label` (e.g. "Monday" instead of "M"), `aria-pressed`, `type="button"`, and explicit `focus-visible` classes (like `focus-visible:ring-2`) to custom interactive UI elements used as toggles or checkboxes to ensure screen readers and keyboard users can effectively operate them.

## 2024-05-24 - [ARIA Labels for Quick-Add Buttons]
**Learning:** Found multiple instances where interactive elements (e.g. quick hydration buttons) used visual labels inside `<span>` tags (like "250 ml") alongside icons, but lacked explicit descriptive ARIA labels on the `<button>` itself, which would provide better context (like "Add 250 ml") for screen readers instead of just reading the literal text.
**Action:** Always add descriptive `aria-label` attributes to action buttons that rely on icons + brief literal text, ensuring screen readers announce the intended action, not just the text value.
