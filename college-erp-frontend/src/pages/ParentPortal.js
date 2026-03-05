import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function ParentPortal() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('attendance');
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [fees, setFees] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageForm, setMessageForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', fee_type: 'tuition', remarks: '' });
  const [paying, setPaying] = useState(false);

  const student = students.find((s) => str(s.id) === str(selectedId)) || students[0];
  const currentStudentId = student?.id;

  function str(x) {
    return x != null ? String(x) : '';
  }

  useEffect(() => {
    api.parent
      .students()
      .then((r) => {
        const list = r.students || [];
        setStudents(list);
        if (list.length && !selectedId) setSelectedId(list[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!currentStudentId) return;
    setAttendance([]);
    setMarks([]);
    setFees(null);
    setMessages([]);
    Promise.all([
      api.parent.attendance(currentStudentId).then((r) => setAttendance(r.attendance || [])).catch(() => setAttendance([])),
      api.parent.marks(currentStudentId).then((r) => setMarks(r.marks || [])).catch(() => setMarks([])),
      api.parent.fees(currentStudentId).then(setFees).catch(() => setFees(null)),
      api.parent.communication(currentStudentId).then((r) => setMessages(r.messages || [])).catch(() => setMessages([])),
    ]);
  }, [currentStudentId]);

  const handlePayFee = async (e) => {
    e.preventDefault();
    if (!currentStudentId || !payForm.amount || Number(payForm.amount) <= 0) return;
    setPaying(true);
    try {
      await api.parent.payFee(currentStudentId, {
        amount: Number(payForm.amount),
        fee_type: payForm.fee_type || 'tuition',
        remarks: payForm.remarks.trim() || '',
      });
      setPayForm({ amount: '', fee_type: 'tuition', remarks: '' });
      const f = await api.parent.fees(currentStudentId);
      setFees(f);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!currentStudentId || !messageForm.body.trim()) return;
    setSending(true);
    try {
      await api.parent.sendMessage({
        student_id: currentStudentId,
        subject: messageForm.subject.trim() || 'Enquiry',
        body: messageForm.body.trim(),
      });
      setMessageForm({ subject: '', body: '' });
      const r = await api.parent.communication(currentStudentId);
      setMessages(r.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="loading">Loading…</p>;

  return (
    <div className="parent-portal">
      <h2 className="page-title">Parent portal</h2>
      <p className="dashboard-welcome">View attendance, marks, fee status and communicate with faculty for your ward.</p>
      {error && <p className="form-error">{error}</p>}

      {students.length === 0 ? (
        <p>No students linked to your account. Contact the office to link your ward.</p>
      ) : (
        <>
          <div className="parent-student-picker">
            <label>Select student:</label>
            <select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value || null)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name} – {s.roll_no || s.course}</option>
              ))}
            </select>
          </div>

          <div className="profile-tabs">
            {['attendance', 'marks', 'fees', 'communication'].map((t) => (
              <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t === 'attendance' && 'Attendance'}
                {t === 'marks' && 'Marks'}
                {t === 'fees' && 'Fee payment status'}
                {t === 'communication' && 'Communication'}
              </button>
            ))}
          </div>

          {tab === 'attendance' && (
            <section className="table-wrap">
              <h3>Attendance</h3>
              {attendance.length === 0 ? (
                <p>No attendance records yet.</p>
              ) : (
                <table>
                  <thead><tr><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id || a.date}><td>{a.date}</td><td>{a.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {tab === 'marks' && (
            <section className="table-wrap">
              <h3>Marks</h3>
              {marks.length === 0 ? (
                <p>No marks recorded yet.</p>
              ) : (
                <table>
                  <thead><tr><th>Subject</th><th>Exam</th><th>Marks</th><th>Date</th></tr></thead>
                  <tbody>
                    {marks.map((m) => (
                      <tr key={m.id}><td>{m.subject}</td><td>{m.exam_type}</td><td>{m.marks} / {m.max_marks}</td><td>{m.exam_date}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {tab === 'fees' && (
            <section className="table-wrap">
              <h3>Fee payment status</h3>
              {fees && (
                <p><strong>Total paid:</strong> ₹{Number(fees.total_paid || 0).toLocaleString('en-IN')} ({fees.transaction_count} transaction(s))</p>
              )}
              <form onSubmit={handlePayFee} className="form-grid" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-bg-subtle)', borderRadius: 'var(--radius)' }}>
                <h4 style={{ margin: '0 0 0.5rem', gridColumn: '1 / -1' }}>Pay fee</h4>
                <div><label>Amount (₹)</label><input type="number" min="1" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount" required /></div>
                <div><label>Type</label><select value={payForm.fee_type} onChange={(e) => setPayForm((f) => ({ ...f, fee_type: e.target.value }))}><option value="tuition">Tuition</option><option value="exam">Exam</option><option value="lab">Lab</option><option value="library">Library</option><option value="other">Other</option></select></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Remarks (optional)</label><input value={payForm.remarks} onChange={(e) => setPayForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Remarks" /></div>
                <div><button type="submit" className="btn btn-primary" disabled={paying}>{paying ? 'Processing…' : 'Pay fee'}</button></div>
              </form>
              {fees && fees.payments && fees.payments.length > 0 ? (
                <table>
                  <thead><tr><th>Date</th><th>Amount</th><th>Type</th><th>Receipt</th></tr></thead>
                  <tbody>
                    {fees.payments.map((p) => (
                      <tr key={p.id}><td>{(p.paid_at || p.created_at || '').slice(0, 10)}</td><td>₹{Number(p.amount).toLocaleString('en-IN')}</td><td>{p.fee_type}</td><td>{p.receipt_no || '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No fee payments recorded yet.</p>
              )}
            </section>
          )}

          {tab === 'communication' && (
            <section>
              <h3>Communication with faculty</h3>
              <form onSubmit={handleSendMessage} className="form-grid" style={{ marginBottom: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}><label>Subject</label><input value={messageForm.subject} onChange={(e) => setMessageForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject" /></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Message</label><textarea value={messageForm.body} onChange={(e) => setMessageForm((f) => ({ ...f, body: e.target.value }))} placeholder="Your message to faculty" rows={3} required /></div>
                <div><button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send message'}</button></div>
              </form>
              <div className="table-wrap">
                <h4>Messages</h4>
                {messages.length === 0 ? <p>No messages yet.</p> : (
                  <ul className="message-list">
                    {messages.map((m) => (
                      <li key={m.id} className={m.from_user_id === user?.id ? 'message-sent' : 'message-received'}>
                        <span className="message-meta">{(m.created_at || '').slice(0, 16)} · {String(m.from_user_id) === String(user?.id) ? 'You' : 'Faculty'}</span>
                        <strong>{m.subject}</strong>
                        <p>{m.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
