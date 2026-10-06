# NutriSnap v0.1 — Open Questions

Status: **No unresolved questions at Herdr planning freeze**

Question prefix: `NSV01-Q###`

Use this file only for real ambiguity/blockers that could materially affect persisted data, accounting, recurrence, authorization, existing Health behavior, Telegram behavior, production safety, or v0.1 scope.

Do not use it for ordinary implementation bugs that have a clear expected result from the frozen specifications.

## Protocol

For a new blocker, add the next sequential section:

```text
## NSV01-Q001 — <short title>

Date/time:
Phase:
Status: OPEN

Question:
<exact ambiguity>

Expected behavior from current specification:
<what the frozen source appears to require>

Actual observation:
<what happened>

Evidence:
- command/output
- file/function
- test ID
- relevant SHA

Safety state:
- production affected: YES/NO
- dev data at risk: YES/NO
- unrelated work can continue: YES/NO

Safe options:
1. ...
2. ...

Do not choose silently.
```

Then:

1. preserve relevant evidence;
2. run `git diff --check`;
3. commit the question/evidence;
4. push normally to `feature/v0.1-health-wealth`;
5. verify remote SHA;
6. stop only the affected path;
7. report:

```text
BLOCKED — ASK CHATGPT
Question ID: NSV01-Q###
Remote commit: <full SHA>
```

The owner can then ask ChatGPT: `Resolve NSV01-Q### from the NutriSnap repo.`

## Resolved questions

When resolved, do not delete the entry. Add:

```text
Status: RESOLVED
Decision:
Rationale:
Resolved by:
Resolution commit:
```

This preserves the design/audit trail.
