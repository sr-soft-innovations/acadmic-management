import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Login.css';

const FEATURES = [
  'Student & Staff Management',
  'Attendance & Timetable',
  'Examinations & Results',
  'Fee Collection & Reports',
  'Library, Lab & Hostel',
  'Placement & Analytics',
];

const AFFILIATION = 'Approved by PCI | Affiliated to University';

const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_CLASSES = ['str-short', 'str-weak', 'str-fair', 'str-good', 'str-strong'];

function getPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function LogoImage() {
  const [hasLogo, setHasLogo] = useState(true);
  if (!hasLogo) return <span className="login-brand-logo-text">GP</span>;
  return (
    <img
      src="/logo.png"
      alt="G.P. College of Pharmacy"
      className="login-brand-logo-img"
      onError={() => setHasLogo(false)}
    />
  );
}

function CampusImage() {
  const [hasImg, setHasImg] = useState(true);
  if (!hasImg) {
    return (
      <div className="login-campus-placeholder">
        <span>Campus Image</span>
        <small>Place your photo at public/campus.jpg</small>
      </div>
    );
  }
  return (
    <img
      src="/campus.jpg"
      alt="College campus"
      onError={() => setHasImg(false)}
    />
  );
}

export default function Login() {
  const [mode, setMode] = useState('password');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('erp_remember') === '1');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [captchaToken, setCaptchaToken] = useState('');
  const [backendOnline, setBackendOnline] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('erp_dark') === '1');
  const { user, login, loginWithOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [error, setError] = useState('');
  const otpTimerRef = useRef(null);

  const sessionExpired = location.state?.expired === true;

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  useEffect(() => {
    api.auth.getPasswordPolicy().then(setPasswordPolicy).catch(() => {});
    const saved = localStorage.getItem('erp_saved_username');
    if (saved) setUsername(saved);
  }, []);

  // System status check
  useEffect(() => {
    let alive = true;
    const check = () => {
      api.health()
        .then(() => { if (alive) setBackendOnline(true); })
        .catch(() => { if (alive) setBackendOnline(false); });
    };
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Dark mode
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('erp_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    otpTimerRef.current = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(otpTimerRef.current);
  }, [otpCountdown]);

  // Keyboard shortcuts: Alt+P → password, Alt+O → OTP
  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey) return;
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setMode('password'); setError(''); setOtpSent(false); }
      if (e.key === 'o' || e.key === 'O') { e.preventDefault(); setMode('otp'); setError(''); setOtpSent(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Please enter your username.'); return; }
    if (failCount >= 3 && !captchaToken.trim()) { setError('Please complete the CAPTCHA.'); return; }
    setSubmitting(true);
    try {
      const deviceId = localStorage.getItem('device_id') || `web-${Date.now()}`;
      localStorage.setItem('device_id', deviceId);
      if (rememberMe) {
        localStorage.setItem('erp_remember', '1');
        localStorage.setItem('erp_saved_username', username);
      } else {
        localStorage.removeItem('erp_remember');
        localStorage.removeItem('erp_saved_username');
      }
      await login(username, password, null, {
        deviceId,
        deviceInfo: navigator.userAgent.slice(0, 80),
        captchaToken: captchaToken || null,
        rememberMe: rememberMe,
      });
      setSuccess(true);
      setFailCount(0);
      setTimeout(() => navigate(from, { replace: true }), 800);
    } catch (err) {
      const msg = err.message || 'Login failed.';
      setError(msg);
      setFailCount((c) => c + 1);
      setCaptchaToken('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestOtp = useCallback(async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!email.trim() && !phone.trim()) {
      setError('Enter email or phone number.');
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.requestOtp(email || null, phone || null);
      setOtpSent(true);
      setOtpCountdown(60);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setSubmitting(false);
    }
  }, [email, phone]);

  const handleRequestPasswordReset = useCallback(async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!forgotEmail.trim() && !forgotPhone.trim()) {
      setError('Enter email or phone to reset password.');
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.requestPasswordReset(forgotEmail || null, forgotPhone || null);
      setResetSent(true);
      setOtpCountdown(60);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to send reset code.');
    } finally {
      setSubmitting(false);
    }
  }, [forgotEmail, forgotPhone]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!resetCode.trim() || !resetPassword.trim()) {
      setError('Enter OTP code and new password.');
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.resetPassword({
        email: forgotEmail || null,
        phone: forgotPhone || null,
        code: resetCode.trim(),
        new_password: resetPassword,
      });
      setError('');
      setForgotMode(false);
      setResetSent(false);
      setResetCode('');
      setResetPassword('');
      setForgotEmail('');
      setForgotPhone('');
      setSuccess(true);
      setTimeout(() => navigate(from, { replace: true }), 800);
    } catch (err) {
      setError(err.message || 'Invalid code or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpCode.trim()) return;
    setSubmitting(true);
    try {
      const deviceId = localStorage.getItem('device_id') || `web-${Date.now()}`;
      localStorage.setItem('device_id', deviceId);
      await loginWithOtp(email || null, phone || null, otpCode.trim(), null, {
        deviceId,
        deviceInfo: navigator.userAgent.slice(0, 80),
      });
      setSuccess(true);
      setTimeout(() => navigate(from, { replace: true }), 800);
    } catch (err) {
      setError(err.message || 'Invalid OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const pwStrength = getPasswordStrength(password);
  const isLocked = error && (error.includes('locked') || error.includes('423'));

  if (success) {
    return (
      <div className="login-page">
        <div className="login-form-panel">
          <div className="login-success-card">
            <div className="login-success-icon" aria-hidden="true">&#10003;</div>
            <h2>Login successful</h2>
            <p>Redirecting to dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Left: Form panel */}
      <div className="login-form-panel">
        <div className="login-card">
          {/* Mobile brand strip */}
          <div className="login-card-mobile-brand">
            <span className="login-mobile-logo">GP</span>
            <span>G.P. College of Pharmacy</span>
          </div>

          {/* Top bar: status + dark mode */}
          <div className="login-top-bar">
            <span className={`login-status ${backendOnline === true ? 'online' : backendOnline === false ? 'offline' : ''}`}>
              <span className="login-status-dot" />
              {backendOnline === true ? 'System online' : backendOnline === false ? 'System offline' : 'Checking…'}
            </span>
            <button
              type="button"
              className="login-dark-toggle"
              onClick={() => setDarkMode((v) => !v)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? '☀' : '☾'}
            </button>
          </div>

          <h2 className="login-heading">Welcome back</h2>
          <p className="login-subheading">
            Sign in to access the ERP portal
          </p>

          {sessionExpired && (
            <div className="login-warning" role="alert">
              Your session has expired. Please sign in again.
            </div>
          )}

          {/* Tabs */}
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              className={mode === 'password' ? 'active' : ''}
              onClick={() => { setMode('password'); setError(''); setOtpSent(false); }}
              title="Alt + P"
            >
              Password
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'otp'}
              className={mode === 'otp' ? 'active' : ''}
              onClick={() => { setMode('otp'); setError(''); setOtpSent(false); }}
              title="Alt + O"
            >
              OTP Login
            </button>
          </div>

          {passwordPolicy && (
            <div className="login-policy">
              <strong>Password policy:</strong> Min {passwordPolicy.min_length} chars
              {passwordPolicy.require_upper && ', uppercase'}
              {passwordPolicy.require_lower && ', lowercase'}
              {passwordPolicy.require_digit && ', digit'}
              {passwordPolicy.require_special && ', special'}
            </div>
          )}

          {error && (
            <div className={`login-error ${isLocked ? 'login-error-locked' : ''}`} role="alert">
              <span className="login-error-icon" aria-hidden="true">{isLocked ? '🔒' : '!'}</span>
              {error}
            </div>
          )}

          {/* Password form */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="login-form" autoComplete="on">
              <div className="login-field">
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  disabled={isLocked}
                />
              </div>
              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <div className="login-password-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    disabled={isLocked}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {/* Password strength meter */}
                {password.length > 0 && (
                  <div className="login-strength">
                    <div className="login-strength-bar">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className={`login-strength-seg ${i <= pwStrength ? STRENGTH_CLASSES[pwStrength] : ''}`} />
                      ))}
                    </div>
                    <span className={`login-strength-label ${STRENGTH_CLASSES[pwStrength]}`}>
                      {STRENGTH_LABELS[pwStrength]}
                    </span>
                  </div>
                )}
              </div>
              {/* CAPTCHA after 3+ failures */}
              {failCount >= 3 && (
                <div className="login-field login-captcha-field">
                  <label htmlFor="login-captcha">Security check</label>
                  <p className="login-captcha-hint">
                    Too many failed attempts. Enter the text below to continue.
                  </p>
                  <div className="login-captcha-challenge">
                    <span className="login-captcha-text" aria-hidden="true">
                      {/* Simple math challenge as fallback when no reCAPTCHA configured */}
                      Type "<strong>verify</strong>" to proceed
                    </span>
                  </div>
                  <input
                    id="login-captcha"
                    type="text"
                    value={captchaToken}
                    onChange={(e) => setCaptchaToken(e.target.value)}
                    placeholder='Type "verify"'
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="login-extras">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  className="login-forgot"
                  onClick={() => { setForgotMode(true); setError(''); setResetSent(false); setResetCode(''); setResetPassword(''); setForgotEmail(''); setForgotPhone(''); }}
                >
                  Forgot password?
                </button>
              </div>
              <button type="submit" className="login-submit" disabled={submitting || isLocked}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="login-enter-hint">Press <kbd>Enter</kbd> to sign in</p>
            </form>
          )}

          {/* OTP request */}
          {mode === 'otp' && !otpSent && (
            <form onSubmit={handleRequestOtp} className="login-form">
              <div className="login-field">
                <label>Email or Phone</label>
                <input
                  type="text"
                  value={email || phone}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.includes('@')) { setEmail(v); setPhone(''); } else { setPhone(v); setEmail(''); }
                  }}
                  placeholder="Email or phone number"
                />
              </div>
              <button type="submit" className="login-submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send OTP'}
              </button>
              <p className="login-hint">User must have email/phone registered in the system.</p>
            </form>
          )}

          {/* OTP verify */}
          {mode === 'otp' && otpSent && (
            <form onSubmit={handleVerifyOtp} className="login-form">
              <div className="login-field">
                <label>Enter OTP code</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  autoFocus
                  className="login-otp-input"
                />
              </div>
              <button type="submit" className="login-submit" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <div className="login-otp-actions">
                <button type="button" className="login-back" onClick={() => { setOtpSent(false); setOtpCode(''); setOtpCountdown(0); }}>
                  ← Change email / phone
                </button>
                {otpCountdown > 0 ? (
                  <span className="login-otp-timer">Resend in {otpCountdown}s</span>
                ) : (
                  <button type="button" className="login-resend" onClick={() => handleRequestOtp(null)} disabled={submitting}>
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Forgot password modal */}
          {forgotMode && (
            <div className="login-forgot-overlay" onClick={() => { setForgotMode(false); setError(''); }}>
              <div className="login-forgot-panel" onClick={(e) => e.stopPropagation()}>
                <h3>Reset password</h3>
                {!resetSent ? (
                  <form onSubmit={handleRequestPasswordReset}>
                    <p className="login-forgot-hint">Enter your email or phone. We&apos;ll send a verification code.</p>
                    <div className="login-field">
                      <label>Email or Phone</label>
                      <input
                        type="text"
                        value={forgotEmail || forgotPhone}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v.includes('@')) { setForgotEmail(v); setForgotPhone(''); } else { setForgotPhone(v); setForgotEmail(''); }
                        }}
                        placeholder="Email or phone number"
                      />
                    </div>
                    <div className="login-forgot-actions">
                      <button type="button" className="btn-secondary" onClick={() => { setForgotMode(false); setError(''); }}>Cancel</button>
                      <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Sending…' : 'Send code'}</button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword}>
                    <div className="login-field">
                      <label>Enter 6-digit code</label>
                      <input
                        type="text"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Code from email/phone"
                        maxLength={6}
                      />
                    </div>
                    <div className="login-field">
                      <label>New password</label>
                      <input
                        type="password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="New password"
                      />
                    </div>
                    <div className="login-forgot-actions">
                      <button type="button" className="btn-secondary" onClick={() => { setResetSent(false); setResetCode(''); setResetPassword(''); }}>← Back</button>
                      <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Resetting…' : 'Reset password'}</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Footer: terms */}
          <div className="login-card-footer">
            <span>By signing in, you agree to the <button type="button" className="login-link" onClick={() => alert('Terms of use for G.P. College of Pharmacy ERP. Contact administration for details.')}>Terms of Use</button> &amp; <button type="button" className="login-link" onClick={() => alert('Privacy policy for G.P. College of Pharmacy ERP. Contact administration for details.')}>Privacy Policy</button></span>
          </div>
        </div>
      </div>

      {/* Right: Branding panel */}
      <aside className="login-brand" aria-hidden="true">
        <div className="login-brand-inner">
          <div className="login-brand-logo">
            <LogoImage />
          </div>
          <h1 className="login-brand-title">G.P. College of Pharmacy</h1>
          <p className="login-brand-affiliation">{AFFILIATION}</p>
          <p className="login-brand-tagline">
            Enterprise Resource Planning System
          </p>
          <ul className="login-brand-features">
            {FEATURES.map((f) => (
              <li key={f}>
                <span className="login-feature-check" aria-hidden="true">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>

          <div className="login-campus-image">
            <CampusImage />
          </div>

          <p className="login-brand-footer">
            &copy; {new Date().getFullYear()} G.P. College of Pharmacy. All rights reserved.
          </p>
        </div>
      </aside>
    </div>
  );
}
