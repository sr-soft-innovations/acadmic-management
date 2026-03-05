import React, { useState, useEffect } from 'react';
import api from '../api';

export default function Examinations() {
  const [tab, setTab] = useState('schedule');
  const [exams, setExams] = useState([]);
  const [examType, setExamType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(null);
  const [seatingList, setSeatingList] = useState([]);
  const [marksList, setMarksList] = useState([]);
  const [revaluationList, setRevaluationList] = useState([]);

  const loadSchedule = () => {
    setLoading(true);
    api.exams
      .schedule(dateFrom || undefined, dateTo || undefined, examType || undefined)
      .then((r) => setExams(r.schedule || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.students.list(false).then((d) => setStudents(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'schedule') loadSchedule();
  }, [tab]);

  useEffect(() => {
    if (tab === 'seating' && selectedExamId) {
      api.exams.seating(selectedExamId).then(setSeatingList).catch(() => setSeatingList([]));
    }
  }, [tab, selectedExamId]);

  useEffect(() => {
    if (tab === 'marks' && selectedExamId) {
      api.exams.marks(selectedExamId).then(setMarksList).catch(() => setMarksList([]));
    }
  }, [tab, selectedExamId]);

  useEffect(() => {
    if (tab === 'revaluation') {
      api.exams.revaluation().then(setRevaluationList).catch(() => setRevaluationList([]));
    }
  }, [tab]);

  const [allExams, setAllExams] = useState([]);
  useEffect(() => {
    if (['hallticket', 'seating', 'marks', 'publish', 'revaluation'].includes(tab)) {
      api.exams.list().then((d) => setAllExams(Array.isArray(d) ? d : [])).catch(() => setAllExams([]));
    }
  }, [tab]);
  const examListForSelect = (tab === 'schedule' ? exams : allExams).length ? (tab === 'schedule' ? exams : allExams) : [];
  const selectedExam = examListForSelect.find((e) => e.id === selectedExamId) || (selectedExamId ? { id: selectedExamId } : null);

  const tabs = [
    { id: 'schedule', label: 'Exam schedule' },
    { id: 'hallticket', label: 'Hall ticket' },
    { id: 'seating', label: 'Seating' },
    { id: 'marks', label: 'Marks entry' },
    { id: 'publish', label: 'Result publish' },
    { id: 'revaluation', label: 'Revaluation' },
  ];

  return (
    <div>
      <h2 className="page-title">Examination Management</h2>
      <p className="dashboard-welcome">Exam schedule (internal/external), hall tickets, seating, marks entry, result publish and revaluation.</p>
      {error && <p className="form-error">{error}</p>}

      <div className="profile-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Type</label>
            <select value={examType} onChange={(e) => setExamType(e.target.value)}>
              <option value="">All</option>
              <option value="internal">Internal</option>
              <option value="external">External</option>
            </select>
            <label>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <label>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={loadSchedule} disabled={loading}>Load schedule</button>
            <AddExamForm onAdded={loadSchedule} setError={setError} />
          </div>
          <div className="table-wrap">
            {loading ? <p>Loading…</p> : (
              <table>
                <thead><tr><th>Title</th><th>Type</th><th>Course</th><th>Date</th><th>Time</th><th>Room</th><th>Result</th></tr></thead>
                <tbody>
                  {exams.map((e) => (
                    <tr key={e.id}>
                      <td>{e.title}</td>
                      <td>{e.exam_type || 'internal'}</td>
                      <td>{e.course}</td>
                      <td>{e.exam_date}</td>
                      <td>{e.start_time}</td>
                      <td>{e.room}</td>
                      <td>{e.result_published ? 'Published' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'hallticket' && (
        <HallTicketTab examListForSelect={examListForSelect} students={students} selectedExamId={selectedExamId} setSelectedExamId={setSelectedExamId} />
      )}

      {tab === 'seating' && (
        <SeatingTab examListForSelect={examListForSelect} students={students} selectedExamId={selectedExamId} setSelectedExamId={setSelectedExamId} seatingList={seatingList} setSeatingList={setSeatingList} setError={setError} />
      )}

      {tab === 'marks' && (
        <MarksTab examListForSelect={examListForSelect} students={students} selectedExamId={selectedExamId} setSelectedExamId={setSelectedExamId} marksList={marksList} setMarksList={setMarksList} setError={setError} />
      )}

      {tab === 'publish' && (
        <PublishTab setError={setError} />
      )}

      {tab === 'revaluation' && (
        <RevaluationTab revaluationList={revaluationList} setRevaluationList={setRevaluationList} exams={examListForSelect} students={students} setError={setError} />
      )}
    </div>
  );
}

function AddExamForm({ onAdded, setError }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: '', course: 'B.Pharm', subject: '', exam_type: 'internal', exam_date: '', start_time: '09:00', duration_minutes: 180, room: '' });
  const save = async () => {
    try {
      await api.exams.create(form);
      setShow(false);
      setForm({ title: '', course: 'B.Pharm', subject: '', exam_type: 'internal', exam_date: '', start_time: '09:00', duration_minutes: 180, room: '' });
      onAdded?.();
    } catch (e) {
      setError?.(e.message);
    }
  };
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setShow(true)}>Add exam</button>
      {show && (
        <div className="modal">
          <h3>New exam</h3>
          <div className="form-grid">
            <div><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Type</label><select value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value })}><option value="internal">Internal</option><option value="external">External</option></select></div>
            <div><label>Course</label><input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /></div>
            <div><label>Subject</label><input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><label>Date</label><input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></div>
            <div><label>Start time</label><input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div><label>Duration (min)</label><input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
            <div><label>Room</label><input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
          </div>
          <button type="button" className="btn btn-primary" onClick={save}>Create</button>
          <button type="button" className="btn" onClick={() => setShow(false)}>Cancel</button>
        </div>
      )}
    </>
  );
}

function HallTicketTab({ examListForSelect, students, selectedExamId, setSelectedExamId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    if (examListForSelect.length && !selectedExamId) setSelectedExamId(examListForSelect[0].id);
  }, [examListForSelect]);

  const loadAll = () => {
    if (!selectedExamId) return;
    setLoading(true);
    api.exams.hallTickets(selectedExamId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  const loadOne = () => {
    if (!selectedExamId || !studentId) return;
    setLoading(true);
    api.exams.hallTicket(selectedExamId, studentId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  return (
    <>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <label>Exam</label>
        <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
          <option value="">Select exam</option>
          {examListForSelect.map((e) => (
            <option key={e.id} value={e.id}>{e.title} ({e.exam_date})</option>
          ))}
        </select>
        <label>Student (single)</label>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">—</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.roll_no} – {s.name}</option>
          ))}
        </select>
        <button type="button" className="btn" onClick={loadOne} disabled={!selectedExamId || !studentId || loading}>Get ticket</button>
        <button type="button" className="btn btn-primary" onClick={loadAll} disabled={!selectedExamId || loading}>List all tickets</button>
      </div>
      {data && (
        <div className="table-wrap">
          {data.hall_tickets ? (
            <table>
              <thead><tr><th>Student</th><th>Room</th><th>Row</th><th>Seat</th></tr></thead>
              <tbody>
                {data.hall_tickets.map((ht, i) => (
                  <tr key={i}>
                    <td>{ht.student?.name} ({ht.student?.roll_no})</td>
                    <td>{ht.room}</td>
                    <td>{ht.row}</td>
                    <td>{ht.seat_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="hall-ticket-preview">
              <h3>Hall ticket – {data.exam?.title}</h3>
              <p><strong>Student:</strong> {data.student?.name} ({data.student?.roll_no})</p>
              <p><strong>Room:</strong> {data.room} &nbsp; <strong>Row:</strong> {data.row} &nbsp; <strong>Seat:</strong> {data.seat_number}</p>
              <p><strong>Date:</strong> {data.exam?.exam_date} &nbsp; <strong>Time:</strong> {data.exam?.start_time}</p>
              <button type="button" className="btn btn-small" onClick={() => window.print()}>Print</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SeatingTab({ examListForSelect, students, selectedExamId, setSelectedExamId, seatingList, setSeatingList, setError }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (examListForSelect.length && !selectedExamId) setSelectedExamId(examListForSelect[0].id);
  }, [examListForSelect]);

  useEffect(() => {
    if (selectedExamId) api.exams.seating(selectedExamId).then(setSeatingList).catch(() => setSeatingList([]));
  }, [selectedExamId]);

  const addSeating = async () => {
    if (!form || !selectedExamId) return;
    try {
      await api.exams.addSeating({ exam_id: selectedExamId, student_id: form.student_id, room: form.room, row: form.row, seat_number: form.seat_number });
      setForm(null);
      api.exams.seating(selectedExamId).then(setSeatingList);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <label>Exam</label>
        <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
          <option value="">Select</option>
          {examListForSelect.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        {selectedExamId && <button type="button" className="btn btn-primary" onClick={() => setForm({ student_id: '', room: '', row: '', seat_number: '' })}>Add seat</button>}
      </div>
      {form && (
        <div className="modal">
          <h3>Assign seat</h3>
          <div className="form-grid">
            <div><label>Student</label><select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required><option value="">Select</option>{students.map((s) => <option key={s.id} value={s.id}>{s.roll_no} – {s.name}</option>)}</select></div>
            <div><label>Room</label><input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></div>
            <div><label>Row</label><input value={form.row} onChange={(e) => setForm({ ...form, row: e.target.value })} /></div>
            <div><label>Seat #</label><input value={form.seat_number} onChange={(e) => setForm({ ...form, seat_number: e.target.value })} /></div>
          </div>
          <button type="button" className="btn btn-primary" onClick={addSeating}>Save</button>
          <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Roll No</th><th>Name</th><th>Room</th><th>Row</th><th>Seat</th></tr></thead>
          <tbody>
            {seatingList.map((s) => (
              <tr key={s.id}><td>{s.roll_no}</td><td>{s.student_name}</td><td>{s.room}</td><td>{s.row}</td><td>{s.seat_number}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MarksTab({ examListForSelect, students, selectedExamId, setSelectedExamId, marksList, setMarksList, setError }) {
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (examListForSelect.length && !selectedExamId) setSelectedExamId(examListForSelect[0].id);
  }, [examListForSelect]);

  useEffect(() => {
    if (selectedExamId) api.exams.marks(selectedExamId).then(setMarksList).catch(() => setMarksList([]));
  }, [selectedExamId]);

  const saveMark = async () => {
    if (!editing || !selectedExamId) return;
    try {
      await api.exams.enterMarks({ exam_id: selectedExamId, student_id: editing.student_id, marks: Number(editing.marks), max_marks: Number(editing.max_marks) || 100 });
      setEditing(null);
      api.exams.marks(selectedExamId).then(setMarksList);
    } catch (e) {
      setError(e.message);
    }
  };

  const exam = examListForSelect.find((e) => e.id === selectedExamId);
  const filteredStudents = students.filter((s) => !exam || (s.course || '') === (exam.course || ''));

  return (
    <>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <label>Exam</label>
        <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
          <option value="">Select</option>
          {examListForSelect.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        {selectedExamId && <button type="button" className="btn btn-primary" onClick={() => setEditing({ student_id: filteredStudents[0]?.id || '', marks: '', max_marks: 100 })}>Add marks</button>}
      </div>
      {editing && (
        <div className="modal">
          <h3>Marks entry</h3>
          <div className="form-grid">
            <div><label>Student</label><select value={editing.student_id} onChange={(e) => setEditing({ ...editing, student_id: e.target.value })}><option value="">Select</option>{filteredStudents.map((s) => <option key={s.id} value={s.id}>{s.roll_no} – {s.name}</option>)}</select></div>
            <div><label>Marks</label><input type="number" value={editing.marks} onChange={(e) => setEditing({ ...editing, marks: e.target.value })} /></div>
            <div><label>Max</label><input type="number" value={editing.max_marks} onChange={(e) => setEditing({ ...editing, max_marks: e.target.value })} /></div>
          </div>
          <button type="button" className="btn btn-primary" onClick={saveMark}>Save</button>
          <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Roll No</th><th>Name</th><th>Marks</th><th>Max</th></tr></thead>
          <tbody>
            {marksList.map((m) => (
              <tr key={m.id}><td>{m.roll_no}</td><td>{m.student_name}</td><td>{m.marks}</td><td>{m.max_marks}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PublishTab({ setError }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    api.exams.list().then(setList).catch(() => setList([]));
  }, []);
  const publish = async (id) => {
    try {
      await api.exams.publishResult(id);
      api.exams.list().then(setList);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="table-wrap">
      <p>Publish result so that students can view. Once published, the exam is marked as result published.</p>
      <table>
        <thead><tr><th>Exam</th><th>Date</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id}>
              <td>{e.title}</td>
              <td>{e.exam_date}</td>
              <td>{e.result_published ? 'Published' : 'Not published'}</td>
              <td>{!e.result_published && <button type="button" className="btn btn-small btn-primary" onClick={() => publish(e.id)}>Publish result</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevaluationTab({ revaluationList, setRevaluationList, exams, students, setError }) {
  const [form, setForm] = useState(null);
  const [updateForm, setUpdateForm] = useState(null);

  useEffect(() => {
    api.exams.revaluation().then(setRevaluationList).catch(() => setRevaluationList([]));
  }, []);

  const submitRequest = async () => {
    if (!form) return;
    try {
      await api.exams.requestRevaluation({ student_id: form.student_id, exam_id: form.exam_id, current_marks: Number(form.current_marks), reason: form.reason });
      setForm(null);
      api.exams.revaluation().then(setRevaluationList);
    } catch (e) {
      setError(e.message);
    }
  };

  const saveUpdate = async () => {
    if (!updateForm) return;
    try {
      await api.exams.updateRevaluation(updateForm.id, { status: updateForm.status, revised_marks: updateForm.revised_marks != null ? Number(updateForm.revised_marks) : undefined, remarks: updateForm.remarks });
      setUpdateForm(null);
      api.exams.revaluation().then(setRevaluationList);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setForm({ student_id: '', exam_id: '', current_marks: '', reason: '' })} style={{ marginBottom: '1rem' }}>New revaluation request</button>
      {form && (
        <div className="modal">
          <h3>Request revaluation</h3>
          <div className="form-grid">
            <div><label>Student</label><select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required><option value="">Select</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label>Exam</label><select value={form.exam_id} onChange={(e) => setForm({ ...form, exam_id: e.target.value })} required><option value="">Select</option>{exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></div>
            <div><label>Current marks</label><input type="number" value={form.current_marks} onChange={(e) => setForm({ ...form, current_marks: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label>Reason</label><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <button type="button" className="btn btn-primary" onClick={submitRequest}>Submit</button>
          <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
        </div>
      )}
      {updateForm && (
        <div className="modal">
          <h3>Update revaluation</h3>
          <div className="form-grid">
            <div><label>Status</label><select value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
            <div><label>Revised marks</label><input type="number" value={updateForm.revised_marks ?? ''} onChange={(e) => setUpdateForm({ ...updateForm, revised_marks: e.target.value })} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label>Remarks</label><input value={updateForm.remarks} onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })} /></div>
          </div>
          <button type="button" className="btn btn-primary" onClick={saveUpdate}>Save</button>
          <button type="button" className="btn" onClick={() => setUpdateForm(null)}>Cancel</button>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Exam</th><th>Current marks</th><th>Status</th><th>Revised</th><th></th></tr></thead>
          <tbody>
            {revaluationList.map((r) => (
              <tr key={r.id}>
                <td>{r.student_name}</td>
                <td>{r.exam_title}</td>
                <td>{r.current_marks}</td>
                <td>{r.status}</td>
                <td>{r.revised_marks ?? '—'}</td>
                <td><button type="button" className="btn btn-small" onClick={() => setUpdateForm({ id: r.id, status: r.status, revised_marks: r.revised_marks, remarks: r.remarks })}>Update</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
