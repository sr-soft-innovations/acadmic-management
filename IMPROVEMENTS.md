# GP Pharmacy College ERP – Improvement Guide

Prioritized suggestions to improve security, reliability, maintainability, and UX.

---

## 1. Security (High priority)

### 1.1 Hash passwords (critical)

**Current:** Passwords are stored and compared in plain text in `users.json` and `auth.py`.

**Change:** Use bcrypt (or argon2) to hash passwords on create/update and verify on login.

- Add `passlib[bcrypt]` to `requirements.txt`.
- In `auth.py`: on first run or user create, hash password with `passlib.hash.bcrypt`; on login use `verify(password, stored_hash)`.
- Migrate existing users: either set a temporary password and force change, or run a one-time script to hash current plain-text passwords (only if you still have them; otherwise reset).

### 1.2 Protect API routes with auth

**Current:** Many endpoints (e.g. `/api/students`, `/api/exams`, `/api/results`) do not use `Depends(_get_current_user)`, so they are callable without login.

**Change:** Add `current: dict = Depends(_get_current_user)` to every route that should require login (students, staff, courses, attendance, fees, exams, results, approvals, etc.). Optionally use permission checks (e.g. `has_permission(current, "students:read")`) for sensitive operations.

### 1.3 Strong JWT secret in production

**Current:** `JWT_SECRET` defaults to `"change-me-in-production"` in `config.py`.

**Change:** In production, always set `JWT_SECRET` via environment to a long, random value (e.g. `openssl rand -hex 32`). Reject startup or use a safe default only in development.

### 1.4 Never expose password in API responses

**Current:** If user objects are returned (e.g. from `/api/auth/...` or user list), ensure the `password` field is never serialized. Check all endpoints that return user entities and strip or exclude `password`.

---

## 2. Backend robustness

### 2.1 Input validation and IDs

- Use Pydantic models for request bodies and path/query params where you don’t already (e.g. `semester`, `course` as optional strings with `max_length`).
- Validate IDs (e.g. numeric or UUID) before use; return 400/404 with clear messages instead of 500 on bad data.

### 2.2 Consistent error responses

- Use a common error shape, e.g. `{"detail": "message", "code": "ERROR_CODE"}`.
- Use appropriate HTTP status codes: 400 (validation), 403 (forbidden), 404 (not found), 409 (conflict), 422 (validation error).

### 2.3 Avoid storing duplicate / derived data without a single source of truth

- Example: marks may have both `subject` (text) and `subject_id`. Prefer `subject_id` as source of truth and resolve subject name from courses when needed, to avoid mismatches.

### 2.4 Database / file concurrency

- JSON file writes are not atomic. For higher concurrency, consider: single-writer pattern, file locking, or migrating hot paths to SQLite/PostgreSQL. At minimum, document that the app assumes low concurrency.

---

## 3. Frontend

### 3.1 Error boundary

- Add a React Error Boundary (e.g. `ErrorBoundary.js`) that catches render errors and shows a fallback UI and “Retry” instead of a blank screen. Wrap the main app or layout with it.

### 3.2 Loading and empty states

- Use a small loading component (spinner/skeleton) consistently instead of plain “Loading...” where it matters (e.g. Result & Analytics, Examinations).
- For empty lists/tables, show a clear message and, where relevant, a primary action (e.g. “Add first exam”, “Add student”).

### 3.3 Result & Analytics – filters and refresh

- In `ResultAnalytics.js`, when the user changes semester/course and then switches tab, the data can be stale until “Apply / Refresh” is clicked. Consider either:
  - Auto-refresh when filters change and the current tab uses them, or
  - Show a short hint like “Filters changed. Click Apply to refresh.”
- Optionally debounce filter-driven requests to avoid rapid repeated calls.

### 3.4 Accessibility and forms

- Give critical inputs proper `label` and `id` (or `aria-label`).
- Use `type="password"` for password fields; avoid logging or storing passwords in frontend state.

### 3.5 API base URL and env

- Document that `REACT_APP_API_URL` must be set for non-local deployments. Consider a runtime config or build-time check so the app fails fast if the API URL is missing in production.

---

## 4. Testing and reliability

### 4.1 Backend tests

- Add pytest (and `httpx.TestClient`) for FastAPI. Cover at least:
  - Auth: login success/failure, lockout, invalid token.
  - One or two critical flows (e.g. create student, enter marks, compute GPA).
- Run tests in CI (e.g. GitHub Actions) on push/PR.

### 4.2 Frontend tests

- Add a few React Testing Library tests for critical flows (e.g. login, one main list page, one form submit). This will catch regressions when refactoring.

### 4.3 Health and dependency checks

- Keep `/api/health` and optionally extend it to check that the data directory is writable (or DB is reachable). This helps with deployment and monitoring.

---

## 5. Operations and maintainability

### 5.1 Logging

- Use Python `logging` in the backend (you already use it in auth). Log at appropriate levels (e.g. INFO for login, WARNING for lockout, ERROR for unexpected exceptions). Avoid logging passwords or tokens.

### 5.2 Configuration

- Keep all secrets and environment-specific values in env (or a secure secret store). Document required env vars in a single place (e.g. `README.md` or `.env.example`).

### 5.3 Backup and data

- Document backup strategy for the `app/data` directory (and any uploaded files). Consider a simple script or cron job to copy/archive JSON and uploads.

---

## 6. Optional / later

- **Rate limiting:** Add per-IP or per-user rate limiting on auth and sensitive endpoints (e.g. with `slowapi` or reverse-proxy).
- **CORS:** Restrict `allow_origins` in production to your frontend origin(s) instead of `*` or localhost-only.
- **HTTPS:** Ensure production is served over HTTPS and that cookies/tokens are not sent over plain HTTP.
- **Result & Analytics:** Export to PDF/Excel for reports; optional caching for heavy aggregation endpoints.

---

## Quick wins (minimal effort)

1. Add `Depends(_get_current_user)` to students, exams, results, and other sensitive routers.
2. Set `JWT_SECRET` from env in production and document it.
3. Add a React Error Boundary and wrap the app.
4. Remove or never return `password` from any API response.
5. Add a short “Improvements” or “Security” section in the main README pointing to this file.

Implementing **1.1 (password hashing)** and **1.2 (protect routes)** will materially improve security with limited code change.
