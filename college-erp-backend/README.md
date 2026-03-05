# College ERP Backend

REST API with FastAPI and JSON file storage.

## Setup

```bash
cd college-erp-backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Then:
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs

## Default login

- **Username:** admin  
- **Password:** admin123  
- **Email (for OTP):** admin@example.com — OTP code is logged in the terminal when you request OTP.

## Security features

- **Password policy:** Min length, upper/lower/digit/special (see `app/config.py` or env `PASSWORD_MIN_LENGTH`, etc.).
- **Account lock:** After 5 failed attempts (configurable), account locks for 15 minutes.
- **Sessions:** JWT with 30‑min expiry; multi-device sessions stored in `app/data/sessions.json`; max 5 per user.
- **Audit logs:** Login/logout and failures logged to `app/data/audit` (append-only).
- **CAPTCHA:** Set `RECAPTCHA_SECRET_KEY` to enable Google reCAPTCHA on login; otherwise CAPTCHA is skipped.
- **OTP login:** Request OTP by email/phone; user must have `email` or `phone` in `users.json`. OTP is logged in terminal for demo.
- **Role & permission matrix:** `app/permissions.py` defines permissions per role; `/api/auth/permissions` returns the matrix.
