import React, { useState, useEffect } from 'react';
import api from '../api';

export default function Attendance() {
  const [tab, setTab] = useState('daily');
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Daily
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyProgram, setDailyProgram] = useState('B.Pharm');
  const [dailySemester, setDailySemester] = useState('1');
  const [dailyRecords, setDailyRecords] = useState([]);
  const [dailySubjectId, setDailySubjectId] = useState('');
  const [saving, setSaving] = useState(false);

  // Subject-wise
  const [swSubjectId, setSwSubjectId] = useState('');
  const [swDateFrom, setSwDateFrom] = useState('');
  const [swDateTo, setSwDateTo] = useState('');
  const [swData, setSwData] = useState(null);

  // Monthly
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportProgram, setReportProgram] = useState('B.Pharm');
  const [reportSemester, setReportSemester] = useState('1');
  const [monthlyData, setMonthlyData] = useState(null);

  // Shortage
  const [alertMonth, setAlertMonth] = useState(new Date().toISOString().slice(0, 7));
  const [alertThreshold, setAlertThreshold] = useState(75);
  const [alerts, setAlerts] = useState(null);

  // Period-wise: 1-based period, theory | lab
  const [dailyPeriod, setDailyPeriod] = useState(1);
  const [dailySlotType, setDailySlotType] = useState('theory');

  // Semester report
  const [semDateFrom, setSemDateFrom] = useState('');
  const [semDateTo, setSemDateTo] = useState('');
  const [semProgram, setSemProgram] = useState('B.Pharm');
  const [semSemester, setSemSemester] = useState('1');
  const [semesterData, setSemesterData] = useState(null);

  // Defaulter list
  const [defMonth, setDefMonth] = useState(new Date().toISOString().slice(0, 7));
  const [defThreshold, setDefThreshold] = useState(75);
  const [defaulters, setDefaulters] = useState(null);

  // Absent alerts
  const [absentAlerts, setAbsentAlerts] = useState(null);
  const [alertRecordStudent, setAlertRecordStudent] = useState('');
  const [alertRecordDate, setAlertRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [alertRecordChannel, setAlertRecordChannel] = useState('app');

  // Staff attendance
  const [staffList, setStaffList] = useState([]);
  const [staffPunchStaffId, setStaffPunchStaffId] = useState('');
  const [staffPunchType, setStaffPunchType] = useState('IN');
  const [staffRecords, setStaffRecords] = useState([]);
  const [staffListDate, setStaffListDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffListFilterId, setStaffListFilterId] = useState('');
  const [geoConfig, setGeoConfig] = useState(null);

  useEffect(() => {
    api.courses.list().then((d) => setSubjects(Array.isArray(d) ? d : [])).catch(() => {});
    api.students.list(false).then((d) => setStudents(Array.isArray(d) ? d : [])).catch(() => {});
    api.staff.list().then((d) => setStaffList(Array.isArray(d) ? d : [])).catch(() => {});
    api.attendance.staff.geoConfig().then((d) => setGeoConfig(d)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'daily') return;
    setLoading(true);
    api.attendance
      .daily(dailyDate, dailyProgram || undefined, dailySemester || undefined)
      .then((r) => setDailyRecords(r.records || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, dailyDate, dailyProgram, dailySemester]);

  const loadSubjectWise = () => {
    if (!swSubjectId) return;
    setLoading(true);
    api.attendance
      .subjectWise(swSubjectId, swDateFrom || undefined, swDateTo || undefined)
      .then(setSwData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadMonthly = () => {
    setLoading(true);
    api.attendance
      .monthlyReport(reportMonth, reportProgram || undefined, reportSemester || undefined)
      .then(setMonthlyData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadAlerts = () => {
    setLoading(true);
    api.attendance
      .shortageAlerts(alertMonth, alertThreshold)
      .then(setAlerts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const filteredStudents = students.filter((s) => (dailyProgram ? (s.course || '').trim() === dailyProgram : true) && (dailySemester ? String(s.semester) === String(dailySemester) : true));

  const getStatus = (studentId) => {
    const r = dailyRecords.find((x) => String(x.student_id) === String(studentId));
    return r ? (r.status || 'present') : null;
  };

  const setStatus = async (studentId, status) => {
    setSaving(true);
    setError('');
    try {
      const existing = dailyRecords.find((x) => String(x.student_id) === String(studentId));
      const payload = {
        student_id: studentId,
        date: dailyDate,
        status,
        subject_id: dailySubjectId || undefined,
        source: 'manual',
        period_number: dailyPeriod || undefined,
        slot_type: dailySlotType || 'theory',
      };
      if (existing && existing.id) await api.attendance.update(existing.id, { status, period_number: dailyPeriod, slot_type: dailySlotType });
      else await api.attendance.create(payload);
      const res = await api.attendance.daily(dailyDate, dailyProgram || undefined, dailySemester || undefined);
      setDailyRecords(res.records || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadSemesterReport = () => {
    if (!semDateFrom || !semDateTo) return;
    setLoading(true);
    api.attendance
      .semesterReport(semDateFrom, semDateTo, semProgram || undefined, semSemester || undefined)
      .then(setSemesterData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadDefaulters = () => {
    setLoading(true);
    api.attendance
      .defaulterList({ month: defMonth, threshold: defThreshold })
      .then((d) => setDefaulters(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadAbsentAlerts = () => {
    api.attendance.alertsAbsentList(null, null, 50).then((r) => setAbsentAlerts(r.alerts || [])).catch(() => {});
  };

  const recordAbsentAlert = () => {
    if (!alertRecordStudent) return;
    api.attendance
      .recordAbsentAlert({ student_id: alertRecordStudent, date: alertRecordDate, channel: alertRecordChannel })
      .then(() => { setAlertRecordStudent(''); loadAbsentAlerts(); })
      .catch((e) => setError(e.message));
  };

  const loadStaffAttendance = () => {
    api.attendance.staff
      .list(staffListDate, staffListFilterId || undefined, 100)
      .then((r) => setStaffRecords(r.records || []))
      .catch((e) => setError(e.message));
  };

  const staffPunch = async () => {
    if (!staffPunchStaffId) return;
    setSaving(true);
    setError('');
    let lat = null, lng = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        if (pos?.coords) { lat = pos.coords.latitude; lng = pos.coords.longitude; }
      } catch (_) {}
    }
    try {
      await api.attendance.staff.punch({
        staff_id: staffPunchStaffId,
        punch_type: staffPunchType,
        lat,
        lng,
        timestamp: new Date().toISOString(),
        source: lat != null ? 'gps' : 'manual',
      });
      loadStaffAttendance();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const bulkSave = async () => {
    setSaving(true);
    setError('');
    const records = filteredStudents.map((s) => ({
      student_id: s.id,
      date: dailyDate,
      status: getStatus(s.id) || 'present',
      subject_id: dailySubjectId || '',
      period_number: dailyPeriod,
      slot_type: dailySlotType,
    }));
    try {
      const res = await api.attendance.bulk({ records });
      const r = await api.attendance.daily(dailyDate, dailyProgram || undefined, dailySemester || undefined);
      setDailyRecords(r.records || []);
      setError('');
      alert(`Bulk save: ${res.created} records created.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'daily', label: 'Daily (period-wise)' },
    { id: 'subject', label: 'Subject-wise' },
    { id: 'monthly', label: 'Monthly report' },
    { id: 'semester', label: 'Semester report' },
    { id: 'shortage', label: 'Shortage alerts' },
    { id: 'defaulters', label: 'Defaulter list' },
    { id: 'alerts', label: 'Absent alerts' },
    { id: 'staff', label: 'Staff IN/OUT' },
    { id: 'biometric', label: 'Biometric (ready)' },
  ];

  return (
    <div>
      <h2 className="page-title">Attendance</h2>
      <p className="dashboard-welcome">Period-wise & lab attendance, bulk upload, monthly/semester reports, defaulter list, absent alerts (App/SMS), staff GPS punch IN/OUT.</p>
      {error && <p className="form-error">{error}</p>}

      <div className="profile-tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Date</label>
            <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} />
            <label>Program</label>
            <select value={dailyProgram} onChange={(e) => setDailyProgram(e.target.value)}>
              <option value="">All</option>
              <option value="B.Pharm">B.Pharm</option>
              <option value="D.Pharm">D.Pharm</option>
            </select>
            <label>Semester</label>
            <select value={dailySemester} onChange={(e) => setDailySemester(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
            <label>Subject (optional)</label>
            <select value={dailySubjectId} onChange={(e) => setDailySubjectId(e.target.value)}>
              <option value="">—</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label>Period</label>
            <select value={dailyPeriod} onChange={(e) => setDailyPeriod(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>Period {n}</option>
              ))}
            </select>
            <label>Type</label>
            <select value={dailySlotType} onChange={(e) => setDailySlotType(e.target.value)}>
              <option value="theory">Theory</option>
              <option value="lab">Lab</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={bulkSave} disabled={saving}>Bulk save this list</button>
          </div>
          <div className="table-wrap">
            {loading ? (
              <p>Loading…</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Course</th>
                    <th>Semester</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => {
                    const status = getStatus(s.id);
                    return (
                      <tr key={s.id}>
                        <td>{s.roll_no}</td>
                        <td>{s.name}</td>
                        <td>{s.course}</td>
                        <td>{s.semester}</td>
                        <td>
                          <button type="button" className={`btn btn-small ${status === 'present' ? 'btn-primary' : ''}`} onClick={() => setStatus(s.id, 'present')} disabled={saving}>P</button>
                          <button type="button" className={`btn btn-small ${status === 'absent' ? 'btn-danger' : ''}`} onClick={() => setStatus(s.id, 'absent')} disabled={saving}>A</button>
                          {status != null && <span className="attendance-badge">{status}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'subject' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Subject</label>
            <select value={swSubjectId} onChange={(e) => setSwSubjectId(e.target.value)}>
              <option value="">Select</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <label>From</label>
            <input type="date" value={swDateFrom} onChange={(e) => setSwDateFrom(e.target.value)} />
            <label>To</label>
            <input type="date" value={swDateTo} onChange={(e) => setSwDateTo(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={loadSubjectWise} disabled={!swSubjectId || loading}>Load</button>
          </div>
          {swData && (
            <div className="table-wrap">
              <h3>{swData.subject_name || 'Subject'} – Subject-wise attendance</h3>
              <table>
                <thead><tr><th>Date</th><th>Roll No</th><th>Name</th><th>Status</th></tr></thead>
                <tbody>
                  {(swData.records || []).map((r) => (
                    <tr key={r.id}><td>{r.date}</td><td>{r.roll_no}</td><td>{r.student_name}</td><td>{r.status}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'monthly' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Month</label>
            <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
            <label>Program</label>
            <select value={reportProgram} onChange={(e) => setReportProgram(e.target.value)}>
              <option value="">All</option>
              <option value="B.Pharm">B.Pharm</option>
              <option value="D.Pharm">D.Pharm</option>
            </select>
            <label>Semester</label>
            <select value={reportSemester} onChange={(e) => setReportSemester(e.target.value)}>
              <option value="">All</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={loadMonthly} disabled={loading}>Generate report</button>
          </div>
          {monthlyData && (
            <div className="table-wrap">
              <h3>Monthly report – {monthlyData.month} (working days: {monthlyData.working_days})</h3>
              <table>
                <thead><tr><th>Roll No</th><th>Name</th><th>Course</th><th>Present</th><th>Absent</th><th>Total</th><th>%</th></tr></thead>
                <tbody>
                  {(monthlyData.students || []).map((s) => (
                    <tr key={s.student_id}>
                      <td>{s.roll_no}</td>
                      <td>{s.student_name}</td>
                      <td>{s.course}</td>
                      <td>{s.present}</td>
                      <td>{s.absent}</td>
                      <td>{s.total_days}</td>
                      <td>{s.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'semester' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>From</label>
            <input type="date" value={semDateFrom} onChange={(e) => setSemDateFrom(e.target.value)} />
            <label>To</label>
            <input type="date" value={semDateTo} onChange={(e) => setSemDateTo(e.target.value)} />
            <label>Program</label>
            <select value={semProgram} onChange={(e) => setSemProgram(e.target.value)}>
              <option value="">All</option>
              <option value="B.Pharm">B.Pharm</option>
              <option value="D.Pharm">D.Pharm</option>
            </select>
            <label>Semester</label>
            <select value={semSemester} onChange={(e) => setSemSemester(e.target.value)}>
              <option value="">All</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary" onClick={loadSemesterReport} disabled={!semDateFrom || !semDateTo || loading}>Generate</button>
          </div>
          {semesterData && (
            <div className="table-wrap">
              <h3>Semester report – {semesterData.date_from} to {semesterData.date_to}</h3>
              <table>
                <thead><tr><th>Roll No</th><th>Name</th><th>Course</th><th>Present</th><th>Absent</th><th>Total</th><th>%</th></tr></thead>
                <tbody>
                  {(semesterData.students || []).map((s) => (
                    <tr key={s.student_id}>
                      <td>{s.roll_no}</td>
                      <td>{s.student_name}</td>
                      <td>{s.course}</td>
                      <td>{s.present}</td>
                      <td>{s.absent}</td>
                      <td>{s.total_days}</td>
                      <td>{s.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'defaulters' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Month</label>
            <input type="month" value={defMonth} onChange={(e) => setDefMonth(e.target.value)} />
            <label>Threshold %</label>
            <input type="number" min={0} max={100} value={defThreshold} onChange={(e) => setDefThreshold(Number(e.target.value))} />
            <button type="button" className="btn btn-primary" onClick={loadDefaulters} disabled={loading}>Load defaulters</button>
          </div>
          {defaulters != null && (
            <div className="table-wrap">
              <h3>Defaulter list – below {defaulters.threshold}% ({defaulters.count} students)</h3>
              {defaulters.count === 0 ? (
                <p>No defaulters.</p>
              ) : (
                <table>
                  <thead><tr><th>Roll No</th><th>Name</th><th>Course</th><th>Present</th><th>Absent</th><th>%</th></tr></thead>
                  <tbody>
                    {(defaulters.defaulters || []).map((s) => (
                      <tr key={s.student_id} className="shortage-row">
                        <td>{s.roll_no}</td>
                        <td>{s.student_name}</td>
                        <td>{s.course}</td>
                        <td>{s.present}</td>
                        <td>{s.absent}</td>
                        <td><strong>{s.percentage}%</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'alerts' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Student</label>
            <select value={alertRecordStudent} onChange={(e) => setAlertRecordStudent(e.target.value)}>
              <option value="">Select to record alert</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.roll_no} – {s.name}</option>
              ))}
            </select>
            <label>Date</label>
            <input type="date" value={alertRecordDate} onChange={(e) => setAlertRecordDate(e.target.value)} />
            <label>Channel</label>
            <select value={alertRecordChannel} onChange={(e) => setAlertRecordChannel(e.target.value)}>
              <option value="app">App</option>
              <option value="sms">SMS</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={recordAbsentAlert} disabled={!alertRecordStudent}>Record alert sent</button>
            <button type="button" className="btn btn-secondary" onClick={loadAbsentAlerts}>Refresh list</button>
          </div>
          <div className="table-wrap">
            <h3>Absent alerts (App/SMS) log</h3>
            <button type="button" className="btn btn-small" onClick={loadAbsentAlerts}>Load</button>
            {absentAlerts && (
              <table>
                <thead><tr><th>Date</th><th>Student ID</th><th>Channel</th><th>Sent at</th></tr></thead>
                <tbody>
                  {absentAlerts.map((a) => (
                    <tr key={a.id}><td>{a.date}</td><td>{a.student_id}</td><td>{a.channel}</td><td>{a.sent_at ? new Date(a.sent_at).toLocaleString() : ''}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'staff' && (
        <>
          <div className="page-header attendance-staff-punch" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Staff</label>
            <select value={staffPunchStaffId} onChange={(e) => setStaffPunchStaffId(e.target.value)}>
              <option value="">Select staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
              ))}
            </select>
            <label>Punch</label>
            <select value={staffPunchType} onChange={(e) => setStaffPunchType(e.target.value)}>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
            <button type="button" className="btn btn-primary" onClick={staffPunch} disabled={!staffPunchStaffId || saving}>Punch {staffPunchType}</button>
            {geoConfig?.enabled && <span className="badge badge-info">Geo-fence enabled</span>}
          </div>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Date</label>
            <input type="date" value={staffListDate} onChange={(e) => setStaffListDate(e.target.value)} />
            <label>Staff filter</label>
            <select value={staffListFilterId} onChange={(e) => setStaffListFilterId(e.target.value)}>
              <option value="">All</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={loadStaffAttendance}>Load records</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Staff</th><th>IN/OUT</th><th>Time</th><th>GPS</th></tr></thead>
              <tbody>
                {staffRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.staff_name || r.staff_id}</td>
                    <td>{r.punch_type}</td>
                    <td>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ''}</td>
                    <td>{r.lat != null ? 'Yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'shortage' && (
        <>
          <div className="page-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <label>Month</label>
            <input type="month" value={alertMonth} onChange={(e) => setAlertMonth(e.target.value)} />
            <label>Threshold %</label>
            <input type="number" min={0} max={100} value={alertThreshold} onChange={(e) => setAlertThreshold(Number(e.target.value))} />
            <button type="button" className="btn btn-primary" onClick={loadAlerts} disabled={loading}>Check alerts</button>
          </div>
          {alerts != null && (
            <div className="table-wrap">
              <h3>Attendance shortage alerts – below {alerts.threshold}% in {alerts.month}</h3>
              {alerts.count === 0 ? (
                <p>No students below threshold.</p>
              ) : (
                <table>
                  <thead><tr><th>Roll No</th><th>Name</th><th>Course</th><th>Present</th><th>Absent</th><th>%</th></tr></thead>
                  <tbody>
                    {(alerts.alerts || []).map((s) => (
                      <tr key={s.student_id} className="shortage-row">
                        <td>{s.roll_no}</td>
                        <td>{s.student_name}</td>
                        <td>{s.course}</td>
                        <td>{s.present}</td>
                        <td>{s.absent}</td>
                        <td><strong>{s.percentage}%</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'biometric' && (
        <div className="table-wrap biometric-card">
          <h3>Biometric integration ready</h3>
          <p>Use the API to record punches from biometric devices.</p>
          <p><strong>Endpoint:</strong> <code>POST /api/attendance/biometric</code></p>
          <p><strong>Body:</strong></p>
          <pre>{`{
  "student_id": "1",
  "timestamp": "2025-03-15T09:30:00",
  "device_id": "DEVICE-001"
}`}</pre>
          <p>Marks the student <strong>present</strong> for the date derived from <code>timestamp</code>. Duplicate punch for same student+date updates the record. Integrate your device to call this endpoint (e.g. via middleware or device SDK).</p>
        </div>
      )}
    </div>
  );
}
