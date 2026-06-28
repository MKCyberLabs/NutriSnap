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
