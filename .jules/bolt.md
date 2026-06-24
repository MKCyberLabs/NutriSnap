## 2025-02-18 - Avoid O(N*D) date parsing inside useMemo loops
**Learning:** In React components that render long lists with date intervals (e.g. `dynamicWeeklyData`), parsing raw date strings inside a filter loop over the entire logs array for each day in an interval causes an O(N * D) performance bottleneck. `parseISO` and `format` run hundreds or thousands of times unnecessarily on every render when date intervals change.
**Action:** Always group list objects by formatted date strings (e.g. `yyyy-MM-dd`) into a `Map` within a parent `useMemo` block first (costing O(N)), so child `useMemo` interval builders can retrieve logs for any specific day with an O(1) Map lookup.
## 2025-02-28 - [Memoizing Iterations of Render State]
**Learning:** Found multiple distinct `reduce` calls looping over the exact same dataset (`dynamicWeeklyData`) during each render and within hooks. Array functions inside render can be a hidden source of CPU overhead.
**Action:** Consolidate redundant aggregations using `useMemo` where variables sum up everything in a single loop `for (const day of dynamicWeeklyData)`. This reduces redundant work and provides cached values to use inside render and hooks.
