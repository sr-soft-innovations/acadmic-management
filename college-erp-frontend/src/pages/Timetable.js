import React, { useState, useEffect } from 'react';
import api from '../api';

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_LABELS = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

export default function Timetable() {
  const [tab, setTab] = useState('class');
  const [slots, setSlots] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [staff, setStaff] = useState([]);
  const [clashes, setClashes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterProgram, setFilterProgram] = useState('B.Pharm');
  const [filterSemester, setFilterSemester] = useState('1');
  const [filterStaffId, setFilterStaffId] = useState('');
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);

  // Holidays, versions, suggest
  const [holidays, setHolidays] = useState([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [versions, setVersions] = useState([]);
  const [suggested, setSuggested] = useState([]);

  const loadSlots = () => {
    setLoading(true);
    const staffId = tab === 'faculty' ? filterStaffId || undefined : undefined;
    const slotType = tab === 'labs' ? 'lab' : undefined;
    const program = tab === 'faculty' ? undefined : (filterProgram || undefined);
    const semester = tab === 'faculty' ? undefined : (filterSemester || undefined);
    api.timetable
      .list(program, semester, null, staffId, slotType)
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadClashes = () => {
    api.timetable.clashes().then(setClashes).catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (tab === 'clashes') {
      loadClashes();
      return;
    }
    if (tab === 'holidays') {
      api.timetable.holidays().then((r) => setHolidays(r.holidays || [])).catch(() => {});
      return;
    }
    if (tab === 'versions') {
      api.timetable.versions().then((r) => setVersions(r.versions || [])).catch(() => {});
      return;
    }
    if (tab === 'suggest') {
      api.timetable.suggest(filterProgram, filterSemester).then((r) => setSuggested(r.suggested || [])).catch(() => {});
      return;
    }
    if (tab === 'faculty' && !filterStaffId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    loadSlots();
  }, [tab, filterProgram, filterSemester, filterStaffId]);

  useEffect(() => {
    Promise.all([
      api.courses.list().then((data) => setSubjects(Array.isArray(data) ? data : [])),
      api.staff.list().then((data) => setStaff(Array.isArray(data) ? data : [])),
    ]).catch(() => {});
  }, []);

  const timeSlots = [...new Set(slots.map((s) => `${s.slot_start}-${s.slot_end}`))].sort();
  const grid = {};
  DAYS.forEach((d) => {
    timeSlots.forEach((t) => {
      grid[`${d}-${t}`] = slots.find((s) => s.day_of_week === d && `${s.slot_start}-${s.slot_end}` === t);
    });
  });

  const openCreate = (defaultType = 'theory') => {
    setForm({
      day_of_week: 1,
      slot_start: defaultType === 'lab' ? '14:00' : '09:00',
      slot_end: defaultType === 'lab' ? '17:00' : '10:00',
      subject_id: '',
      staff_id: '',
      room: '',
      program: filterProgram,
      semester: filterSemester,
      slot_type: defaultType === 'extra' ? 'extra' : defaultType,
      lab_batch: '',
      is_extra: defaultType === 'extra',
      slot_date: '',
    });
    setEditId(null);
  };

  const openEdit = (slot) => {
    if (!slot) return;
    setForm({
      day_of_week: slot.day_of_week,
      slot_start: slot.slot_start,
      slot_end: slot.slot_end,
      subject_id: slot.subject_id,
      staff_id: slot.staff_id,
      room: slot.room || '',
      program: slot.program || '',
      semester: slot.semester || '',
      slot_type: slot.slot_type || 'theory',
      lab_batch: slot.lab_batch || '',
      is_extra: slot.is_extra || slot.slot_type === 'extra',
      slot_date: slot.slot_date || '',
    });
    setEditId(slot.id);
  };

  const save = async () => {
    if (!form) return;
    try {
      const payload = {
        ...form,
        slot_type: form.is_extra ? 'extra' : (form.slot_type || 'theory'),
        is_extra: !!form.is_extra,
        slot_date: (form.slot_date || '').trim() || undefined,
      };
      if (editId) await api.timetable.update(editId, payload);
      else await api.timetable.create(payload);
      setForm(null);
      if (tab === 'clashes') loadClashes();
      else loadSlots();
    } catch (e) {
      setError(e.message);
    }
  };

  const addHoliday = () => {
    if (!holidayDate) return;
    api.timetable
      .createHoliday({ date: holidayDate.slice(0, 10), name: holidayName })
      .then(() => {
        setHolidayDate('');
        setHolidayName('');
        api.timetable.holidays().then((r) => setHolidays(r.holidays || []));
      })
      .catch((e) => setError(e.message));
  };

  const deleteHoliday = (id) => {
    if (!window.confirm('Remove this holiday?')) return;
    api.timetable.deleteHoliday(id).then(() => api.timetable.holidays().then((r) => setHolidays(r.holidays || []))).catch((e) => setError(e.message));
  };

  const createVersion = () => {
    api.timetable.createVersion().then(() => api.timetable.versions().then((r) => setVersions(r.versions || []))).catch((e) => setError(e.message));
  };

  const restoreVersion = (id) => {
    if (!window.confirm('Replace current timetable with this version? This cannot be undone.')) return;
    api.timetable.restoreVersion(id).then(() => { loadSlots(); api.timetable.versions().then((r) => setVersions(r.versions || [])); }).catch((e) => setError(e.message));
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this slot?')) return;
    try {
      await api.timetable.delete(id);
      if (tab === 'clashes') loadClashes();
      else loadSlots();
    } catch (e) {
      setError(e.message);
    }
  };

  const tabs = [
    { id: 'class', label: 'Class timetable' },
    { id: 'faculty', label: 'Faculty timetable' },
    { id: 'labs', label: 'Lab scheduling' },
    { id: 'holidays', label: 'Holidays' },
    { id: 'versions', label: 'Version history' },
    { id: 'suggest', label: 'Auto-suggest' },
    { id: 'clashes', label: 'Clash detection' },
  ];

  const renderGrid = () => {
    if (timeSlots.length === 0)
      return <p>No slots.{tab === 'labs' ? ' Add a lab slot above.' : ' Add a slot above.'}</p>;
    return (
      <table className="timetable-grid">
        <thead>
          <tr>
            <th>Time</th>
            {DAYS.map((d) => (
              <th key={d}>{DAY_LABELS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((t) => (
            <tr key={t}>
              <td className="timetable-time">{t.replace('-', ' – ')}</td>
              {DAYS.map((d) => {
                const slot = grid[`${d}-${t}`];
                return (
                  <td key={d} className="timetable-cell">
                    {slot ? (
                      <div className="timetable-slot" onClick={() => openEdit(slot)} title="Click to edit">
                        {slot.slot_type === 'lab' && <span className="timetable-slot-type">Lab</span>}
                        {(slot.slot_type === 'extra' || slot.is_extra) && <span className="timetable-slot-type timetable-extra">Extra</span>}
                        <strong>{slot.subject_name}</strong>
                        <span>{slot.staff_name}</span>
                        {slot.room && <span className="timetable-room">{slot.room}</span>}
                        {slot.lab_batch && <span className="timetable-lab-batch">{slot.lab_batch}</span>}
                        <button type="button" className="btn btn-small btn-danger timetable-slot-remove" onClick={(e) => { e.stopPropagation(); remove(slot.id); }}>×</button>
                      </div>
                    ) : (
                      <span className="timetable-empty">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <h2 className="page-title">Timetable</h2>
      <p className="dashboard-welcome">Class timetable, faculty view, lab scheduling, holidays, version history, auto-suggest and clash detection.</p>
      {error && <p className="form-error">{error}</p>}

      <div className="profile-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'class' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Program</label>
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
              <option value="">All</option>
              <option value="B.Pharm">B.Pharm</option>
              <option value="D.Pharm">D.Pharm</option>
            </select>
            <label>Semester</label>
            <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => openCreate('theory')}>Add slot</button>
            <button type="button" className="btn btn-secondary" onClick={() => openCreate('extra')}>Add extra class</button>
          </div>
          <div className="table-wrap timetable-grid-wrap">{loading ? <p>Loading…</p> : renderGrid()}</div>
        </>
      )}

      {tab === 'faculty' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Faculty</label>
            <select value={filterStaffId} onChange={(e) => setFilterStaffId(e.target.value)}>
              <option value="">Select faculty</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} – {s.designation}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap timetable-grid-wrap">
            {!filterStaffId ? <p>Select a faculty to view their timetable.</p> : loading ? <p>Loading…</p> : renderGrid()}
          </div>
        </>
      )}

      {tab === 'labs' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Program</label>
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
              <option value="">All</option>
              <option value="B.Pharm">B.Pharm</option>
              <option value="D.Pharm">D.Pharm</option>
            </select>
            <label>Semester</label>
            <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => openCreate('lab')}>Add lab slot</button>
          </div>
          <div className="table-wrap timetable-grid-wrap">{loading ? <p>Loading…</p> : renderGrid()}</div>
        </>
      )}

      {tab === 'holidays' && (
        <div className="table-wrap">
          <h3>Holiday blocking</h3>
          <p className="dashboard-welcome">Dates marked as holidays block extra-class scheduling.</p>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Date</label>
            <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} />
            <label>Name</label>
            <input type="text" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="e.g. Diwali" />
            <button type="button" className="btn btn-primary" onClick={addHoliday} disabled={!holidayDate}>Add holiday</button>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Name</th><th></th></tr></thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}><td>{h.date}</td><td>{h.name || '—'}</td><td><button type="button" className="btn btn-small btn-danger" onClick={() => deleteHoliday(h.id)}>Remove</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'versions' && (
        <div className="table-wrap">
          <h3>Version history</h3>
          <p className="dashboard-welcome">Save a snapshot of the current timetable or restore a previous version.</p>
          <button type="button" className="btn btn-primary" onClick={createVersion} style={{ marginBottom: '1rem' }}>Save current as version</button>
          <table>
            <thead><tr><th>Saved at</th><th>Slots</th><th></th></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>{v.created_at ? new Date(v.created_at).toLocaleString() : v.id}</td>
                  <td>{(v.slots || []).length}</td>
                  <td><button type="button" className="btn btn-small" onClick={() => restoreVersion(v.id)}>Restore</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'suggest' && (
        <div className="table-wrap">
          <h3>Auto-suggest slots</h3>
          <p className="dashboard-welcome">Suggested (subject, faculty) from subject–faculty mapping. Use these to add slots manually.</p>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Program</label>
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
              <option value="">All</option>
              <option value="B.Pharm">B.Pharm</option>
              <option value="D.Pharm">D.Pharm</option>
            </select>
            <label>Semester</label>
            <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </div>
          <table>
            <thead><tr><th>Subject</th><th>Faculty</th><th>Program</th><th>Semester</th><th>Action</th></tr></thead>
            <tbody>
              {suggested.map((s, i) => (
                <tr key={i}>
                  <td>{s.subject_name}</td>
                  <td>{s.staff_name}</td>
                  <td>{s.program}</td>
                  <td>{s.semester}</td>
                  <td><button type="button" className="btn btn-small" onClick={() => { setTab('class'); setForm({ day_of_week: 1, slot_start: '09:00', slot_end: '10:00', subject_id: s.subject_id, staff_id: s.staff_id, room: '', program: s.program || filterProgram, semester: s.semester || filterSemester, slot_type: 'theory', lab_batch: '', is_extra: false, slot_date: '' }); setEditId(null); }}>Add slot</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'clashes' && (
        <div className="table-wrap">
          <button type="button" className="btn btn-small" onClick={loadClashes} style={{ marginBottom: '1rem' }}>Refresh clashes</button>
          {clashes == null ? (
            <p>Loading…</p>
          ) : (
            <>
              <h3>Faculty clashes (same person, overlapping times)</h3>
              {(clashes.faculty_clashes || []).length === 0 ? (
                <p>No faculty clashes detected.</p>
              ) : (
                <ul className="clash-list">
                  {(clashes.faculty_clashes || []).map((c, i) => (
                    <li key={`f-${i}`} className="clash-item clash-faculty">
                      <strong>{c.staff_name || c.staff_id}</strong>: {c.slot_a?.day_name} {c.slot_a?.slot_start}-{c.slot_a?.slot_end} ({c.slot_a?.subject_name}, {c.slot_a?.room}) vs {c.slot_b?.day_name} {c.slot_b?.slot_start}-{c.slot_b?.slot_end} ({c.slot_b?.subject_name}, {c.slot_b?.room})
                      <button type="button" className="btn btn-small" onClick={() => openEdit(c.slot_a)}>Edit slot A</button>
                      <button type="button" className="btn btn-small" onClick={() => openEdit(c.slot_b)}>Edit slot B</button>
                    </li>
                  ))}
                </ul>
              )}
              <h3 style={{ marginTop: '1.5rem' }}>Room clashes (same room, overlapping times)</h3>
              {(clashes.room_clashes || []).length === 0 ? (
                <p>No room clashes detected.</p>
              ) : (
                <ul className="clash-list">
                  {(clashes.room_clashes || []).map((c, i) => (
                    <li key={`r-${i}`} className="clash-item clash-room">
                      <strong>Room {c.room}</strong>: {c.slot_a?.day_name} {c.slot_a?.slot_start}-{c.slot_a?.slot_end} ({c.slot_a?.subject_name}) vs {c.slot_b?.slot_start}-{c.slot_b?.slot_end} ({c.slot_b?.subject_name})
                      <button type="button" className="btn btn-small" onClick={() => openEdit(c.slot_a)}>Edit slot A</button>
                      <button type="button" className="btn btn-small" onClick={() => openEdit(c.slot_b)}>Edit slot B</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {form && (
        <div className="modal">
          <h3>{editId ? 'Edit' : 'New'} slot {form.slot_type === 'lab' ? '(Lab)' : form.is_extra ? '(Extra class)' : ''}</h3>
          <div className="form-grid">
            <div><label>Type</label><select value={form.is_extra ? 'extra' : form.slot_type} onChange={(e) => { const v = e.target.value; setForm({ ...form, slot_type: v === 'extra' ? 'extra' : v, is_extra: v === 'extra' }); }}><option value="theory">Theory</option><option value="lab">Lab</option><option value="extra">Extra class</option></select></div>
            {form.is_extra && <div><label>Date (extra class)</label><input type="date" value={form.slot_date} onChange={(e) => setForm({ ...form, slot_date: e.target.value })} placeholder="YYYY-MM-DD" /></div>}
            <div><label>Day</label><select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value, 10) })}>{DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}</select></div>
            <div><label>Start</label><input type="time" value={form.slot_start} onChange={(e) => setForm({ ...form, slot_start: e.target.value })} /></div>
            <div><label>End</label><input type="time" value={form.slot_end} onChange={(e) => setForm({ ...form, slot_end: e.target.value })} /></div>
            <div><label>Subject</label><select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required><option value="">Select</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label>Faculty</label><select value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} required><option value="">Select</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label>Room</label><input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder={form.slot_type === 'lab' ? 'e.g. Lab 201' : ''} /></div>
            {form.slot_type === 'lab' && <div><label>Lab batch</label><input value={form.lab_batch} onChange={(e) => setForm({ ...form, lab_batch: e.target.value })} placeholder="e.g. Batch A" /></div>}
            <div><label>Program</label><input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} /></div>
            <div><label>Semester</label><input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} /></div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={save}>Save</button>
            <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
