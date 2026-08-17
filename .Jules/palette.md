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

## 2024-03-24 - [Missing ARIA Labels on Unlabelled Inputs]
**Learning:** Found instances where input fields (like the number input for item grams or the text input for new items in popovers, and the custom range slider) lacked explicit `<label>` elements or `aria-label` attributes. This leaves screen reader users without context of what the input is for.
**Action:** When creating form inputs that do not have a corresponding visual `<label>`, always use the `aria-label` attribute to explicitly describe the input's purpose and expected value.

## 2024-03-05 - [Range Input Accessibility]
**Learning:** Found an `input` element with `type="range"` in `src/app/hydration/page.tsx` for custom hydration amounts that was lacking an explicit `aria-label`. Since it's a standalone input used as a slider, it's critical for screen readers to have a descriptive `aria-label` to announce its purpose.
**Action:** Always verify that native `<input>` elements (especially range sliders and checkboxes) without explicit visual `<label>` tags have an appropriate `aria-label` attached for screen reader accessibility.

## 2024-05-16 - [Hydration Hub]
**Learning:** Added `aria-label` attributes to the quick-add buttons and custom drink type selection buttons. Improved accessibility for screen readers.
**Action:** Ensure icon-only buttons always have `aria-label` attributes for accessibility.

## 2024-05-24 - [ARIA Labels for Quick-Add Buttons]
**Learning:** Found multiple instances where interactive elements (e.g. quick hydration buttons) used visual labels inside `<span>` tags (like "250 ml") alongside icons, but lacked explicit descriptive ARIA labels on the `<button>` itself, which would provide better context (like "Add 250 ml") for screen readers instead of just reading the literal text.
**Action:** Always add descriptive `aria-label` attributes to action buttons that rely on icons + brief literal text, ensuring screen readers announce the intended action, not just the text value.

## 2024-08-14 - [Missing ARIA Labels on Select Triggers]
**Learning:** Found instances where custom dropdown triggers (like `SelectTrigger` in Shadcn UI components) lacked explicit `aria-label` attributes. Even if they have a placeholder, screen readers might not announce their purpose clearly without an explicit label.
**Action:** When creating custom select dropdowns, especially for picking values like time (hours/minutes), always ensure the `SelectTrigger` has an `aria-label` to provide context for screen reader users.

## 2024-10-25 - [Missing ARIA Pressed and Focus Visible on Custom Toggle Buttons in Navbar]
**Learning:** Found custom button groups (like the NutriSnap / Hydration Hub toggle in `Navbar.tsx`) missing important accessibility attributes. They lacked `aria-pressed` state to indicate selection, and `type="button"` which is a best practice. Furthermore, they did not implement `focus-visible` styles which hurts keyboard navigation usability.
**Action:** Always add `aria-pressed`, `type="button"`, and explicit `focus-visible` classes (like `focus-visible:ring-2`) to custom interactive UI elements used as toggles to ensure screen readers and keyboard users can effectively operate them.

## 2024-11-20 - [Missing ARIA Labels on Select Triggers in Forms]
**Learning:** Discovered unlabelled `SelectTrigger` components in custom forms (like those in user admin settings, onboarding metrics, and hydration reminder settings). While they may have placeholders, without an explicit `aria-label`, screen readers may not announce the field's purpose clearly, leading to accessibility issues in forms.
**Action:** When building forms using custom select dropdowns (e.g. Shadcn UI `Select`), always add an `aria-label` to the `SelectTrigger` component to explicitly communicate the field's purpose to assistive technologies.

## 2024-11-20 - [Missing aria-pressed on Custom Toggle Buttons]
**Learning:** Found custom button groups for drink type selection in the Hydration Hub that acted like single-select toggles (radio behavior) but lacked `aria-pressed` states and `type="button"`. They also lacked focus-visible states for keyboard accessibility.
**Action:** When creating custom interactive UI elements used as toggles or single-select groups, always ensure they have `type="button"`, explicit `aria-pressed` attributes matching their active state, and explicit `focus-visible` classes (like `focus-visible:ring-2`) to ensure screen readers and keyboard users can effectively operate them.

## 2024-05-18 - [Missing Accessibility Attributes on Custom Radio Buttons]
**Learning:** Found custom interactive elements (e.g. custom drink type selection buttons in `src/app/hydration/page.tsx`) being used as a single-select radio group but lacking essential accessibility attributes such as `aria-pressed`, `aria-label`, and `type="button"`. Also lacked `focus-visible` states.
**Action:** Always ensure that elements acting as custom toggles or radio options have `type="button"`, proper `aria-pressed` states, descriptive `aria-label`s, and explicit keyboard focus styles (`focus-visible`). Additionally, add `aria-hidden="true"` to decorative elements like emojis within these interactive components.

## 2024-05-18 - [Invalid HTML and Accessibility in Links]
**Learning:** Next.js `<Link>` elements should not wrap `<button>` elements directly inside them, as this generates invalid HTML and breaks semantic a11y tooling. Navigation links should be actual anchor tags (styled like buttons if desired).
**Action:** Remove nested `<button>` inside `<Link>`. Apply button-like styling and `focus-visible` classes directly to the `<Link>`. Use `aria-current="page"` instead of `aria-pressed` for active navigation states.

## 2024-07-26 - [Nesting Buttons inside Links]
**Learning:** Found instances where `<button>` elements were directly nested inside `<Link>` components (e.g., in `Navbar.tsx`). This generates invalid HTML because interactive elements should not be nested, and it negatively impacts accessibility and standard keyboard navigation. Furthermore, active links often lacked `aria-current="page"` and `focus-visible` styles.
**Action:** Always apply button-like styles directly to the `<Link>` element instead of nesting a `<button>` inside. When modifying navigation links, ensure they use `aria-current="page"` to semantically indicate the active view and include explicit `focus-visible` classes (like `focus-visible:outline-none focus-visible:ring-2`) to ensure keyboard accessibility. When wrapping Shadcn UI components (like `<Button>`) around a `<Link>`, always use the `asChild` prop on the component.
