import React, { useState, useEffect, useRef } from 'react';
import api, { getAuthHeaders } from '../api';
import { useAuth } from '../context/AuthContext';
import './Profile.css';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const fileInputRef = useRef(null);

  const loadProfile = () => {
    setLoading(true);
    setError('');
    api.auth
      .getMe()
      .then((data) => {
        setProfile(data);
        setPhotoUrl('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const photoBlobRef = useRef(null);
  useEffect(() => {
    if (!profile?.photo_filename) {
      setPhotoUrl('');
      return;
    }
    const url = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/auth/me/photo`;
    fetch(url, { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (photoBlobRef.current) URL.revokeObjectURL(photoBlobRef.current);
        photoBlobRef.current = blob ? URL.createObjectURL(blob) : null;
        setPhotoUrl(photoBlobRef.current || '');
      })
      .catch(() => setPhotoUrl(''));
    return () => {
      if (photoBlobRef.current) {
        URL.revokeObjectURL(photoBlobRef.current);
        photoBlobRef.current = null;
      }
    };
  }, [profile?.photo_filename]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.auth.updateMe({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
      });
      setSuccess('Profile updated.');
      refreshUser();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please choose a JPG, PNG, GIF or WebP image.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await api.auth.uploadMyPhoto(file);
      setSuccess('Photo updated.');
      loadProfile();
      refreshUser();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (passwordForm.new.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    try {
      await api.auth.changeMyPassword(passwordForm.current, passwordForm.new);
      setSuccess('Password changed.');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (e) {
      setPasswordError(e.message);
    }
  };

  if (loading && !profile) return <p className="loading">Loading profile...</p>;

  return (
    <div className="profile-page">
      <h2 className="page-title">My profile</h2>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <section className="profile-section profile-personal">
        <h3>Personal details & contact</h3>
        <form onSubmit={handleSaveProfile}>
          <div className="form-row">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              type="text"
              value={profile?.name ?? ''}
              onChange={(e) => setProfile((p) => (p ? { ...p, name: e.target.value } : p))}
              autoComplete="name"
            />
          </div>
          <div className="form-row">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              value={profile?.email ?? ''}
              onChange={(e) => setProfile((p) => (p ? { ...p, email: e.target.value } : p))}
              autoComplete="email"
            />
          </div>
          <div className="form-row">
            <label htmlFor="profile-phone">Phone</label>
            <input
              id="profile-phone"
              type="tel"
              value={profile?.phone ?? ''}
              onChange={(e) => setProfile((p) => (p ? { ...p, phone: e.target.value } : p))}
              autoComplete="tel"
            />
          </div>
          <p className="form-muted">Username and role are managed by an administrator.</p>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="profile-section profile-photo">
        <h3>Profile photo</h3>
        <div className="profile-photo-box">
          {photoUrl ? (
            <img src={photoUrl} alt="Profile" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-placeholder">
              {profile?.name?.slice(0, 1) || profile?.username?.slice(0, 1) || '?'}
            </div>
          )}
          <div className="profile-photo-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Upload photo
            </button>
          </div>
        </div>
      </section>

      <section className="profile-section profile-password">
        <h3>Change password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-row">
            <label htmlFor="profile-current-pw">Current password</label>
            <input
              id="profile-current-pw"
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
              autoComplete="current-password"
            />
          </div>
          <div className="form-row">
            <label htmlFor="profile-new-pw">New password</label>
            <input
              id="profile-new-pw"
              type="password"
              value={passwordForm.new}
              onChange={(e) => setPasswordForm((p) => ({ ...p, new: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          <div className="form-row">
            <label htmlFor="profile-confirm-pw">Confirm new password</label>
            <input
              id="profile-confirm-pw"
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p className="form-error">{passwordError}</p>}
          <button type="submit" className="btn-primary">Change password</button>
        </form>
      </section>
    </div>
  );
}
