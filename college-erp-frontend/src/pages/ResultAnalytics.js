import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../api';
import './ResultAnalytics.css';

const CHART_COLORS = ['#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#42a5f5', '#64b5f6', '#90caf9'];

const TABS = [
  { id: 'gpa', label: 'GPA / CGPA' },
  { id: 'rank', label: 'Rank list' },
  { id: 'toppers', label: 'Topper list' },
  { id: 'pass', label: 'Pass percentage' },
  { id: 'subject', label: 'Subject performance' },
  { id: 'dept', label: 'Department comparison' },
];

export default function ResultAnalytics() {
  const [tab, setTab] = useState('gpa');
  const [semester, setSemester] = useState('');
  const [course, setCourse] = useState('');
  const [threshold, setThreshold] = useState(40);
  const [limit, setLimit] = useState(10);
  const [gpaList, setGpaList] = useState([]);
  const [cgpaList, setCgpaList] = useState([]);
  const [rankList, setRankList] = useState([]);
  const [toppers, setToppers] = useState([]);
  const [passPct, setPassPct] = useState(null);
  const [subjectPerf, setSubjectPerf] = useState([]);
  const [deptComparison, setDeptComparison] = useState({ by_course: [], by_department: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadGpa = () => {
    setLoading(true);
    setError('');
    api.results
      .gpa(semester || undefined, course || undefined)
      .then((r) => setGpaList(r.gpa_list || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadCgpa = () => {
    setLoading(true);
    setError('');
    api.results
      .cgpa(course || undefined)
      .then((r) => setCgpaList(r.cgpa_list || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadRank = () => {
    setLoading(true);
    setError('');
    api.results
      .rankList(semester || undefined, course || undefined, 100)
      .then((r) => setRankList(r.rank_list || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadToppers = () => {
    setLoading(true);
    setError('');
    api.results
      .toppers(semester || undefined, course || undefined, limit)
      .then((r) => setToppers(r.toppers || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadPassPct = () => {
    setLoading(true);
    setError('');
    api.results
      .passPercentage(semester || undefined, undefined, undefined, course || undefined, threshold)
      .then(setPassPct)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadSubjectPerf = () => {
    setLoading(true);
    setError('');
    api.results
      .subjectPerformance(semester || undefined, course || undefined)
      .then((r) => setSubjectPerf(r.subject_performance || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadDeptComparison = () => {
    setLoading(true);
    setError('');
    api.results
      .departmentComparison(semester || undefined)
      .then((r) =>
        setDeptComparison({
          by_course: r.by_course || [],
          by_department: r.by_department || [],
        })
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'gpa') {
      loadGpa();
      loadCgpa();
    } else if (tab === 'rank') loadRank();
    else if (tab === 'toppers') loadToppers();
    else if (tab === 'pass') loadPassPct();
    else if (tab === 'subject') loadSubjectPerf();
    else if (tab === 'dept') loadDeptComparison();
  }, [tab]);

  const refresh = () => {
    if (tab === 'gpa') {
      loadGpa();
      loadCgpa();
    } else if (tab === 'rank') loadRank();
    else if (tab === 'toppers') loadToppers();
    else if (tab === 'pass') loadPassPct();
    else if (tab === 'subject') loadSubjectPerf();
    else if (tab === 'dept') loadDeptComparison();
  };

  return (
    <div className="result-analytics">
      <h2 className="page-title">Result &amp; Analytics</h2>
      <p className="dashboard-welcome">GPA/CGPA, rank list, toppers, pass percentage, and performance charts.</p>

      <div className="result-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`result-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="result-filters">
        <label>
          Semester
          <input
            type="text"
            placeholder="e.g. 1"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          />
        </label>
        <label>
          Course
          <input
            type="text"
            placeholder="e.g. B.Pharm"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
        </label>
        {(tab === 'pass') && (
          <label>
            Pass threshold %
            <input
              type="number"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 40)}
            />
          </label>
        )}
        {(tab === 'toppers') && (
          <label>
            Top N
            <input
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 10)}
            />
          </label>
        )}
        <button type="button" className="btn-primary" onClick={refresh}>
          Apply / Refresh
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="loading">Loading...</p>}

      {!loading && tab === 'gpa' && (
        <div className="result-panels">
          <section className="result-panel">
            <h3>GPA by semester</h3>
            {gpaList.length === 0 ? (
              <p className="placeholder-text">No GPA data. Add semester filter and ensure marks have semester.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Semester</th>
                      <th>GPA</th>
                      <th>Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gpaList.map((r) => (
                      <tr key={`${r.student_id}-${r.semester}`}>
                        <td>{r.roll_no}</td>
                        <td>{r.student_name}</td>
                        <td>{r.course}</td>
                        <td>{r.semester}</td>
                        <td><strong>{r.gpa}</strong></td>
                        <td>{r.credits_total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="result-panel">
            <h3>CGPA (cumulative)</h3>
            {cgpaList.length === 0 ? (
              <p className="placeholder-text">No CGPA data.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th>Course</th>
                      <th>CGPA</th>
                      <th>Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cgpaList.map((r) => (
                      <tr key={r.student_id}>
                        <td>{r.roll_no}</td>
                        <td>{r.student_name}</td>
                        <td>{r.course}</td>
                        <td><strong>{r.cgpa}</strong></td>
                        <td>{r.credits_total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {!loading && tab === 'rank' && (
        <section className="result-panel">
          <h3>Rank list</h3>
          {rankList.length === 0 ? (
            <p className="placeholder-text">No rank data. Select semester/course and refresh.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Course</th>
                    <th>Semester</th>
                    <th>GPA</th>
                  </tr>
                </thead>
                <tbody>
                  {rankList.map((r) => (
                    <tr key={`${r.student_id}-${r.semester}`}>
                      <td><strong>{r.rank}</strong></td>
                      <td>{r.roll_no}</td>
                      <td>{r.student_name}</td>
                      <td>{r.course}</td>
                      <td>{r.semester}</td>
                      <td>{r.gpa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && tab === 'toppers' && (
        <section className="result-panel">
          <h3>Topper list</h3>
          {toppers.length === 0 ? (
            <p className="placeholder-text">No topper data.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Course</th>
                    <th>{toppers[0]?.semester != null ? 'Semester' : ''}</th>
                    <th>{toppers[0]?.gpa != null ? 'GPA' : 'CGPA'}</th>
                  </tr>
                </thead>
                <tbody>
                  {toppers.map((r) => (
                    <tr key={r.student_id}>
                      <td><strong>{r.rank}</strong></td>
                      <td>{r.roll_no}</td>
                      <td>{r.student_name}</td>
                      <td>{r.course}</td>
                      <td>{r.semester}</td>
                      <td><strong>{r.gpa ?? r.cgpa}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && tab === 'pass' && (
        <section className="result-panel">
          <h3>Pass percentage</h3>
          {passPct == null ? (
            <p className="placeholder-text">Click Apply to load.</p>
          ) : (
            <div className="pass-pct-cards">
              <div className="stat-card">
                <span className="stat-value">{passPct.pass_percentage}%</span>
                <span className="stat-label">Pass %</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{passPct.passed}</span>
                <span className="stat-label">Passed</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{passPct.failed}</span>
                <span className="stat-label">Failed</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{passPct.total}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
          )}
        </section>
      )}

      {!loading && tab === 'subject' && (
        <section className="result-panel">
          <h3>Subject performance</h3>
          {subjectPerf.length === 0 ? (
            <p className="placeholder-text">No subject data.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Total</th>
                      <th>Passed</th>
                      <th>Failed</th>
                      <th>Pass %</th>
                      <th>Avg marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectPerf.map((s) => (
                      <tr key={s.subject}>
                        <td>{s.subject}</td>
                        <td>{s.total_students}</td>
                        <td>{s.passed}</td>
                        <td>{s.failed}</td>
                        <td>{s.pass_percentage}%</td>
                        <td>{s.average_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chart-block">
                <h4>Pass % by subject</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={subjectPerf} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" angle={-25} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(v) => (typeof v === 'number' ? `${v}%` : v)} />
                    <Bar dataKey="pass_percentage" fill={CHART_COLORS[0]} name="Pass %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
      )}

      {!loading && tab === 'dept' && (
        <section className="result-panel">
          <h3>Department comparison (results)</h3>
          {(deptComparison.by_course.length === 0 && deptComparison.by_department.length === 0) ? (
            <p className="placeholder-text">No department/course result data.</p>
          ) : (
            <div className="charts-grid">
              {deptComparison.by_course.length > 0 && (
                <div className="chart-block">
                  <h4>By course (pass % &amp; avg marks)</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={deptComparison.by_course}
                      margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="average_marks" fill={CHART_COLORS[0]} name="Avg marks" />
                      <Bar yAxisId="right" dataKey="pass_percentage" fill={CHART_COLORS[2]} name="Pass %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {deptComparison.by_department.length > 0 && (
                <div className="chart-block">
                  <h4>By department (pass % &amp; avg marks)</h4>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={deptComparison.by_department}
                      margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="average_marks" fill={CHART_COLORS[1]} name="Avg marks" />
                      <Bar yAxisId="right" dataKey="pass_percentage" fill={CHART_COLORS[3]} name="Pass %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {deptComparison.by_course.length > 0 && (
                <div className="chart-block">
                  <h4>Pass % by course</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={deptComparison.by_course}
                        dataKey="pass_percentage"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(e) => `${e.name}: ${e.pass_percentage}%`}
                      >
                        {deptComparison.by_course.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
