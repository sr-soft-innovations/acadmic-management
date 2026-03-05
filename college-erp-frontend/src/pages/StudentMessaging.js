import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function StudentMessaging() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.student.messaging()
      .then((r) => setMessages(r.messages || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.body?.trim()) return;
    setSending(true);
    try {
      await api.student.sendMessage({ subject: form.subject.trim() || 'Enquiry', body: form.body.trim() });
      setForm({ subject: '', body: '' });
      const r = await api.student.messaging();
      setMessages(r.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div className="student-portal">
      <h2 className="page-title">Message Faculty</h2>
      <p className="dashboard-welcome">Send messages to faculty and view replies.</p>
      {error && <p className="form-error">{error}</p>}

      <form onSubmit={handleSend} className="form-grid" style={{ marginBottom: '1.5rem' }}>
        <div style={{ gridColumn: '1 / -1' }}><label>Subject</label><input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject" /></div>
        <div style={{ gridColumn: '1 / -1' }}><label>Message</label><textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Your message to faculty" rows={3} required /></div>
        <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
      </form>

      <h3>Messages</h3>
      {messages.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <ul className="message-list">
          {messages.map((m) => (
            <li key={m.id} className={String(m.from_user_id) === String(user?.id) ? 'message-sent' : 'message-received'}>
              <span className="message-meta">{(m.created_at || '').slice(0, 16)} · {String(m.from_user_id) === String(user?.id) ? 'You' : 'Faculty'}</span>
              <strong>{m.subject}</strong>
              <p>{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
