import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api';

const ROLES = [
  'super_admin',
  'admin',
  'principal',
  'hod',
  'staff',
  'faculty',
  'student',
  'parent',
  'librarian',
  'lab_assistant',
  'accountant',
  'non_teaching_staff',
  'hospital_mentor',
  'guest_faculty',
];

const AuthContext = createContext(null);

const TOKEN_KEY = 'college_erp_token';
const USER_KEY = 'college_erp_user';
const EXPIRES_KEY = 'college_erp_expires';
const SESSION_ID_KEY = 'college_erp_session_id';
const IMPERSONATE_USER_ID_KEY = 'college_erp_impersonate_user_id';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const logout = useCallback(() => {
    const sessionId = localStorage.getItem(SESSION_ID_KEY);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(IMPERSONATE_USER_ID_KEY);
    if (sessionId) api.auth.logout(sessionId).catch(() => {});
  }, []);

  const refreshUser = useCallback(() => {
    api.auth.getMe().then((profile) => {
      const u = { id: profile.id, username: profile.username, role: profile.role, name: profile.name };
      if (profile.department) u.department = profile.department;
      if (profile.linked_student_id) u.linked_student_id = profile.linked_student_id;
      setUser(u);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    }).catch(() => {});
  }, []);

  const [isImpersonating, setIsImpersonating] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem(IMPERSONATE_USER_ID_KEY));

  const startImpersonate = useCallback((userId) => {
    localStorage.setItem(IMPERSONATE_USER_ID_KEY, String(userId));
    setIsImpersonating(true);
    refreshUser();
  }, [refreshUser]);

  const stopImpersonate = useCallback(() => {
    localStorage.removeItem(IMPERSONATE_USER_ID_KEY);
    setIsImpersonating(false);
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    const expiresAt = localStorage.getItem(EXPIRES_KEY);
    if (!expiresAt || !user) return;
    const check = () => {
      if (Date.now() >= parseInt(expiresAt, 10)) {
        logout();
      }
    };
    const t = setInterval(check, 60 * 1000);
    return () => clearInterval(t);
  }, [user, logout]);

  const login = useCallback(async (username, password, role, opts = {}) => {
    const data = await api.auth.login(username, password, role, {
      captchaToken: opts.captchaToken,
      deviceId: opts.deviceId,
      deviceInfo: opts.deviceInfo,
      rememberMe: opts.rememberMe,
    });
    const userData = data?.user;
    if (!userData || !userData.id) {
      throw new Error('Invalid response from server: missing user. Check backend is running correctly.');
    }
    setUser(userData);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.expires_in_minutes) {
      const expiresAt = Date.now() + data.expires_in_minutes * 60 * 1000;
      localStorage.setItem(EXPIRES_KEY, String(expiresAt));
    }
    if (data.session_id) localStorage.setItem(SESSION_ID_KEY, data.session_id);
  }, []);

  const loginWithOtp = useCallback(async (email, phone, code, role, opts = {}) => {
    const data = await api.auth.verifyOtp(email, phone, code, role, opts.deviceId, opts.deviceInfo);
    const userData = data?.user;
    if (!userData || !userData.id) {
      throw new Error('Invalid response from server: missing user.');
    }
    setUser(userData);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (data.access_token) localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.expires_in_minutes) {
      const expiresAt = Date.now() + data.expires_in_minutes * 60 * 1000;
      localStorage.setItem(EXPIRES_KEY, String(expiresAt));
    }
    if (data.session_id) localStorage.setItem(SESSION_ID_KEY, data.session_id);
  }, []);

  const [permissionMatrix, setPermissionMatrix] = useState(null);
  const refreshPermissions = useCallback(() => {
    api.auth.permissions().then((r) => setPermissionMatrix(r.matrix || {})).catch(() => {});
  }, []);
  useEffect(() => {
    if (user) refreshPermissions();
  }, [user, refreshPermissions]);

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false;
      const perms = permissionMatrix?.[user.role] || [];
      if (perms.includes('*')) return true;
      return perms.includes(permission);
    },
    [user, permissionMatrix]
  );

  const hasRole = useCallback(
    (...allowedRoles) => {
      if (!user) return false;
      return allowedRoles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithOtp,
        logout,
        refreshUser,
        startImpersonate,
        stopImpersonate,
        isImpersonating,
        hasRole,
        hasPermission,
        permissionMatrix,
        refreshPermissions,
        ROLES,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
