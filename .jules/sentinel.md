## 2024-06-22 - Path Traversal Vulnerability in Uploads Route
**Vulnerability:** A critical Path Traversal vulnerability existed in `src/app/uploads/[filename]/route.ts`. The `filename` parameter was being directly appended to the `public/uploads` path without sanitization, allowing attackers to access arbitrary files on the system using `../` sequences.
**Learning:** Raw input parameters from Next.js route path variables are inherently untrusted and must be sanitized when interacting with the file system.
**Prevention:** Always use `path.basename()` to strip out directory paths when expecting just a filename from a user. Always apply a secondary check to verify that the absolute path returned by `path.join` explicitly starts with the intended directory using `path.startsWith()`.
