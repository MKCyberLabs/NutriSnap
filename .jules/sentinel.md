## 2023-10-27 - [Hardcoded Admin Initial Password]
**Vulnerability:** A hardcoded initial admin password (`ProductionPassword123!`) was hardcoded as a fallback in user creation flows and default mock state, as well as passed-through to the UI input placeholders.
**Learning:** Hardcoded fallback values for secrets completely undermine the secure initialization mechanism of `process.env.ADMIN_INITIAL_PASSWORD`.
**Prevention:** Remove fallback secrets in code. If an initial password is required, fail fast or securely pull from environment configurations exclusively.

## 2023-10-27 - [Authentication Bypass via Pass-the-Hash]
**Vulnerability:** The authentication function allowed a user to authenticate if the provided password string exactly matched the stored database hash (`if (user.password === password) { return user; }`).
**Learning:** This debugging/prototype shortcut allowed an attacker who obtained the database dump to authenticate as any user without needing to crack their password.
**Prevention:** Strictly enforce hashing functions (e.g. `bcrypt.compare`) for all credential verification. Remove any prototype plaintext fallback mechanisms before production.
