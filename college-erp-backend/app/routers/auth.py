"""Auth: login (password + OTP), account lock, sessions, password policy, CAPTCHA. No JWT. User & profile management."""
import logging
import os
import re
import secrets
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import httpx

try:
    import bcrypt
    _bcrypt_ok = True
except Exception:
    _bcrypt_ok = False

from app.config import (
    PASSWORD_MIN_LENGTH,
    PASSWORD_REQUIRE_UPPER,
    PASSWORD_REQUIRE_LOWER,
    PASSWORD_REQUIRE_DIGIT,
    PASSWORD_REQUIRE_SPECIAL,
    PASSWORD_MAX_AGE_DAYS,
    PASSWORD_HISTORY_COUNT,
    MAX_FAILED_ATTEMPTS,
    LOCK_DURATION_MINUTES,
    SESSION_TIMEOUT_MINUTES,
    SESSION_TIMEOUT_REMEMBER_ME_DAYS,
    MAX_SESSIONS_PER_USER,
    RECAPTCHA_SECRET_KEY,
    OTP_EXPIRE_MINUTES,
    OTP_LENGTH,
    LOGIN_RATE_LIMIT_PER_IP,
    LOGIN_RATE_LIMIT_WINDOW_SEC,
)
from app.db import read_json, write_json, append_audit, next_id
from app.permissions import has_permission, get_permissions_matrix

router = APIRouter()

# User profile photos (app/data/user_photos)
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "data" / "user_photos"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

DEFAULT_USERS = [
    {"id": "1", "username": "admin", "password": "admin123", "role": "super_admin", "name": "Super Admin", "email": "admin@example.com"},
]


def _hash_password(plain: str) -> str:
    """Hash password with bcrypt (max 72 bytes). Falls back to no-op if bcrypt unavailable."""
    if not _bcrypt_ok:
        return plain  # no hashing if bcrypt not available
    raw = (plain or "").encode("utf-8")[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, stored: str) -> bool:
    if not stored or not plain:
        return False
    # Bcrypt hash: $2a$... or $2b$...
    if stored.startswith("$2") and "$" in stored[3:]:
        if not _bcrypt_ok:
            return plain == stored
        try:
            raw = (plain or "").encode("utf-8")[:72]
            return bcrypt.checkpw(raw, stored.encode("utf-8"))
        except Exception:
            return False
    return plain == stored


def _ensure_users():
    users = read_json("users")
    if not users:
        for u in DEFAULT_USERS:
            u["failed_attempts"] = 0
            u["locked_until"] = None
            u["password"] = _hash_password(u["password"])
            u["phone"] = u.get("phone") or ""
            u["photo_filename"] = u.get("photo_filename") or ""
            u["is_enabled"] = u.get("is_enabled", True)
        write_json("users", DEFAULT_USERS)
        return DEFAULT_USERS
    for u in users:
        if "failed_attempts" not in u:
            u["failed_attempts"] = 0
        if "locked_until" not in u:
            u["locked_until"] = None
        if "phone" not in u:
            u["phone"] = ""
        if "photo_filename" not in u:
            u["photo_filename"] = ""
        if "is_enabled" not in u:
            u["is_enabled"] = True
        if "password_changed_at" not in u:
            u["password_changed_at"] = None
        if "password_history" not in u:
            u["password_history"] = []
    return users


def _user_to_response(u: dict) -> dict:
    """Return user dict safe for API (no password)."""
    locked_until = u.get("locked_until")
    now = datetime.now(timezone.utc)
    is_locked = False
    if locked_until:
        try:
            until = datetime.fromisoformat(str(locked_until).replace("Z", "+00:00"))
            is_locked = until > now
        except (ValueError, TypeError):
            pass
    out = {
        "id": u.get("id"),
        "username": u.get("username"),
        "role": u.get("role"),
        "name": u.get("name"),
        "email": u.get("email", ""),
        "phone": u.get("phone", ""),
        "photo_filename": u.get("photo_filename", ""),
        "is_enabled": u.get("is_enabled", True),
        "is_locked": is_locked,
        "failed_attempts": u.get("failed_attempts", 0),
    }
    if u.get("department"):
        out["department"] = u.get("department")
    if u.get("linked_student_id"):
        out["linked_student_id"] = u.get("linked_student_id")
    return out


def _audit(action: str, user_id: str | None, resource: str, details: dict | None = None, request: Request | None = None):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "user_id": user_id,
        "resource": resource,
        "details": details or {},
    }
    if request:
        entry["ip"] = request.client.host if request.client else None
    append_audit(entry)


def _validate_password_policy(password: str) -> list[str]:
    errors = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")
    if PASSWORD_REQUIRE_UPPER and not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if PASSWORD_REQUIRE_LOWER and not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if PASSWORD_REQUIRE_DIGIT and not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")
    if PASSWORD_REQUIRE_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        errors.append("Password must contain at least one special character.")
    return errors


def _verify_captcha(token: str | None) -> bool:
    if not RECAPTCHA_SECRET_KEY:
        return True
    if not token:
        return False
    try:
        r = httpx.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": RECAPTCHA_SECRET_KEY, "response": token},
            timeout=5.0,
        )
        data = r.json()
        return data.get("success") is True
    except Exception:
        return False


def _raise_unauthorized(detail: str = "Authentication required."):
    """Raise 401 when no valid session."""
    raise HTTPException(status_code=401, detail=detail)


# --- Request/Response models ---
class LoginBody(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1, max_length=256)
    role: str = Field(default="staff", max_length=64)
    remember_me: bool = False
    captcha_token: str | None = Field(default=None, max_length=2000)
    device_id: str | None = Field(default=None, max_length=256)
    device_info: str | None = Field(default=None, max_length=512)


class RequestOtpBody(BaseModel):
    email: str | None = None
    phone: str | None = None


class VerifyOtpBody(BaseModel):
    email: str | None = None
    phone: str | None = None
    code: str
    role: str = "staff"
    device_id: str | None = None
    device_info: str | None = None


class UpdateUserBody(BaseModel):
    """Update user profile; password is hashed before storing. All fields optional."""
    username: str | None = None
    password: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str | None = None
    is_enabled: bool | None = None


class CreateUserBody(BaseModel):
    """Admin create user. Username or name required. Password optional (auto-generated)."""
    username: str | None = Field(default=None, max_length=128)
    password: str | None = Field(default=None, max_length=256)
    name: str = Field(default="", max_length=256)
    email: str = Field(default="", max_length=256)
    phone: str = Field(default="", max_length=32)
    role: str = Field(default="staff", max_length=64)


class UpdateProfileBody(BaseModel):
    """Current user update own profile (name, email, phone only)."""
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class ChangePasswordBody(BaseModel):
    """Change own password."""
    current_password: str
    new_password: str


class EnableUserBody(BaseModel):
    """Enable or disable user."""
    enabled: bool


class ResetPasswordBody(BaseModel):
    """Forgot password: verify OTP and set new password."""
    email: str | None = None
    phone: str | None = None
    code: str
    new_password: str


class CopyUserBody(BaseModel):
    """Copy user: new username required, optional password."""
    new_username: str
    password: str | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None


# --- Password policy (no auth) ---
@router.get("/password-policy")
def get_password_policy():
    return {
        "min_length": PASSWORD_MIN_LENGTH,
        "require_upper": PASSWORD_REQUIRE_UPPER,
        "require_lower": PASSWORD_REQUIRE_LOWER,
        "require_digit": PASSWORD_REQUIRE_DIGIT,
        "require_special": PASSWORD_REQUIRE_SPECIAL,
        "max_age_days": PASSWORD_MAX_AGE_DAYS if PASSWORD_MAX_AGE_DAYS > 0 else None,
    }


# --- Rate limiting (in-memory; use Redis in production) ---
_login_attempts: dict[str, list[float]] = {}  # ip -> [timestamps]
_otp_attempts: dict[str, list[float]] = {}  # ip -> [timestamps]
OTP_RATE_LIMIT_PER_IP = 5
OTP_RATE_LIMIT_WINDOW_SEC = 300


def _check_login_rate_limit(ip: str) -> None:
    """Raise HTTPException 429 if IP exceeded login attempts in window."""
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - LOGIN_RATE_LIMIT_WINDOW_SEC
    if ip not in _login_attempts:
        _login_attempts[ip] = []
    # Prune old entries
    _login_attempts[ip] = [t for t in _login_attempts[ip] if t > cutoff]
    if len(_login_attempts[ip]) >= LOGIN_RATE_LIMIT_PER_IP:
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts. Try again in {LOGIN_RATE_LIMIT_WINDOW_SEC // 60} minutes.",
        )
    _login_attempts[ip].append(now)


def _check_otp_rate_limit(ip: str) -> None:
    """Raise HTTPException 429 if IP exceeded OTP/reset attempts in window."""
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - OTP_RATE_LIMIT_WINDOW_SEC
    if ip not in _otp_attempts:
        _otp_attempts[ip] = []
    _otp_attempts[ip] = [t for t in _otp_attempts[ip] if t > cutoff]
    if len(_otp_attempts[ip]) >= OTP_RATE_LIMIT_PER_IP:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Try again in {OTP_RATE_LIMIT_WINDOW_SEC // 60} minutes.",
        )
    _otp_attempts[ip].append(now)


# --- Login (password) ---
@router.post("/login")
async def login(body: LoginBody, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _check_login_rate_limit(client_ip)
    if not _verify_captcha(body.captcha_token):
        _audit("login_failed", None, "auth", {"reason": "captcha_failed"}, request)
        raise HTTPException(status_code=400, detail="CAPTCHA verification failed.")
    users = _ensure_users()
    username = (body.username or "").strip().lower()
    user = next((u for u in users if (u.get("username") or "").strip().lower() == username), None)
    if not user:
        _record_failed_and_maybe_lock(users, None, request)
        raise HTTPException(status_code=401, detail="Invalid username or password. Use admin / admin123 for default.")
    if not user.get("is_enabled", True):
        _audit("login_disabled", user.get("id"), "auth", {}, request)
        raise HTTPException(status_code=403, detail="Account is disabled. Contact administrator.")
    locked_until = user.get("locked_until")
    if locked_until:
        try:
            until = datetime.fromisoformat(locked_until.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) < until:
                _audit("login_locked", user.get("id"), "auth", {"locked_until": locked_until}, request)
                raise HTTPException(status_code=423, detail=f"Account locked. Try again after {LOCK_DURATION_MINUTES} minutes.")
        except (ValueError, TypeError):
            pass
        user["locked_until"] = None
        user["failed_attempts"] = 0
    stored_pw = user.get("password") or ""
    if not _verify_password(body.password or "", stored_pw):
        _record_failed_and_maybe_lock(users, user, request)
        raise HTTPException(status_code=401, detail="Invalid username or password. Use admin / admin123 for default.")
    idx = next((i for i, u in enumerate(users) if u.get("id") == user.get("id")), None)
    if idx is not None:
        users[idx]["failed_attempts"] = 0
        users[idx]["locked_until"] = None
        # Migrate plain-text password to hash on first successful login
        if stored_pw and not (stored_pw.startswith("$2") and "$" in stored_pw[3:]):
            users[idx]["password"] = _hash_password(body.password)
            users[idx]["password_changed_at"] = datetime.now(timezone.utc).isoformat()
        # Check password expiry (optional)
        if PASSWORD_MAX_AGE_DAYS > 0:
            changed_at = users[idx].get("password_changed_at")
            if changed_at:
                try:
                    dt = datetime.fromisoformat(changed_at.replace("Z", "+00:00"))
                    if (datetime.now(timezone.utc) - dt).days >= PASSWORD_MAX_AGE_DAYS:
                        _audit("login_password_expired", user.get("id"), "auth", {}, request)
                        raise HTTPException(
                            status_code=403,
                            detail=f"Password expired. Please change your password in Profile.",
                        )
                except HTTPException:
                    raise
                except (ValueError, TypeError):
                    pass
        write_json("users", users)
    user_id = str(user.get("id") or "")
    expires_min = SESSION_TIMEOUT_REMEMBER_ME_DAYS * 24 * 60 if body.remember_me else SESSION_TIMEOUT_MINUTES
    session_id = _add_session(user_id, body.device_id, body.device_info, expires_min)
    _audit("login", user_id, "auth", {"session_id": session_id, "remember_me": body.remember_me}, request)
    return {
        "user": {
            "id": user_id,
            "username": str(user.get("username") or ""),
            "role": str(user.get("role") or "staff").strip() or "staff",
            "name": str(user.get("name") or user.get("username") or ""),
        },
        "access_token": None,
        "token_type": "bearer",
        "expires_in_minutes": expires_min,
        "session_id": session_id,
    }


def _record_failed_and_maybe_lock(users: list, user: dict | None, request: Request):
    if not user:
        _audit("login_failed", None, "auth", {"reason": "unknown_user"}, request)
        return
    idx = next((i for i, u in enumerate(users) if u.get("id") == user.get("id")), None)
    if idx is None:
        return
    users[idx]["failed_attempts"] = (users[idx].get("failed_attempts") or 0) + 1
    if users[idx]["failed_attempts"] >= MAX_FAILED_ATTEMPTS:
        until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_DURATION_MINUTES)
        users[idx]["locked_until"] = until.isoformat()
    write_json("users", users)
    _audit("login_failed", user.get("id"), "auth", {"failed_attempts": users[idx].get("failed_attempts")}, request)


def _add_session(user_id: str, device_id: str | None, device_info: str | None, expires_minutes: int | None = None) -> str:
    sessions = read_json("sessions")
    uid = str(user_id or "")
    user_sessions = [s for s in sessions if str(s.get("user_id") or "") == uid]
    while len(user_sessions) >= MAX_SESSIONS_PER_USER and user_sessions:
        oldest = min(user_sessions, key=lambda s: s.get("created_at", ""))
        sessions = [s for s in sessions if s.get("id") != oldest.get("id")]
        user_sessions = [s for s in sessions if str(s.get("user_id") or "") == uid]
    session_id = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc)
    exp_min = expires_minutes if expires_minutes is not None else SESSION_TIMEOUT_MINUTES
    expires_at = (now + timedelta(minutes=exp_min)).isoformat()
    sessions.append({
        "id": session_id,
        "user_id": uid,
        "device_id": device_id or "",
        "device_info": device_info or "",
        "created_at": now.isoformat(),
        "expires_at": expires_at,
    })
    write_json("sessions", sessions)
    return session_id


# --- OTP ---
def _get_otps():
    return read_json("otps")


def _save_otps(otps: list):
    write_json("otps", otps)


@router.post("/request-otp")
async def request_otp(body: RequestOtpBody, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _check_otp_rate_limit(client_ip)
    email = (body.email or "").strip()
    phone = (body.phone or "").strip()
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Provide email or phone.")
    users = _ensure_users()
    user = None
    if email:
        user = next((u for u in users if (u.get("email") or "").strip().lower() == email.lower()), None)
    if not user and phone:
        user = next((u for u in users if (u.get("phone") or "").strip() == phone), None)
    if not user:
        _audit("otp_request_failed", None, "auth", {"reason": "user_not_found"}, request)
        raise HTTPException(status_code=404, detail="No user found with this email or phone.")
    code = "".join(secrets.choice("0123456789") for _ in range(OTP_LENGTH))
    expires = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)
    otps = _get_otps()
    otps = [o for o in otps if o.get("user_id") != user.get("id")]
    otps.append({
        "user_id": user["id"],
        "email": email or None,
        "phone": phone or None,
        "code": code,
        "expires_at": expires.isoformat(),
    })
    _save_otps(otps)
    # In dev only: log OTP (disable in production via LOG_OTP_DEV env)
    if os.environ.get("LOG_OTP_DEV", "").lower() in ("1", "true", "yes"):
        logging.getLogger("app.auth").warning("OTP for %s: %s", email or phone, code)
    _audit("otp_sent", user["id"], "auth", {"target": email or phone}, request)
    return {"message": "OTP sent to your email/phone.", "expires_in_minutes": OTP_EXPIRE_MINUTES}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOtpBody, request: Request):
    email = (body.email or "").strip()
    phone = (body.phone or "").strip()
    code = (body.code or "").strip()
    if not code or (not email and not phone):
        raise HTTPException(status_code=400, detail="Provide email or phone and OTP code.")
    otps = _get_otps()
    now = datetime.now(timezone.utc)
    for o in otps:
        if (email and o.get("email") == email) or (phone and o.get("phone") == phone):
            try:
                exp = datetime.fromisoformat((o.get("expires_at") or "").replace("Z", "+00:00"))
            except (ValueError, TypeError):
                exp = now
            if exp < now:
                continue
            if o.get("code") == code:
                users = _ensure_users()
                user = next((u for u in users if u.get("id") == o.get("user_id")), None)
                if not user:
                    break
                if not user.get("is_enabled", True):
                    _audit("login_disabled", user.get("id"), "auth", {}, request)
                    raise HTTPException(status_code=403, detail="Account is disabled. Contact administrator.")
                otps = [x for x in otps if not (x.get("user_id") == user.get("id") and x.get("code") == code and (x.get("email") == email or x.get("phone") == phone))]
                _save_otps(otps)
                uid = str(user.get("id") or "")
                session_id = _add_session(uid, body.device_id, body.device_info, SESSION_TIMEOUT_MINUTES)
                _audit("login_otp", uid, "auth", {"session_id": session_id}, request)
                return {
                    "user": {
                        "id": uid,
                        "username": str(user.get("username") or ""),
                        "role": str(user.get("role") or "staff").strip() or "staff",
                        "name": str(user.get("name") or user.get("username") or ""),
                    },
                    "access_token": None,
                    "token_type": "bearer",
                    "expires_in_minutes": SESSION_TIMEOUT_MINUTES,
                    "session_id": session_id,
                }
            break
    _audit("otp_verify_failed", None, "auth", {"reason": "invalid_or_expired"}, request)
    raise HTTPException(status_code=401, detail="Invalid or expired OTP.")


# --- Forgot password: request OTP (use /request-otp), then reset-password ---
@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, request: Request):
    """Verify OTP and set new password. Use /request-otp first with email or phone."""
    client_ip = request.client.host if request.client else "unknown"
    _check_otp_rate_limit(client_ip)
    email = (body.email or "").strip()
    phone = (body.phone or "").strip()
    code = (body.code or "").strip()
    new_password = (body.new_password or "").strip()
    if not code or (not email and not phone):
        raise HTTPException(status_code=400, detail="Provide email or phone and OTP code.")
    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required.")
    errors = _validate_password_policy(new_password)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    otps = _get_otps()
    now = datetime.now(timezone.utc)
    for o in otps:
        if (email and o.get("email") == email) or (phone and o.get("phone") == phone):
            try:
                exp = datetime.fromisoformat((o.get("expires_at") or "").replace("Z", "+00:00"))
            except (ValueError, TypeError):
                exp = now
            if exp < now:
                continue
            if o.get("code") == code:
                users = _ensure_users()
                user = next((u for u in users if u.get("id") == o.get("user_id")), None)
                if not user:
                    break
                idx = next((i for i, u in enumerate(users) if u.get("id") == user.get("id")), None)
                if idx is not None:
                    old_hash = users[idx].get("password")
                    users[idx]["password"] = _hash_password(new_password)
                    users[idx]["password_changed_at"] = now.isoformat()
                    users[idx]["failed_attempts"] = 0
                    users[idx]["locked_until"] = None
                    if old_hash:
                        hist = users[idx].get("password_history") or []
                        users[idx]["password_history"] = [old_hash] + hist[: PASSWORD_HISTORY_COUNT - 1]
                    write_json("users", users)
                otps = [x for x in otps if not (x.get("user_id") == user.get("id") and x.get("code") == code and (x.get("email") == email or x.get("phone") == phone))]
                _save_otps(otps)
                _audit("password_reset", user.get("id"), "auth", {"via": "otp"}, request)
                return {"message": "Password reset successfully. You can now sign in."}
            break
    _audit("password_reset_failed", None, "auth", {"reason": "invalid_or_expired"}, request)
    raise HTTPException(status_code=401, detail="Invalid or expired OTP.")


# --- Current user: resolve from X-Session-Id header ---
def _is_session_expired(session: dict) -> bool:
    """Check if session has expired. Migrate old sessions without expires_at."""
    now = datetime.now(timezone.utc)
    expires_at = session.get("expires_at")
    if expires_at:
        try:
            until = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            return now >= until
        except (ValueError, TypeError):
            pass
    # Legacy: no expires_at - use created_at + SESSION_TIMEOUT_MINUTES
    created = session.get("created_at")
    if created:
        try:
            created_dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
            return (now - created_dt).total_seconds() >= SESSION_TIMEOUT_MINUTES * 60
        except (ValueError, TypeError):
            pass
    return False


async def _get_current_user(request: Request):
    """Resolve user from session (X-Session-Id header). Supports impersonation via X-Impersonate-User-Id."""
    session_id = request.headers.get("X-Session-Id") or (request.cookies.get("session_id") if request.cookies else None)
    if not session_id:
        _raise_unauthorized("Session required. Please sign in.")
    sessions = read_json("sessions")
    session = next((s for s in sessions if s.get("id") == session_id), None)
    if not session:
        _raise_unauthorized("Invalid or expired session. Please sign in again.")
    if _is_session_expired(session):
        # Remove expired session
        sessions = [s for s in sessions if s.get("id") != session_id]
        write_json("sessions", sessions)
        _raise_unauthorized("Session expired. Please sign in again.")
    user_id = str(session.get("user_id") or "")
    users = _ensure_users()
    user = next((u for u in users if str(u.get("id")) == user_id), None)
    if not user:
        _raise_unauthorized("User not found.")
    if not user.get("is_enabled", True):
        raise HTTPException(status_code=403, detail="Account is disabled.")
    # Impersonation: if header set and current user has permission, return impersonated user
    imp_id = request.headers.get("X-Impersonate-User-Id")
    if imp_id and has_permission(user.get("role"), "users:impersonate"):
        imp_user = next((u for u in users if str(u.get("id")) == str(imp_id)), None)
        if imp_user and imp_user.get("is_enabled", True):
            return {
                "sub": imp_user.get("id"),
                "username": imp_user.get("username"),
                "role": imp_user.get("role"),
                "name": imp_user.get("name"),
                "impersonating": True,
                "real_sub": user_id,
            }
    return {"sub": user.get("id"), "username": user.get("username"), "role": user.get("role"), "name": user.get("name")}


@router.get("/sessions")
async def list_sessions(current: dict = Depends(_get_current_user)):
    user_id = current.get("sub")
    if not has_permission(current.get("role"), "sessions:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    sessions = read_json("sessions")
    user_sessions = [s for s in sessions if s.get("user_id") == user_id]
    return {"sessions": user_sessions}


@router.delete("/sessions/{session_id}")
async def revoke_session(session_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "sessions:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    sessions = read_json("sessions")
    sessions = [s for s in sessions if not (s.get("user_id") == current.get("sub") and s.get("id") == session_id)]
    write_json("sessions", sessions)
    return {"revoked": session_id}


# --- Logout (revoke current session if session_id provided) ---
class LogoutBody(BaseModel):
    session_id: str | None = None


@router.post("/logout")
async def logout(body: LogoutBody, request: Request):
    if body.session_id:
        sessions = read_json("sessions")
        sessions = [s for s in sessions if s.get("id") != body.session_id]
        write_json("sessions", sessions)
    _audit("logout", None, "auth", {"session_id": body.session_id}, request)
    return {"message": "Logged out."}


# --- Role & permission matrix (for frontend; from roles.json + fallback) ---
@router.get("/permissions")
def get_permissions(current: dict = Depends(_get_current_user)):
    """Return permission matrix. Requires authentication."""
    return {"matrix": get_permissions_matrix()}


# --- Current user profile (personal details, contact, photo) ---
@router.get("/me")
async def get_me(current: dict = Depends(_get_current_user)):
    """Get current user profile (no password)."""
    users = _ensure_users()
    user = next((u for u in users if str(u.get("id")) == str(current.get("sub"))), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return _user_to_response(user)


@router.put("/me")
async def update_me(body: UpdateProfileBody, current: dict = Depends(_get_current_user)):
    """Update own profile: name, email, phone."""
    users = _ensure_users()
    idx = next((i for i, u in enumerate(users) if str(u.get("id")) == str(current.get("sub"))), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found.")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        users[idx]["name"] = (data["name"] or "").strip() or users[idx].get("name", "")
    if "email" in data:
        users[idx]["email"] = (data["email"] or "").strip()
    if "phone" in data:
        users[idx]["phone"] = (data["phone"] or "").strip()
    write_json("users", users)
    return _user_to_response(users[idx])


def _check_password_reuse(new_plain: str, user: dict) -> bool:
    """Return True if new password was used recently (in password_history)."""
    if PASSWORD_HISTORY_COUNT <= 0:
        return False
    history = user.get("password_history") or []
    for old_hash in history[:PASSWORD_HISTORY_COUNT]:
        if old_hash and _verify_password(new_plain, old_hash):
            return True
    if user.get("password") and _verify_password(new_plain, user.get("password") or ""):
        return True
    return False


@router.post("/me/password")
async def change_my_password(body: ChangePasswordBody, request: Request, current: dict = Depends(_get_current_user)):
    """Change own password (requires current password). Prevents reuse of last N passwords."""
    users = _ensure_users()
    user = next((u for u in users if str(u.get("id")) == str(current.get("sub"))), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not _verify_password(body.current_password, user.get("password") or ""):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    errors = _validate_password_policy(body.new_password)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    if _check_password_reuse(body.new_password, user):
        raise HTTPException(status_code=400, detail="Cannot reuse a recent password. Choose a different one.")
    idx = next((i for i, u in enumerate(users) if str(u.get("id")) == str(user.get("id"))), None)
    if idx is not None:
        old_hash = users[idx].get("password")
        users[idx]["password"] = _hash_password(body.new_password)
        users[idx]["password_changed_at"] = datetime.now(timezone.utc).isoformat()
        if old_hash:
            hist = users[idx].get("password_history") or []
            users[idx]["password_history"] = [old_hash] + hist[: PASSWORD_HISTORY_COUNT - 1]
        write_json("users", users)
    _audit("password_changed", current.get("sub"), "auth", {}, request)
    return {"message": "Password updated."}


@router.get("/me/photo")
async def get_my_photo(current: dict = Depends(_get_current_user)):
    """Serve current user profile photo."""
    users = _ensure_users()
    user = next((u for u in users if str(u.get("id")) == str(current.get("sub"))), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    fn = user.get("photo_filename")
    if not fn:
        raise HTTPException(status_code=404, detail="No photo.")
    path = UPLOADS_DIR / fn
    if not path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found.")
    media = "image/jpeg"
    if path.suffix.lower() == ".png":
        media = "image/png"
    elif path.suffix.lower() == ".gif":
        media = "image/gif"
    elif path.suffix.lower() == ".webp":
        media = "image/webp"
    return FileResponse(path, media_type=media)


@router.post("/me/photo")
async def upload_my_photo(file: UploadFile = File(...), current: dict = Depends(_get_current_user)):
    """Upload profile photo for current user."""
    users = _ensure_users()
    idx = next((i for i, u in enumerate(users) if str(u.get("id")) == str(current.get("sub"))), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found.")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_PHOTO_EXT:
        raise HTTPException(status_code=400, detail="Invalid file type. Use jpg, png, gif, or webp.")
    user_id = str(users[idx].get("id"))
    filename = f"user_{user_id}{ext}"
    path = UPLOADS_DIR / filename
    try:
        with path.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except OSError:
        raise HTTPException(status_code=500, detail="Failed to save file.")
    old = users[idx].get("photo_filename")
    if old and (UPLOADS_DIR / old).exists():
        try:
            (UPLOADS_DIR / old).unlink()
        except OSError:
            pass
    users[idx]["photo_filename"] = filename
    write_json("users", users)
    return {"photo_filename": filename}


# --- Users list (protected) ---
@router.get("/users")
async def list_users(current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "users:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    users = _ensure_users()
    return [_user_to_response(u) for u in users]


# --- Update user (username, password, etc.) — persisted to users.json ---
@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UpdateUserBody,
    request: Request,
    current: dict = Depends(_get_current_user),
):
    if not has_permission(current.get("role"), "users:write"):
        raise HTTPException(status_code=403, detail="No permission to update users.")
    users = _ensure_users()
    idx = next((i for i, u in enumerate(users) if str(u.get("id")) == str(user_id)), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found.")
    user = users[idx]
    data = body.model_dump(exclude_unset=True)
    if "username" in data and data["username"] is not None:
        new_username = (data["username"] or "").strip()
        if not new_username:
            raise HTTPException(status_code=400, detail="Username cannot be empty.")
        new_lower = new_username.lower()
        for u in users:
            if str(u.get("id")) != str(user_id) and (u.get("username") or "").strip().lower() == new_lower:
                raise HTTPException(status_code=409, detail="Username already in use.")
        user["username"] = new_username
    if "password" in data and data["password"] is not None:
        password = (data["password"] or "").strip()
        if password:
            errors = _validate_password_policy(password)
            if errors:
                raise HTTPException(status_code=400, detail="; ".join(errors))
            old_hash = user.get("password")
            user["password"] = _hash_password(password)
            user["password_changed_at"] = datetime.now(timezone.utc).isoformat()
            if old_hash:
                hist = user.get("password_history") or []
                user["password_history"] = [old_hash] + hist[: PASSWORD_HISTORY_COUNT - 1]
        else:
            raise HTTPException(status_code=400, detail="Password cannot be empty.")
    if "name" in data and data["name"] is not None:
        user["name"] = (data["name"] or "").strip() or user.get("name", "")
    if "email" in data and data["email"] is not None:
        user["email"] = (data["email"] or "").strip() or ""
    if "role" in data and data["role"] is not None:
        user["role"] = (data["role"] or "").strip() or user.get("role", "staff")
    if "phone" in data:
        user["phone"] = (data.get("phone") or "").strip()
    if "is_enabled" in data and data["is_enabled"] is not None:
        user["is_enabled"] = bool(data["is_enabled"])
    users[idx] = user
    write_json("users", users)
    _audit("user_updated", current.get("sub"), "users", {"target_user_id": user_id}, request)
    return _user_to_response(user)


# --- Role templates: default fields per role ---
ROLE_TEMPLATES = {
    "student": {"linked_student_id": ""},
    "parent": {"linked_student_ids": []},
    "hod": {"department": ""},
    "faculty": {"linked_staff_id": ""},
    "staff": {"linked_staff_id": ""},
}


@router.get("/role-templates")
def get_role_templates(current: dict = Depends(_get_current_user)):
    """Return default fields per role for create-user form."""
    if not has_permission(current.get("role"), "users:read"):
        raise HTTPException(status_code=403, detail="No permission.")
    return {"templates": ROLE_TEMPLATES}


# --- Copy user (duplicate with new username) ---
@router.post("/users/{user_id}/copy")
async def copy_user(
    user_id: str,
    body: CopyUserBody,
    request: Request,
    current: dict = Depends(_get_current_user),
):
    """Duplicate a user with new username. Optional new password; otherwise generates one."""
    if not has_permission(current.get("role"), "users:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    users = _ensure_users()
    src = next((u for u in users if str(u.get("id")) == str(user_id)), None)
    if not src:
        raise HTTPException(status_code=404, detail="User not found.")
    new_username = (body.new_username or "").strip()
    if not new_username:
        raise HTTPException(status_code=400, detail="new_username is required.")
    new_lower = new_username.lower()
    if any((u.get("username") or "").strip().lower() == new_lower for u in users):
        raise HTTPException(status_code=409, detail="Username already in use.")
    plain_pw = (body.password or "").strip()
    if not plain_pw:
        plain_pw = secrets.token_urlsafe(12)
    errors = _validate_password_policy(plain_pw)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    new_id = next_id("users")
    role = (src.get("role") or "staff").strip() or "staff"
    extra = ROLE_TEMPLATES.get(role, {})
    new_user = {
        "id": new_id,
        "username": new_username,
        "password": _hash_password(plain_pw),
        "name": (body.name or src.get("name") or "").strip() or new_username,
        "email": (body.email or src.get("email") or "").strip(),
        "phone": (body.phone or src.get("phone") or "").strip(),
        "role": role,
        "photo_filename": "",
        "is_enabled": True,
        "failed_attempts": 0,
        "locked_until": None,
        "password_changed_at": datetime.now(timezone.utc).isoformat(),
        "password_history": [],
        **{k: src.get(k) if k in src else v for k, v in extra.items()},
    }
    users.append(new_user)
    write_json("users", users)
    _audit("user_copied", current.get("sub"), "users", {"source_id": user_id, "new_id": new_id}, request)
    return {"user": _user_to_response(new_user), "generated_password": plain_pw if not body.password else None}


def _username_from_name(name: str) -> str:
    """Generate username from name: lowercase, spaces to underscores, alphanumeric only."""
    s = (name or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s or "user"


# --- Admin create user ---
@router.post("/users")
async def create_user(body: CreateUserBody, request: Request, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "users:write"):
        raise HTTPException(status_code=403, detail="No permission to create users.")
    users = _ensure_users()
    username = (body.username or "").strip()
    if not username:
        username = _username_from_name(body.name)
    if not username:
        raise HTTPException(status_code=400, detail="Username or name is required.")
    username_lower = username.lower()
    if any((u.get("username") or "").strip().lower() == username_lower for u in users):
        raise HTTPException(status_code=409, detail="Username already in use.")
    plain_pw = (body.password or "").strip()
    if not plain_pw:
        plain_pw = secrets.token_urlsafe(12)
    errors = _validate_password_policy(plain_pw)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))
    new_id = next_id("users")
    role = (body.role or "staff").strip() or "staff"
    extra = ROLE_TEMPLATES.get(role, {})
    user = {
        "id": new_id,
        "username": username.strip(),
        "password": _hash_password(plain_pw),
        "name": (body.name or "").strip() or username,
        "email": (body.email or "").strip(),
        "phone": (body.phone or "").strip(),
        "role": role,
        "photo_filename": "",
        "is_enabled": True,
        "failed_attempts": 0,
        "locked_until": None,
        "password_changed_at": datetime.now(timezone.utc).isoformat(),
        "password_history": [],
        **extra,
    }
    users.append(user)
    write_json("users", users)
    _audit("user_created", current.get("sub"), "users", {"target_user_id": new_id}, request)
    resp = _user_to_response(user)
    if not body.password:
        resp["generated_password"] = plain_pw
    return resp


# --- Admin unlock (clear lock after failed attempts) ---
@router.patch("/users/{user_id}/unlock")
async def unlock_user(
    user_id: str,
    request: Request,
    current: dict = Depends(_get_current_user),
):
    """Admin unlock: clear failed_attempts and locked_until."""
    if not has_permission(current.get("role"), "users:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    users = _ensure_users()
    idx = next((i for i, u in enumerate(users) if str(u.get("id")) == str(user_id)), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found.")
    users[idx]["failed_attempts"] = 0
    users[idx]["locked_until"] = None
    write_json("users", users)
    _audit("user_unlocked", current.get("sub"), "users", {"target_user_id": user_id}, request)
    return _user_to_response(users[idx])


# --- Enable / Disable user ---
@router.patch("/users/{user_id}/enable")
async def set_user_enabled(
    user_id: str,
    body: EnableUserBody,
    request: Request,
    current: dict = Depends(_get_current_user),
):
    if not has_permission(current.get("role"), "users:write"):
        raise HTTPException(status_code=403, detail="No permission.")
    users = _ensure_users()
    idx = next((i for i, u in enumerate(users) if str(u.get("id")) == str(user_id)), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found.")
    users[idx]["is_enabled"] = bool(body.enabled)
    write_json("users", users)
    _audit("user_enabled_toggle", current.get("sub"), "users", {"target_user_id": user_id, "enabled": body.enabled}, request)
    return _user_to_response(users[idx])


# --- User impersonation (support mode) ---
@router.post("/impersonate/{user_id}")
async def start_impersonate(user_id: str, current: dict = Depends(_get_current_user)):
    if not has_permission(current.get("role"), "users:impersonate"):
        raise HTTPException(status_code=403, detail="No permission to impersonate.")
    users = _ensure_users()
    target = next((u for u in users if str(u.get("id")) == str(user_id)), None)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if not target.get("is_enabled", True):
        raise HTTPException(status_code=400, detail="Cannot impersonate a disabled user.")
    return {"user": _user_to_response(target), "impersonating": True, "message": "Send X-Impersonate-User-Id header with this user id to act as them."}


@router.post("/impersonate/stop")
async def stop_impersonate(current: dict = Depends(_get_current_user)):
    """Stop impersonation (frontend clears X-Impersonate-User-Id header)."""
    return {"impersonating": False, "message": "Clear X-Impersonate-User-Id header to act as yourself."}
