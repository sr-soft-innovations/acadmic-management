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
  LineChart,
  Line,
} from 'recharts';
import api from '../api';

const CHART_COLORS = ['#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#42a5f5', '#64b5f6'];

export default function AnalyticsCharts() {
  const [feeAnalytics, setFeeAnalytics] = useState(null);
  const [departmentComparison, setDepartmentComparison] = useState(null);
  const [strength, setStrength] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.fees.analytics().catch(() => null),
      api.dashboard.departmentComparison().catch(() => null),
      api.dashboard.studentStrength().catch(() => null),
    ]).then(([fee, dept, str]) => {
      setFeeAnalytics(fee);
      setDepartmentComparison(dept);
      setStrength(str);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading...</p>;
  if (error) return <p className="form-error">{error}</p>;

  const byCourseData = strength?.by_course
    ? Object.entries(strength.by_course).map(([name, count]) => ({ name, count, students: count }))
    : [];
  const byCourseFees = departmentComparison?.by_course
    ? Object.entries(departmentComparison.by_course).map(([name, v]) => ({
        name,
        students: v.students || 0,
        fees: (v.fees || 0) / 1000,
      }))
    : [];
  const byDeptData = departmentComparison?.by_department
    ? Object.entries(departmentComparison.by_department).map(([name, v]) => ({
        name,
        staff: v.staff || 0,
        courses: v.courses || 0,
      }))
    : [];
  const byMonthData = feeAnalytics?.by_month
    ? Object.entries(feeAnalytics.by_month).map(([month, amount]) => ({ month, amount: amount / 1000 }))
    : [];
  const byFeeTypeData = feeAnalytics?.by_fee_type
    ? Object.entries(feeAnalytics.by_fee_type).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div>
      <h2 className="page-title">Graphs & charts</h2>
      <p className="dashboard-welcome">Analytics and department comparison.</p>

      <div className="charts-grid">
        {byCourseData.length > 0 && (
          <div className="chart-block">
            <h4>Students by course</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byCourseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" fill={CHART_COLORS[0]} name="Students" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {byFeeTypeData.length > 0 && (
          <div className="chart-block">
            <h4>Fee collection by type</h4>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={byFeeTypeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(e) => `${e.name}: ₹${(e.value / 1000).toFixed(0)}k`}
                >
                  {byFeeTypeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `₹${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {byMonthData.length > 0 && (
          <div className="chart-block chart-wide">
            <h4>Fee collection by month (₹ in thousands)</h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={byMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => `₹${v}k`} />
                <Line type="monotone" dataKey="amount" stroke={CHART_COLORS[0]} name="Amount (₹k)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {byDeptData.length > 0 && (
          <div className="chart-block chart-wide">
            <h4>Department comparison (staff & courses)</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byDeptData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="staff" fill={CHART_COLORS[0]} name="Staff" />
                <Bar dataKey="courses" fill={CHART_COLORS[2]} name="Courses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {byCourseFees.length > 0 && (
          <div className="chart-block chart-wide">
            <h4>Course comparison (students & fees ₹k)</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byCourseFees} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(v, name) => (name === 'fees' ? `₹${v}k` : v)} />
                <Legend />
                <Bar yAxisId="left" dataKey="students" fill={CHART_COLORS[0]} name="Students" />
                <Bar yAxisId="right" dataKey="fees" fill={CHART_COLORS[2]} name="Fees (₹k)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {(byCourseData.length === 0 && byDeptData.length === 0 && byFeeTypeData.length === 0) && (
        <p className="placeholder-text">No chart data available yet.</p>
      )}
    </div>
  );
}
