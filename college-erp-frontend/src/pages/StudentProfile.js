import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [student, setStudent] = useState(null);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('profile');
  const [editProfile, setEditProfile] = useState(null);
  const [issueCert, setIssueCert] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [tcRequests, setTcRequests] = useState([]);
  const [tcRequestForm, setTcRequestForm] = useState(null);
  const fileInputRef = useRef(null);
  const idCardRef = useRef(null);
  const canWrite = hasPermission('students:write');

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      api.students.get(id).then(setStudent).catch((e) => setError(e.message)),
      api.students.certificates(id).then((r) => setCertificates(r.certificates || [])).catch(() => setCertificates([])),
      api.students.tcRequests(id).then((r) => setTcRequests(r.tc_requests || [])).catch(() => setTcRequests([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSaveProfile = async () => {
    if (!editProfile || !id) return;
    try {
      await api.students.update(id, editProfile);
      setStudent((s) => (s ? { ...s, ...editProfile } : null));
      setEditProfile(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
  };

  const handlePhotoUpload = async () => {
    if (!photoFile || !id) return;
    setUploading(true);
    try {
      const res = await api.students.uploadPhoto(id, photoFile);
      setStudent((s) => (s ? { ...s, photo_filename: res.photo_filename || s.photo_filename } : null));
      setPhotoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleIssueCertificate = async (e) => {
    e.preventDefault();
    if (!issueCert || !id) return;
    try {
      const issued = await api.students.issueCertificate({
        student_id: id,
        type: issueCert.type,
        reference_no: issueCert.reference_no || '',
        remarks: issueCert.remarks || '',
      });
      setCertificates((c) => [...c, issued]);
      setIssueCert(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const printIdCard = () => {
    if (!idCardRef.current) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html><html><head><title>ID Card - ${student?.name}</title>
      <style>
        body { font-family: Arial,sans-serif; padding: 20px; }
        .id-card { border: 2px solid #E11B21; border-radius: 12px; padding: 24px; max-width: 380px; }
        .id-card h2 { margin: 0 0 8px 0; font-size: 1.25rem; }
        .id-card .photo { width: 90px; height: 110px; object-fit: cover; border-radius: 8px; background: #e2e8f0; }
        .id-card .row { display: flex; gap: 12px; margin-bottom: 8px; }
        .id-card .label { color: #64748b; min-width: 90px; }
      </style></head><body>
      ${idCardRef.current.innerHTML}
      </body></html>`);
    win.document.close();
    win.print();
    win.close();
  };

  if (loading || !student) {
    return (
      <div>
        <button type="button" className="btn btn-small" onClick={() => navigate('/students')}>← Back</button>
        {loading ? <p>Loading…</p> : error ? <p className="form-error">{error}</p> : <p>Student not found.</p>}
      </div>
    );
  }

  const photoUrl = student.photo_filename ? api.students.photoUrl(id) : null;

  const sections = [
    { id: 'profile', label: 'Profile' },
    { id: 'academic', label: 'Academic' },
    { id: 'guardian', label: 'Guardian' },
    { id: 'photo', label: 'Photo' },
    { id: 'certificates', label: 'Certificates' },
    { id: 'tc', label: 'TC / Exit' },
    { id: 'idcard', label: 'ID Card' },
  ];

  return (
    <div className="student-profile">
      <div className="page-header">
        <button type="button" className="btn btn-small" onClick={() => navigate('/students')}>← Back</button>
        <h2 className="page-title">{student.name} – Profile</h2>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="profile-tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={activeSection === s.id ? 'active' : ''}
            onClick={() => setActiveSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'profile' && (
        <section className="profile-section table-wrap">
          {editProfile ? (
            <>
              <h3>Edit profile</h3>
              <div className="form-grid">
                <div><label>Name</label><input value={editProfile.name} onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })} /></div>
                <div><label>Roll No</label><input value={editProfile.roll_no} onChange={(e) => setEditProfile({ ...editProfile, roll_no: e.target.value })} /></div>
                <div><label>DOB</label><input type="date" value={editProfile.date_of_birth} onChange={(e) => setEditProfile({ ...editProfile, date_of_birth: e.target.value })} /></div>
                <div><label>Gender</label><select value={editProfile.gender} onChange={(e) => setEditProfile({ ...editProfile, gender: e.target.value })}><option value="">—</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                <div><label>Blood group</label><input value={editProfile.blood_group} onChange={(e) => setEditProfile({ ...editProfile, blood_group: e.target.value })} placeholder="e.g. O+"/></div>
                <div><label>Email</label><input type="email" value={editProfile.email} onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })} /></div>
                <div><label>Phone</label><input value={editProfile.phone} onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })} /></div>
                <div><label>Address</label><input value={editProfile.address} onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })} /></div>
                <div><label>City</label><input value={editProfile.city} onChange={(e) => setEditProfile({ ...editProfile, city: e.target.value })} /></div>
                <div><label>State</label><input value={editProfile.state} onChange={(e) => setEditProfile({ ...editProfile, state: e.target.value })} /></div>
                <div><label>Pincode</label><input value={editProfile.pincode} onChange={(e) => setEditProfile({ ...editProfile, pincode: e.target.value })} /></div>
                <div><label>Category</label><select value={editProfile.category || ''} onChange={(e) => setEditProfile({ ...editProfile, category: e.target.value })}><option value="">—</option><option value="GEN">GEN</option><option value="OBC">OBC</option><option value="SC">SC</option><option value="ST">ST</option></select></div>
                <div><label>Batch</label><input value={editProfile.batch || ''} onChange={(e) => setEditProfile({ ...editProfile, batch: e.target.value })} /></div>
                <div><label>Section</label><input value={editProfile.section || ''} onChange={(e) => setEditProfile({ ...editProfile, section: e.target.value })} /></div>
                <div><label>Unique ID</label><input value={editProfile.unique_id || ''} onChange={(e) => setEditProfile({ ...editProfile, unique_id: e.target.value })} placeholder="Auto if empty" /></div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={handleSaveProfile}>Save</button>
                <button type="button" className="btn" onClick={() => setEditProfile(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h3>Personal details</h3>
              <table>
                <tbody>
                  <tr><td className="label">Name</td><td>{student.name}</td></tr>
                  <tr><td className="label">Roll No</td><td>{student.roll_no || '—'}</td></tr>
                  <tr><td className="label">DOB</td><td>{student.date_of_birth || '—'}</td></tr>
                  <tr><td className="label">Gender</td><td>{student.gender || '—'}</td></tr>
                  <tr><td className="label">Blood group</td><td>{student.blood_group || '—'}</td></tr>
                  <tr><td className="label">Email</td><td>{student.email || '—'}</td></tr>
                  <tr><td className="label">Phone</td><td>{student.phone || '—'}</td></tr>
                  <tr><td className="label">Address</td><td>{[student.address, student.city, student.state, student.pincode].filter(Boolean).join(', ') || '—'}</td></tr>
                </tbody>
              </table>
              {canWrite && <button type="button" className="btn btn-small" onClick={() => setEditProfile({ name: student.name, roll_no: student.roll_no, date_of_birth: student.date_of_birth, gender: student.gender, blood_group: student.blood_group, email: student.email, phone: student.phone, address: student.address, city: student.city, state: student.state, pincode: student.pincode, category: student.category, batch: student.batch, section: student.section, unique_id: student.unique_id })}>Edit</button>}
            </>
          )}
        </section>
      )}

      {activeSection === 'academic' && (
        <section className="profile-section table-wrap">
          <>
            <h3>Academic details</h3>
            <table>
              <tbody>
                <tr><td className="label">Course</td><td>{student.course || '—'}</td></tr>
                <tr><td className="label">Semester</td><td>{student.semester || '—'}</td></tr>
                <tr><td className="label">Category</td><td>{student.category || '—'}</td></tr>
                <tr><td className="label">Batch</td><td>{student.batch || '—'}</td></tr>
                <tr><td className="label">Section</td><td>{student.section || '—'}</td></tr>
                <tr><td className="label">Unique ID</td><td>{student.unique_id || student.id || '—'}</td></tr>
                <tr><td className="label">Admission date</td><td>{student.admission_date || '—'}</td></tr>
                <tr><td className="label">Academic year</td><td>{student.academic_year || '—'}</td></tr>
                <tr><td className="label">Previous school</td><td>{student.previous_school || '—'}</td></tr>
                <tr><td className="label">Board</td><td>{student.board || '—'}</td></tr>
              </tbody>
            </table>
          </>
        </section>
      )}

      {activeSection === 'guardian' && (
        <section className="profile-section table-wrap">
          <h3>Guardian details</h3>
          <table>
            <tbody>
              <tr><td className="label">Name</td><td>{student.guardian_name || '—'}</td></tr>
              <tr><td className="label">Relation</td><td>{student.guardian_relation || '—'}</td></tr>
              <tr><td className="label">Phone</td><td>{student.guardian_phone || '—'}</td></tr>
              <tr><td className="label">Email</td><td>{student.guardian_email || '—'}</td></tr>
              <tr><td className="label">Occupation</td><td>{student.guardian_occupation || '—'}</td></tr>
              <tr><td className="label">Address</td><td>{student.guardian_address || '—'}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      {activeSection === 'photo' && (
        <section className="profile-section">
          <h3>Photo</h3>
          <div className="student-photo-box">
            {photoUrl ? (
              <img src={`${photoUrl}?t=${Date.now()}`} alt={student.name} className="student-photo" />
            ) : (
              <div className="student-photo-placeholder">No photo</div>
            )}
            {canWrite && (
              <div className="photo-upload">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                <button type="button" className="btn btn-small" onClick={() => fileInputRef.current?.click()}>Choose file</button>
                {photoFile && (
                  <>
                    <span>{photoFile.name}</span>
                    <button type="button" className="btn btn-small btn-primary" onClick={handlePhotoUpload} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {activeSection === 'tc' && (
        <section className="profile-section">
          <h3>TC / Exit process</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Requested</th><th>Status</th><th>Reason</th>{canWrite && <th>Action</th>}</tr></thead>
              <tbody>
                {tcRequests.length === 0 ? <tr><td colSpan={canWrite ? 4 : 3}>No TC requests</td></tr> : tcRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.requested_at || '—'}</td>
                    <td><span className={`status-badge status-${r.status}`}>{r.status}</span></td>
                    <td>{r.reason || '—'}</td>
                    {canWrite && (
                      <td>
                        {r.status === 'pending' && (
                          <>
                            <button type="button" className="btn btn-small" onClick={() => api.students.updateTcRequest(r.id, { status: 'approved' }).then(load)}>Approve</button>
                            <button type="button" className="btn btn-small" onClick={() => api.students.updateTcRequest(r.id, { status: 'rejected' }).then(load)}>Reject</button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button type="button" className="btn btn-small btn-primary" onClick={() => { setIssueCert({ type: 'transfer', reference_no: `TC-${r.id}`, remarks: 'TC issued' }); setActiveSection('certificates'); }}>Issue TC</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canWrite && !tcRequestForm && (
            <button type="button" className="btn btn-small" onClick={() => setTcRequestForm({ reason: '', remarks: '' })}>Create TC request (admin)</button>
          )}
          {tcRequestForm && (
            <form onSubmit={async (e) => { e.preventDefault(); await api.students.createTcRequest(id, tcRequestForm); setTcRequestForm(null); load(); }} className="form-grid" style={{ marginTop: '1rem' }}>
              <div><label>Reason</label><input value={tcRequestForm.reason} onChange={(e) => setTcRequestForm({ ...tcRequestForm, reason: e.target.value })} /></div>
              <div><label>Remarks</label><input value={tcRequestForm.remarks} onChange={(e) => setTcRequestForm({ ...tcRequestForm, remarks: e.target.value })} /></div>
              <div><button type="submit" className="btn btn-primary">Submit TC request</button><button type="button" className="btn" onClick={() => setTcRequestForm(null)}>Cancel</button></div>
            </form>
          )}
        </section>
      )}

      {activeSection === 'certificates' && (
        <section className="profile-section">
          <h3>Certificates</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Reference</th><th>Issued date</th></tr></thead>
              <tbody>
                {certificates.length === 0 ? <tr><td colSpan="3">No certificates issued yet.</td></tr> : certificates.map((c) => (
                  <tr key={c.id || c.issued_date + c.type}><td>{c.type}</td><td>{c.reference_no || '—'}</td><td>{c.issued_date}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {canWrite && (
            <div style={{ marginTop: '1rem' }}>
              {!issueCert ? (
                <button type="button" className="btn btn-primary" onClick={() => setIssueCert({ type: 'transfer', reference_no: '', remarks: '' })}>Issue certificate</button>
              ) : (
                <form onSubmit={handleIssueCertificate} className="form-grid">
                  <div>
                    <label>Type</label>
                    <select value={issueCert.type} onChange={(e) => setIssueCert({ ...issueCert, type: e.target.value })}>
                      <option value="transfer">Transfer certificate</option>
                      <option value="bonafide">Bonafide certificate</option>
                    </select>
                  </div>
                  <div><label>Reference no</label><input value={issueCert.reference_no} onChange={(e) => setIssueCert({ ...issueCert, reference_no: e.target.value })} /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label>Remarks</label><input value={issueCert.remarks} onChange={(e) => setIssueCert({ ...issueCert, remarks: e.target.value })} /></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <button type="submit" className="btn btn-primary">Issue</button>
                    <button type="button" className="btn" onClick={() => setIssueCert(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {activeSection === 'idcard' && (
        <section className="profile-section">
          <h3>Student ID card (QR)</h3>
          <div ref={idCardRef} className="id-card-preview">
            <div className="id-card">
              <div className="id-card-row">
                {photoUrl ? <img src={`${photoUrl}?t=${Date.now()}`} alt="" className="id-card-photo" /> : <div className="id-card-photo-placeholder">Photo</div>}
                <div>
                  <h2>{student.name}</h2>
                  <p className="id-card-meta"><span className="label">Roll</span> {student.roll_no || '—'}</p>
                  <p className="id-card-meta"><span className="label">Course</span> {student.course || '—'} · Sem {student.semester || '—'}</p>
                  <p className="id-card-meta"><span className="label">Category</span> {student.category || '—'}</p>
                  <p className="id-card-meta"><span className="label">Blood</span> {student.blood_group || '—'}</p>
                </div>
                <div className="id-card-qr">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(student.unique_id || student.id || student.roll_no || '')}`} alt="QR" />
                  <span>Scan for ID</span>
                </div>
              </div>
              <p className="id-card-college">G.P. College of Pharmacy</p>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={printIdCard}>Print ID card</button>
        </section>
      )}
    </div>
  );
}
