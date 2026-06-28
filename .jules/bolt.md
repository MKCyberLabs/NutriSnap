## 2024-07-25 - [O(n) Consolidation]
**Learning:** Replaced multiple O(n) `.reduce()` calls calculating total nutrients inside `handleUpdateItemGrams`, `handleAddItem`, and `handleDeleteItem` in `src/app/dashboard/page.tsx` with a single O(n) pass using a helper function `recalculateNutrients()`. This reduces the operations from O(7*n) to O(n).
**Action:** Always prefer consolidating multiple iterations over the same array into a single pass when computing multiple aggregates.
