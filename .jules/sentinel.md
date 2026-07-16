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

## 2024-07-03 - [Server Action IDOR]
**Vulnerability:** Next.js Server Actions act as public endpoints and do not implicitly inherit secure client context. The Server Actions in `src/app/settings/actions.ts` and `src/app/hydration/actions.ts` were taking `userId` or resource IDs as arguments without verifying if the requested resource belonged to the currently authenticated user (via `nutrisnap_session_id` cookie). This allowed Insecure Direct Object Reference (IDOR) attacks, meaning a user could modify or view other users' settings, reminders, and hydration logs by manipulating the arguments.
**Learning:** Next.js Server Actions are public RPC endpoints, not secure server-only functions. Client-side authentication checks or routing do not protect server actions.
**Prevention:** Always implement explicit authorization checks (e.g., verifying a secure session cookie against the requested resource's owner) at the beginning of *every* exported Server Action. Do not trust arguments provided to a server action.

## 2024-07-04 - Stored XSS via SVG File Uploads
**Vulnerability:** A Stored XSS vulnerability existed in the file upload route (`src/app/api/upload/route.ts`) because `.svg` files were allowed. SVG files can contain embedded `<script>` tags, which execute when the file is served and viewed by a user, potentially compromising their session.
**Learning:** Permitting arbitrary SVG uploads on the same origin as the main application creates a severe Stored XSS risk. Validation must strictly whitelist safe raster image formats.
**Prevention:** Never include `.svg` in the allowed extensions list for user uploads without extremely robust, server-side SVG sanitization (which is difficult and error-prone). Only allow safe formats like `.jpg`, `.png`, `.webp`, or `.gif`.

## 2026-07-06 - Rate Limiting Bypass via Spoofed IP Header
**Vulnerability:** A critical vulnerability existed in `src/app/api/auth/login/route.ts` where the rate limiter's identifier was constructed using the highly spoofable `x-forwarded-for` header. This allowed an attacker to bypass rate limiting for a single account by changing their spoofed IP address, making the application susceptible to unlimited brute-force password guessing attacks.
**Learning:** Relying on easily spoofable HTTP headers like `x-forwarded-for` for rate limiting is insecure and can lead to bypasses, especially for critical endpoints like authentication.
**Prevention:** When rate limiting authentication endpoints, use reliable and non-spoofable identifiers, such as the target user's email address (normalized, e.g., using `toLowerCase()`), to ensure brute-force protection is enforced consistently against the account being targeted.

## 2026-07-12 - [Unauthenticated File Upload Vulnerability]
**Vulnerability:** An unauthenticated file upload vulnerability existed in `src/app/api/upload/route.ts`. The endpoint allowed anyone to upload files to the `public/uploads` directory without verifying if they were authenticated or authorized to do so.
**Learning:** Publicly accessible upload endpoints, even if intended for internal use, can be abused by attackers to store unauthorized content, potentially leading to storage exhaustion or hosting malicious files if not properly restricted.
**Prevention:** Always enforce authentication and authorization checks on all API endpoints that accept file uploads or modify system state. Validate the session token (e.g., `nutrisnap_session_id`) against the database before processing the request.

## 2026-07-20 - [Unauthenticated API Route Access]
**Vulnerability:** A critical vulnerability existed in `src/app/api/analyze-meal/route.ts` where the `POST` endpoint handled AI image processing logic without checking if the requester was authenticated. The endpoint exposed expensive and computationally heavy Genkit AI flows (`mealNutritionalAnalysis`) to unauthenticated users, leading to possible Denial-of-Service and bill exhaustion by malicious actors.
**Learning:** Next.js API Routes do not inherit the calling client's authorization context. Just because an API is only called from within the client's logged-in dashboard does not mean the API itself is secure from outside, direct access.
**Prevention:** Always explicitly check authentication state (e.g., verifying a valid `nutrisnap_session_id` session cookie against the database) at the very beginning of *every* API route handler before executing any sensitive logic or calling external/expensive services.

## 2024-08-01 - [Information Leakage via 500 Error Responses]
**Vulnerability:** A medium-priority information leakage vulnerability existed in `src/app/api/analyze-meal/route.ts` where internal server errors were passing the raw `error.message` detail directly to the client in the JSON response payload.
**Learning:** Exposing raw error strings from backend components (such as failed API requests, missing tokens, or trace exceptions) to the frontend can provide attackers with sensitive context about the internal environment or third-party service dependencies.
**Prevention:** Catch statements on API endpoints should log raw errors on the server side (`console.error`) but return non-descriptive, generic error strings (e.g., "Internal Server Error") to the client.
