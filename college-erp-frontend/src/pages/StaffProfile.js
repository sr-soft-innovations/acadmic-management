import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './Staff.css';

const ROLES = ['Faculty', 'HOD', 'Principal', 'Lab Assistant', 'Guest Faculty', 'Visiting', 'Substitute'];
const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid'];

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [staff, setStaff] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [appraisals, setAppraisals] = useState([]);
  const [publications, setPublications] = useState([]);
  const [resignation, setResignation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');
  const [editForm, setEditForm] = useState(null);
  const [leaveForm, setLeaveForm] = useState(null);
  const [appraisalForm, setAppraisalForm] = useState(null);
  const [pubForm, setPubForm] = useState(null);
  const [resignForm, setResignForm] = useState(null);
  const canWrite = hasPermission('staff:write');

  const load = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.staff.get(id).then(setStaff).catch(() => setStaff(null)),
      api.staff.workload(id).then(setWorkload).catch(() => setWorkload(null)),
      api.subjectFaculty.list(undefined, id).then((d) => setSubjects(Array.isArray(d) ? d : [])),
      api.staff.leaveRequests(id).then((r) => setLeaveRequests(r.leave_requests || [])),
      api.staff.appraisals(id).then((r) => setAppraisals(r.appraisals || [])),
      api.staff.publications(id).then((r) => setPublications(r.publications || [])),
      api.staff.resignation(id).then((r) => setResignation(r.resignation || null)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'qualification', label: 'Qualification & experience' },
    { id: 'subjects', label: 'Subject assignment' },
    { id: 'workload', label: 'Workload' },
    { id: 'leave', label: 'Leave' },
    { id: 'appraisal', label: 'Appraisal' },
    { id: 'publications', label: 'Research & publications' },
    { id: 'exit', label: 'Exit / Resignation' },
  ];

  const handleSaveProfile = async () => {
    if (!editForm || !id) return;
    try {
      await api.staff.update(id, editForm);
      setStaff((s) => (s ? { ...s, ...editForm } : null));
      setEditForm(null);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm) return;
    try {
      await api.staff.createLeaveRequest({ ...leaveForm, staff_id: id });
      setLeaveForm(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSubmitAppraisal = async (e) => {
    e.preventDefault();
    if (!appraisalForm) return;
    try {
      await api.staff.createAppraisal({ ...appraisalForm, staff_id: id });
      setAppraisalForm(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSubmitPublication = async (e) => {
    e.preventDefault();
    if (!pubForm) return;
    try {
      await api.staff.createPublication({ ...pubForm, staff_id: id });
      setPubForm(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSubmitResignation = async (e) => {
    e.preventDefault();
    if (!resignForm) return;
    try {
      await api.staff.createResignation({ ...resignForm, staff_id: id });
      setResignForm(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading && !staff) return <p className="loading">Loading...</p>;
  if (!staff) return <div><button type="button" className="btn" onClick={() => navigate('/staff')}>← Back</button><p>Staff not found.</p></div>;

  return (
    <div className="staff-page staff-profile">
      <div className="page-header">
        <button type="button" className="btn" onClick={() => navigate('/staff')}>← Back</button>
        <h2 className="page-title">{staff.name} – Staff profile</h2>
      </div>
      <div className="profile-tabs">
        {sections.map((s) => (
          <button key={s.id} type="button" className={activeSection === s.id ? 'active' : ''} onClick={() => setActiveSection(s.id)}>{s.label}</button>
        ))}
      </div>

      {activeSection === 'profile' && (
        <section className="profile-section">
          {editForm ? (
            <>
              <h3>Edit profile</h3>
              <div className="form-grid">
                <div><label>Name</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                <div><label>Designation</label><input value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} /></div>
                <div><label>Department</label><input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} /></div>
                <div><label>Role</label><select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><label>Email</label><input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                <div><label>Phone</label><input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                <div><label>Date of joining</label><input type="date" value={editForm.date_of_joining} onChange={(e) => setEditForm({ ...editForm, date_of_joining: e.target.value })} /></div>
              </div>
              <div className="form-actions"><button type="button" className="btn-primary" onClick={handleSaveProfile}>Save</button><button type="button" className="btn" onClick={() => setEditForm(null)}>Cancel</button></div>
            </>
          ) : (
            <>
              <h3>Profile</h3>
              <table className="info-table">
                <tbody>
                  <tr><td className="label">Name</td><td>{staff.name}</td></tr>
                  <tr><td className="label">Designation</td><td>{staff.designation || '—'}</td></tr>
                  <tr><td className="label">Department</td><td>{staff.department || '—'}</td></tr>
                  <tr><td className="label">Role</td><td>{staff.role || 'Faculty'}</td></tr>
                  <tr><td className="label">Email</td><td>{staff.email || '—'}</td></tr>
                  <tr><td className="label">Phone</td><td>{staff.phone || '—'}</td></tr>
                  <tr><td className="label">Date of joining</td><td>{staff.date_of_joining || '—'}</td></tr>
                  <tr><td className="label">Type</td><td>{staff.is_substitute ? 'Substitute' : staff.is_guest_faculty ? 'Guest / Visiting' : 'Regular'}</td></tr>
                </tbody>
              </table>
              {canWrite && <button type="button" className="btn" onClick={() => setEditForm({ name: staff.name, designation: staff.designation, department: staff.department, role: staff.role, email: staff.email, phone: staff.phone, date_of_joining: staff.date_of_joining })}>Edit</button>}
            </>
          )}
        </section>
      )}

      {activeSection === 'qualification' && (
        <section className="profile-section">
          <h3>Qualification & experience</h3>
          <h4>Qualifications</h4>
          {(!staff.qualifications || staff.qualifications.length === 0) ? <p className="placeholder-text">None added</p> : (
            <ul>{staff.qualifications.map((q, i) => <li key={i}>{q.degree} – {q.institution} ({q.year})</li>)}</ul>
          )}
          <h4>Experience</h4>
          {(!staff.experience || staff.experience.length === 0) ? <p className="placeholder-text">None added</p> : (
            <ul>{staff.experience.map((e, i) => <li key={i}>{e.role} at {e.organization} ({e.from_year} – {e.to_year})</li>)}</ul>
          )}
          <p className="form-muted">Edit from Staff list to add qualifications and experience.</p>
        </section>
      )}

      {activeSection === 'subjects' && (
        <section className="profile-section">
          <h3>Subject assignment</h3>
          <p><Link to="/subject-faculty">Subject–Faculty mapping</Link> – assign this faculty to subjects.</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Subject</th></tr></thead>
              <tbody>
                {subjects.length === 0 ? <tr><td>No subjects assigned</td></tr> : subjects.map((m) => <tr key={m.id}><td>{m.subject_name || m.subject_id}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === 'workload' && (
        <section className="profile-section">
          <h3>Workload tracking</h3>
          {workload ? (
            <>
              <p><strong>Total slots per week:</strong> {workload.total_slots} · <strong>Est. hours/week:</strong> {workload.total_hours_per_week}</p>
              <p>By subject: {Object.entries(workload.by_subject || {}).map(([k, v]) => `${k} (${v})`).join(', ') || '—'}</p>
              <p><Link to="/timetable">View timetable</Link> (filter by faculty on that page)</p>
            </>
          ) : (
            <p className="placeholder-text">No timetable slots. Assign in Timetable.</p>
          )}
        </section>
      )}

      {activeSection === 'leave' && (
        <section className="profile-section">
          <h3>Leave requests</h3>
          {!leaveForm ? (
            canWrite && <button type="button" className="btn-primary" onClick={() => setLeaveForm({ from_date: '', to_date: '', leave_type: 'casual', reason: '' })}>New leave request</button>
          ) : (
            <form onSubmit={handleSubmitLeave}>
              <div className="form-grid">
                <div><label>From date</label><input type="date" value={leaveForm.from_date} onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })} required /></div>
                <div><label>To date</label><input type="date" value={leaveForm.to_date} onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })} required /></div>
                <div><label>Type</label><select value={leaveForm.leave_type} onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>{LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Reason</label><input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} /></div>
              </div>
              <div className="form-actions"><button type="submit" className="btn-primary">Submit</button><button type="button" className="btn" onClick={() => setLeaveForm(null)}>Cancel</button></div>
            </form>
          )}
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table>
              <thead><tr><th>From</th><th>To</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {leaveRequests.length === 0 ? <tr><td colSpan={4}>No leave requests</td></tr> : leaveRequests.map((r) => <tr key={r.id}><td>{r.from_date}</td><td>{r.to_date}</td><td>{r.leave_type}</td><td><span className={`status-badge status-${r.status}`}>{r.status}</span></td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === 'appraisal' && (
        <section className="profile-section">
          <h3>Appraisal & performance</h3>
          {!appraisalForm ? (
            canWrite && <button type="button" className="btn-primary" onClick={() => setAppraisalForm({ period: '', rating: '', remarks: '', goals_achieved: '' })}>Add appraisal</button>
          ) : (
            <form onSubmit={handleSubmitAppraisal}>
              <div className="form-grid">
                <div><label>Period</label><input value={appraisalForm.period} onChange={(e) => setAppraisalForm({ ...appraisalForm, period: e.target.value })} placeholder="e.g. 2024-2025" /></div>
                <div><label>Rating</label><input type="number" step="0.1" value={appraisalForm.rating} onChange={(e) => setAppraisalForm({ ...appraisalForm, rating: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Remarks</label><input value={appraisalForm.remarks} onChange={(e) => setAppraisalForm({ ...appraisalForm, remarks: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Goals achieved</label><input value={appraisalForm.goals_achieved} onChange={(e) => setAppraisalForm({ ...appraisalForm, goals_achieved: e.target.value })} /></div>
              </div>
              <div className="form-actions"><button type="submit" className="btn-primary">Save</button><button type="button" className="btn" onClick={() => setAppraisalForm(null)}>Cancel</button></div>
            </form>
          )}
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table>
              <thead><tr><th>Period</th><th>Rating</th><th>Remarks</th></tr></thead>
              <tbody>
                {appraisals.length === 0 ? <tr><td colSpan={3}>No appraisals</td></tr> : appraisals.map((a) => <tr key={a.id}><td>{a.period}</td><td>{a.rating}</td><td>{a.remarks}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === 'publications' && (
        <section className="profile-section">
          <h3>Research & publications</h3>
          {!pubForm ? (
            canWrite && <button type="button" className="btn-primary" onClick={() => setPubForm({ title: '', journal_or_conference: '', year: '', type: 'journal' })}>Add publication</button>
          ) : (
            <form onSubmit={handleSubmitPublication}>
              <div className="form-grid">
                <div style={{ gridColumn: '1 / -1' }}><label>Title</label><input value={pubForm.title} onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })} /></div>
                <div><label>Journal / Conference</label><input value={pubForm.journal_or_conference} onChange={(e) => setPubForm({ ...pubForm, journal_or_conference: e.target.value })} /></div>
                <div><label>Year</label><input value={pubForm.year} onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })} /></div>
                <div><label>Type</label><select value={pubForm.type} onChange={(e) => setPubForm({ ...pubForm, type: e.target.value })}><option value="journal">Journal</option><option value="conference">Conference</option><option value="book">Book</option><option value="patent">Patent</option></select></div>
              </div>
              <div className="form-actions"><button type="submit" className="btn-primary">Save</button><button type="button" className="btn" onClick={() => setPubForm(null)}>Cancel</button></div>
            </form>
          )}
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table>
              <thead><tr><th>Title</th><th>Journal / Conference</th><th>Year</th><th>Type</th></tr></thead>
              <tbody>
                {publications.length === 0 ? <tr><td colSpan={4}>No publications</td></tr> : publications.map((p) => <tr key={p.id}><td>{p.title}</td><td>{p.journal_or_conference}</td><td>{p.year}</td><td>{p.type}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSection === 'exit' && (
        <section className="profile-section">
          <h3>Exit / Resignation workflow</h3>
          {resignation ? (
            <div className="table-wrap">
              <table className="info-table">
                <tbody>
                  <tr><td className="label">Status</td><td><span className={`status-badge status-${resignation.status}`}>{resignation.status}</span></td></tr>
                  <tr><td className="label">Notice date</td><td>{resignation.notice_date || '—'}</td></tr>
                  <tr><td className="label">Last working date</td><td>{resignation.last_working_date || '—'}</td></tr>
                  <tr><td className="label">Reason</td><td>{resignation.reason || '—'}</td></tr>
                </tbody>
              </table>
            </div>
          ) : !resignForm ? (
            canWrite && <button type="button" className="btn-primary" onClick={() => setResignForm({ last_working_date: '', reason: '', notice_date: '' })}>Submit resignation</button>
          ) : (
            <form onSubmit={handleSubmitResignation}>
              <div className="form-grid">
                <div><label>Notice date</label><input type="date" value={resignForm.notice_date} onChange={(e) => setResignForm({ ...resignForm, notice_date: e.target.value })} /></div>
                <div><label>Last working date</label><input type="date" value={resignForm.last_working_date} onChange={(e) => setResignForm({ ...resignForm, last_working_date: e.target.value })} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label>Reason</label><input value={resignForm.reason} onChange={(e) => setResignForm({ ...resignForm, reason: e.target.value })} /></div>
              </div>
              <div className="form-actions"><button type="submit" className="btn-primary">Submit</button><button type="button" className="btn" onClick={() => setResignForm(null)}>Cancel</button></div>
            </form>
          )}
          <p><Link to="/staff/resignations">View all resignations →</Link></p>
        </section>
      )}
    </div>
  );
}
