import React, { useState, useEffect } from 'react';
import api from '../api';

export default function ParentInbox() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const load = () => {
    api.parent
      .communicationInbox()
      .then((r) => setMessages(r.messages || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyingTo || !replyBody.body.trim()) return;
    setSending(true);
    try {
      await api.parent.replyToParent({
        parent_id: replyingTo.from_user_id,
        student_id: replyingTo.student_id,
        subject: replyBody.subject.trim() || `Re: ${replyingTo.subject}`,
        body: replyBody.body.trim(),
      });
      setReplyingTo(null);
      setReplyBody({ subject: '', body: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div>
      <h2 className="page-title">Parent messages (faculty inbox)</h2>
      <p className="dashboard-welcome">View and reply to messages from parents.</p>
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        {messages.length === 0 ? (
          <p>No messages from parents.</p>
        ) : (
          <ul className="message-list">
            {messages.map((m) => (
              <li key={m.id} className="message-received">
                <span className="message-meta">{(m.created_at || '').slice(0, 16)} · Student ID: {m.student_id}</span>
                <strong>{m.subject}</strong>
                <p>{m.body}</p>
                {!replyingTo || replyingTo.id !== m.id ? (
                  <button type="button" className="btn btn-small" onClick={() => setReplyingTo(m)}>Reply</button>
                ) : (
                  <form onSubmit={handleReply} style={{ marginTop: '0.5rem' }}>
                    <input value={replyBody.subject} onChange={(e) => setReplyBody((r) => ({ ...r, subject: e.target.value }))} placeholder="Subject" />
                    <textarea value={replyBody.body} onChange={(e) => setReplyBody((r) => ({ ...r, body: e.target.value }))} placeholder="Your reply" rows={3} required />
                    <button type="submit" className="btn btn-primary btn-small" disabled={sending}>{sending ? 'Sending…' : 'Send reply'}</button>
                    <button type="button" className="btn btn-small" onClick={() => { setReplyingTo(null); setReplyBody({ subject: '', body: '' }); }}>Cancel</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
