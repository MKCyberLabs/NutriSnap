## 2024-06-22 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a recurring pattern across dashboard and layout components (`Navbar`, `MealCategoryCard`, `MealAnalysisTool`) where icon-only buttons (`<Button size="icon">...<Icon />...</Button>`) lacked `aria-label` attributes, making them inaccessible to screen readers.
**Action:** When creating or reviewing components with icon-only buttons, especially those using `size="icon"`, always explicitly set an `aria-label` that clearly describes the button's action.## 2026-06-24 - [Missing ARIA Labels on Navigation and Action Buttons]
**Learning:** Found multiple instances of icon-only buttons (like calendar navigation, delete, and edit actions) missing `aria-label` attributes across dashboard and admin views.
**Action:** Added contextually accurate `aria-label` attributes to improve screen reader accessibility without changing visual styling.
