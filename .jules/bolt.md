## 2025-02-18 - Avoid O(N*D) date parsing inside useMemo loops
**Learning:** In React components that render long lists with date intervals (e.g. `dynamicWeeklyData`), parsing raw date strings inside a filter loop over the entire logs array for each day in an interval causes an O(N * D) performance bottleneck. `parseISO` and `format` run hundreds or thousands of times unnecessarily on every render when date intervals change.
**Action:** Always group list objects by formatted date strings (e.g. `yyyy-MM-dd`) into a `Map` within a parent `useMemo` block first (costing O(N)), so child `useMemo` interval builders can retrieve logs for any specific day with an O(1) Map lookup.
## 2026-06-23 - Avoid page-wide keystroke re-renders in large components
**Learning:** When inputs inside deeply nested loops (like inline popovers inside `filteredLogs.map`) hold their text `useState` in the massive parent component (e.g., `DashboardPage`), every single keystroke triggers a full re-render of the entire page, including Recharts and Dialogs, leading to significant input lag and CPU spike.
**Action:** Always localize form control state (like `text` or `value` in inputs/popovers) into standalone child components (`EditGramsPopover`, `AddItemPopover`) instead of managing them at the root level of heavy pages.

## 2025-02-28 - [Memoizing Iterations of Render State]
**Learning:** Found multiple distinct `reduce` calls looping over the exact same dataset (`dynamicWeeklyData`) during each render and within hooks. Array functions inside render can be a hidden source of CPU overhead.
**Action:** Consolidate redundant aggregations using `useMemo` where variables sum up everything in a single loop `for (const day of dynamicWeeklyData)`. This reduces redundant work and provides cached values to use inside render and hooks.
## 2023-10-27 - [Anti-pattern] Redundant Array Reductions During Render
**Learning:** The dashboard component previously used multiple inline `.filter().reduce()` passes per meal category and multiple `.reduce()` passes per nutrient directly inside `useMemo` blocks and JSX. This leads to O(N*M) and O(N*K) iterations on every render or recalculation.
**Action:** Always consolidate multiple array reduction operations into a single O(N) iteration (e.g. using a single `for...of` loop or `.reduce()` with an object accumulator) instead of chaining multiple array methods.
## 2025-02-20 - [Prisma Performance]
**Learning:** Adding indexes to frequently filtered and sorted columns, especially foreign keys, drastically reduces sequence scanning in large database tables. `MealLog`s are filtered by `userId` and sorted by `createdAt` in desc order. `FoodItem`s are accessed via their `mealLogId`. `Reminder`s are fetched via `userId`.
**Action:** Use `@@index` in the `prisma/schema.prisma` model definitions to explicitly instruct the underlying DB to build these critical indexes.

## 2024-07-25 - [O(n) Consolidation]
**Learning:** Replaced multiple O(n) `.reduce()` calls calculating total nutrients inside `handleUpdateItemGrams`, `handleAddItem`, and `handleDeleteItem` in `src/app/dashboard/page.tsx` with a single O(n) pass using a helper function `recalculateNutrients()`. This reduces the operations from O(7*n) to O(n).
**Action:** Always prefer consolidating multiple iterations over the same array into a single pass when computing multiple aggregates.
## 2025-02-28 - [Minimize Rendering Allocations]
**Learning:** Extracting static arrays and values outside of React components prevents unnecessary runtime allocations on every re-render. Since `MealAnalysisTool.tsx` has a description input, any keystroke caused a re-render of 72 array elements.
**Action:** Lift purely static collections (like pre-computed lists for Dropdowns/Selects) outside the component when they don't depend on props or state.

## 2025-02-28 - [State Stability for Memoized Components]
**Learning:** Wrapping a complex component in `React.memo` is ineffective if its callback props are constantly recreated. In `DashboardPage`, `handleMealCardComplete` was un-memoized and depended on the `logs` state, causing it (and `MealCategoryCard`) to re-render on every log update. Furthermore, using inline arrow functions like `onAnalysisComplete={(data, ...) => handleMealCardComplete(...)}` destroys memoization.
**Action:** Use `useCallback` for functions passed to memoized components, avoid depending on arrays that change frequently by using functional state updates (e.g., `setLogs(prev => [...prev])`), and never pass inline arrow functions as props to memoized child components.
## 2025-02-28 - [Avoid Page-Wide Re-renders on Slider Drag]
**Learning:** When inputs inside heavy components (like a custom hydration slider in `HydrationPage`) hold their state (e.g. `customMl`) in the massive parent component, rapid events like dragging the slider (which triggers `onChange` hundreds of times) cause the entire page to re-render, including Recharts, Framer Motion elements, and complex SVG animations. This leads to significant input lag, CPU spikes, and a poor user experience.
**Action:** Always localize form control state (like slider values or text inputs) into standalone child components (e.g., `CustomDrinkDialog`) to isolate the state updates. Pass the finalized state back to the parent only on submit (`onSave`).

## 2025-02-28 - [Avoid invariant date computations inside loops]
**Learning:** Found `startOfDay(weekStart)` inside a `weeklyLogs.forEach` loop in `src/app/hydration/page.tsx`'s `weeklyStats` memoization block. Since `weekStart` is constant for the duration of the loop, parsing it inside causes redundant object allocations and redundant date math on every iteration. This leads to an O(N) performance cost where O(1) was possible.
**Action:** Hoist invariant computations (like standardising a boundary date) out of loop bodies. Calculate it once before iterating over lists, and reference the stored variable inside the loop.

## 2024-03-12 - [Avoid Inline Array Allocations for Metrics in JSX]
**Learning:** Using `Math.max(...array.map())` and `array.filter().length` directly in the JSX render function causes unnecessary O(N) memory allocations and redundant iterations on every re-render.
**Action:** Consolidate calculation of derived metrics (like peak values or conditional counts) into an existing parent `useMemo` block that already iterates over the array, calculating them in a single O(N) pass.

## 2025-02-28 - [Hoist Invariant Operations from Render Loops]
**Learning:** Found `.toLowerCase()` being called on the same `searchTerm` repeatedly inside an unmemoized `.filter()` over `managedUsers` on every render in `src/app/admin/page.tsx`. This causes redundant O(N) string allocations and performance degradation, especially during rapid state updates from user input (like typing in the search bar or in the create/edit forms).
**Action:** Always wrap derived list computations in `useMemo` and hoist invariant operations (like standardizing a search term string) out of loop bodies. Calculate them once and reference the stored variable inside the loop to avoid O(N) overhead when O(1) is possible.
