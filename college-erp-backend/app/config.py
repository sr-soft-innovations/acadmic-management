"""Security and auth configuration."""
import os

# Password policy
PASSWORD_MIN_LENGTH = int(os.environ.get("PASSWORD_MIN_LENGTH", "8"))
PASSWORD_REQUIRE_UPPER = os.environ.get("PASSWORD_REQUIRE_UPPER", "true").lower() == "true"
PASSWORD_REQUIRE_LOWER = os.environ.get("PASSWORD_REQUIRE_LOWER", "true").lower() == "true"
PASSWORD_REQUIRE_DIGIT = os.environ.get("PASSWORD_REQUIRE_DIGIT", "true").lower() == "true"
PASSWORD_REQUIRE_SPECIAL = os.environ.get("PASSWORD_REQUIRE_SPECIAL", "true").lower() == "true"
PASSWORD_MAX_AGE_DAYS = int(os.environ.get("PASSWORD_MAX_AGE_DAYS", "90"))  # 0 = disabled
PASSWORD_HISTORY_COUNT = int(os.environ.get("PASSWORD_HISTORY_COUNT", "3"))  # Prevent reuse of last N

# Account lock
MAX_FAILED_ATTEMPTS = int(os.environ.get("MAX_FAILED_ATTEMPTS", "5"))
LOCK_DURATION_MINUTES = int(os.environ.get("LOCK_DURATION_MINUTES", "30"))

# Session
SESSION_TIMEOUT_MINUTES = int(os.environ.get("SESSION_TIMEOUT_MINUTES", "15"))
SESSION_TIMEOUT_REMEMBER_ME_DAYS = int(os.environ.get("SESSION_TIMEOUT_REMEMBER_ME_DAYS", "7"))  # when remember_me
MAX_SESSIONS_PER_USER = int(os.environ.get("MAX_SESSIONS_PER_USER", "5"))
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"

# CAPTCHA (Google reCAPTCHA v2/v3) - optional
RECAPTCHA_SECRET_KEY = os.environ.get("RECAPTCHA_SECRET_KEY", "")

# OTP
OTP_EXPIRE_MINUTES = int(os.environ.get("OTP_EXPIRE_MINUTES", "10"))
OTP_LENGTH = 6

# Rate limiting (login brute-force protection)
LOGIN_RATE_LIMIT_PER_IP = int(os.environ.get("LOGIN_RATE_LIMIT_PER_IP", "10"))  # max attempts per window
LOGIN_RATE_LIMIT_WINDOW_SEC = int(os.environ.get("LOGIN_RATE_LIMIT_WINDOW_SEC", "300"))  # 5 min window

# CORS (comma-separated origins; empty = use defaults)
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
CORS_ORIGINS_LIST = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()] if CORS_ORIGINS else []

# Security headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}