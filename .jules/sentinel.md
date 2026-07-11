## 2024-06-22 - Path Traversal Vulnerability in Uploads Route
**Vulnerability:** A critical Path Traversal vulnerability existed in `src/app/uploads/[filename]/route.ts`. The `filename` parameter was being directly appended to the `public/uploads` path without sanitization, allowing attackers to access arbitrary files on the system using `../` sequences.
**Learning:** Raw input parameters from Next.js route path variables are inherently untrusted and must be sanitized when interacting with the file system.
**Prevention:** Always use `path.basename()` to strip out directory paths when expecting just a filename from a user. Always apply a secondary check to verify that the absolute path returned by `path.join` explicitly starts with the intended directory using `path.startsWith()`.

## 2024-06-23 - Pass-the-Hash and Password Hash Leak via Server Actions
**Vulnerability:** A critical authentication bypass vulnerability existed in `src/ai/actions/db-users.ts` where users could authenticate using a known bcrypt hash instead of a password (`if (user.password === password)`). Furthermore, server actions fetching users (`fetchAllUsers`, `createDbUser`, `updateDbUser`, `authenticateDbUser`) were directly returning database records including the hashed passwords, leaking them to the client. A universal backdoor `ADMIN_RECOVERY_KEY` also existed in the login route allowing authentication to any account.
**Learning:** Returning full database objects from Server Actions implicitly exposes all properties to the frontend, leading to sensitive data leaks like password hashes. Hardcoded recovery keys or bypass conditions in authentication logic create severe backdoors.
**Prevention:** Always omit sensitive fields (like `password`) from objects returned from Server Actions or API routes. Never implement hardcoded "recovery keys" or master passwords that bypass standard authentication mechanisms. Ensure password verification strictly relies on comparing the plaintext input to the hashed database record using secure methods like `bcrypt.compare`.

## 2023-10-27 - [Hardcoded Admin Initial Password]
**Vulnerability:** A hardcoded initial admin password (`ProductionPassword123!`) was hardcoded as a fallback in user creation flows and default mock state, as well as passed-through to the UI input placeholders.
**Learning:** Hardcoded fallback values for secrets completely undermine the secure initialization mechanism of `process.env.ADMIN_INITIAL_PASSWORD`.
**Prevention:** Remove fallback secrets in code. If an initial password is required, fail fast or securely pull from environment configurations exclusively.

## 2023-10-27 - [Authentication Bypass via Pass-the-Hash]
**Vulnerability:** The authentication function allowed a user to authenticate if the provided password string exactly matched the stored database hash (`if (user.password === password) { return user; }`).
**Learning:** This debugging/prototype shortcut allowed an attacker who obtained the database dump to authenticate as any user without needing to crack their password.
**Prevention:** Strictly enforce hashing functions (e.g. `bcrypt.compare`) for all credential verification. Remove any prototype plaintext fallback mechanisms before production.

## 2023-10-27 - [LLM SQL Injection via Genkit Tool]
**Vulnerability:** A Genkit tool (`queryDatabase`) designed for the LLM to fetch database records allowed raw SQL strings to be constructed by the LLM and executed via `prisma.$queryRawUnsafe`. The only validation was checking if the string started with "SELECT". This allowed trivial SQL injection (e.g., prompt injection) to extract other users' sensitive data.
**Learning:** LLMs cannot be trusted to generate safe raw SQL queries on the fly, and string validation on LLM output is a weak defense. Providing an LLM direct SQL execution access is inherently dangerous.
**Prevention:** Remove arbitrary SQL execution tools for LLMs. Instead, fetch the required contextual data securely via parameterized ORM queries *before* passing the context to the LLM prompt.
## 2024-06-23 - Pass-the-Hash and Password Hash Leak via Server Actions (Addendum)
**Vulnerability:** A critical vulnerability existed in `src/ai/actions/db-admin.ts` and `src/ai/actions/db-users.ts` where server actions (`fetchAllUsers`, `createDbUser`, `updateDbUser`, `authenticateDbUser`) were returning full database user objects containing hashed passwords directly to the frontend.
**Learning:** Returning full database objects from Next.js Server Actions implicitly exposes all properties to the client, leading to sensitive data leaks like password hashes.
**Prevention:** Always omit sensitive fields (like `password`) from objects returned from Server Actions or API routes by explicitly picking non-sensitive fields or destructuring out the sensitive ones.

## 2024-05-24 - [IDOR in Next.js Server Actions]
**Vulnerability:** Next.js Server Actions modifying user data and logs (in `db-users.ts` and `db-logs.ts`) took generic arguments like `userId` or `logId` directly from the client without verifying if the caller owned those records. This allowed IDOR (Insecure Direct Object Reference) / Authorization Bypass where any user could modify another's data.
**Learning:** Next.js Server Actions are essentially public API endpoints. Just because they are defined on the server and called seamlessly from the client does not mean they inherit the client's context or permissions securely by default.
**Prevention:** Always extract authentication state (e.g., via cookies) *inside* the Server Action and authorize the action by validating that the authenticated user owns the resource they are trying to manipulate, rather than trusting IDs passed as arguments.

## 2026-07-11 - Unauthenticated File Upload in Upload API
**Vulnerability:** The `/api/upload` endpoint lacked any authentication checks, allowing anonymous users to upload arbitrary files to the server, potentially leading to storage exhaustion or hosting of malicious content.
**Learning:** Next.js API routes act as public endpoints by default. They do not implicitly inherit any authentication context from the client application.
**Prevention:** Always implement explicit authentication and authorization checks (e.g., verifying session cookies against the database) on any API route or Server Action that performs sensitive operations like file uploads or database modifications.
