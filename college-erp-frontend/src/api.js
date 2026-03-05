/**
 * REST API client for G.P. College of Pharmacy backend (JSON-backed).
 * Base URL: REACT_APP_API_URL (default http://localhost:8000)
 */
const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const SESSION_ID_KEY = 'college_erp_session_id';
const IMPERSONATE_USER_ID_KEY = 'college_erp_impersonate_user_id';

function getToken() {
  try {
    return localStorage.getItem('college_erp_token') || null;
  } catch {
    return null;
  }
}

function getSessionId() {
  try {
    return localStorage.getItem(SESSION_ID_KEY) || null;
  } catch {
    return null;
  }
}

function getImpersonateUserId() {
  try {
    return localStorage.getItem(IMPERSONATE_USER_ID_KEY) || null;
  } catch {
    return null;
  }
}

/** Headers for authenticated requests (session + optional impersonation). Use for fetch() when api.request() is not used. */
export function getAuthHeaders() {
  const h = {};
  const sid = getSessionId();
  const imp = getImpersonateUserId();
  if (sid) h['X-Session-Id'] = sid;
  if (imp) h['X-Impersonate-User-Id'] = imp;
  return h;
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const token = getToken();
  const sessionId = getSessionId();
  const impersonateUserId = getImpersonateUserId();
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (sessionId) headers['X-Session-Id'] = sessionId;
  if (impersonateUserId) headers['X-Impersonate-User-Id'] = impersonateUserId;
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(`Cannot connect to server. Is the backend running at ${BASE}? ${err.message || 'Network error.'}`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => d.msg || d).join(', ') : res.statusText || 'Request failed';
    if (res.status === 401) {
      localStorage.removeItem('college_erp_token');
      localStorage.removeItem('college_erp_user');
      try { localStorage.removeItem(IMPERSONATE_USER_ID_KEY); } catch (_) {}
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error(message || 'Session expired. Please login again.');
    }
    if (res.status === 423) throw new Error(data?.detail || 'Account locked. Try again later.');
    throw new Error(message);
  }
  return data;
}

const api = {
  health: () => request('/api/health'),
  dashboard: {
    stats: () => request('/api/dashboard/stats'),
    studentStrength: () => request('/api/dashboard/student-strength'),
    departmentComparison: () => request('/api/dashboard/department-comparison'),
    notifications: () => request('/api/dashboard/notifications'),
    calendar: () => request('/api/dashboard/calendar'),
    dailyOverview: (dateStr) =>
      request(`/api/dashboard/daily-overview${dateStr ? `?date_str=${encodeURIComponent(dateStr)}` : ''}`),
    recentActivity: (limit = 20) =>
      request(`/api/dashboard/recent-activity?limit=${limit}`),
    staffSummary: () => request('/api/dashboard/staff-summary'),
    attendanceTrend: (days = 7) => request(`/api/dashboard/attendance-trend?days=${days}`),
    admissionStats: () => request('/api/dashboard/admission-stats'),
    todaySummary: () => request('/api/dashboard/today-summary'),
    studentPersonal: () => request('/api/dashboard/student-personal'),
    parentPersonal: () => request('/api/dashboard/parent-personal'),
    staffPersonal: () => request('/api/dashboard/staff-personal'),
    hodPersonal: () => request('/api/dashboard/hod-personal'),
    upcomingInspections: () => request('/api/dashboard/upcoming-inspections'),
    superAdminSummary: () => request('/api/dashboard/super-admin-summary'),
  },
  reports: {
    summary: () => request('/api/reports/summary'),
  },
  exams: {
    list: (examType, course) => {
      let path = '/api/exams';
      const params = [];
      if (examType) params.push(`exam_type=${encodeURIComponent(examType)}`);
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    schedule: (dateFrom, dateTo, examType) => {
      let path = '/api/exams/schedule';
      const params = [];
      if (dateFrom) params.push(`date_from=${encodeURIComponent(dateFrom)}`);
      if (dateTo) params.push(`date_to=${encodeURIComponent(dateTo)}`);
      if (examType) params.push(`exam_type=${encodeURIComponent(examType)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    upcoming: (limit = 10, examType) => {
      let path = `/api/exams/upcoming?limit=${limit}`;
      if (examType) path += `&exam_type=${encodeURIComponent(examType)}`;
      return request(path);
    },
    get: (id) => request(`/api/exams/${id}`),
    create: (body) => request('/api/exams', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/exams/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/exams/${id}`, { method: 'DELETE' }),
    publishResult: (id) => request(`/api/exams/${id}/publish-result`, { method: 'POST' }),
    hallTicket: (examId, studentId) => request(`/api/exams/${examId}/hall-ticket/${studentId}`),
    hallTickets: (examId) => request(`/api/exams/${examId}/hall-tickets`),
    seating: (examId) => request(`/api/exams/${examId}/seating`),
    addSeating: (body) => request('/api/exams/seating', { method: 'POST', body: JSON.stringify(body) }),
    updateSeating: (id, body) => request(`/api/exams/seating/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteSeating: (id) => request(`/api/exams/seating/${id}`, { method: 'DELETE' }),
    marks: (examId) => request(`/api/exams/${examId}/marks`),
    enterMarks: (body) => request('/api/exams/marks', { method: 'POST', body: JSON.stringify(body) }),
    revaluation: (status) => {
      const path = status ? `/api/exams/revaluation?status=${encodeURIComponent(status)}` : '/api/exams/revaluation';
      return request(path);
    },
    requestRevaluation: (body) => request('/api/exams/revaluation', { method: 'POST', body: JSON.stringify(body) }),
    updateRevaluation: (id, body) => request(`/api/exams/revaluation/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  results: {
    gpa: (semester, course) => {
      let path = '/api/results/gpa';
      const params = [];
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    cgpa: (course) => {
      const path = course ? `/api/results/cgpa?course=${encodeURIComponent(course)}` : '/api/results/cgpa';
      return request(path);
    },
    rankList: (semester, course, limit) => {
      let path = '/api/results/rank-list';
      const params = [];
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (limit != null) params.push(`limit=${limit}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    toppers: (semester, course, limit) => {
      let path = '/api/results/toppers';
      const params = [];
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (limit != null) params.push(`limit=${limit}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    passPercentage: (semester, subjectId, examId, course, threshold) => {
      let path = '/api/results/pass-percentage';
      const params = [];
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      if (subjectId) params.push(`subject_id=${encodeURIComponent(subjectId)}`);
      if (examId) params.push(`exam_id=${encodeURIComponent(examId)}`);
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (threshold != null) params.push(`threshold=${threshold}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    subjectPerformance: (semester, course) => {
      let path = '/api/results/subject-performance';
      const params = [];
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    departmentComparison: (semester) => {
      const path = semester ? `/api/results/department-comparison?semester=${encodeURIComponent(semester)}` : '/api/results/department-comparison';
      return request(path);
    },
  },
  approvals: {
    list: () => request('/api/approvals'),
    pending: () => request('/api/approvals/pending'),
    create: (body) => request('/api/approvals', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, status, remarks) => request(`/api/approvals/${id}`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) }),
  },
  nav: () => request('/api/nav'),
  auth: {
    getPasswordPolicy: () => request('/api/auth/password-policy'),
    getMe: () => request('/api/auth/me'),
    updateMe: (body) => request('/api/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
    changeMyPassword: (currentPassword, newPassword) =>
      request('/api/auth/me/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }),
    getMyPhotoUrl: () => `${BASE}/api/auth/me/photo`,
    uploadMyPhoto: async (file) => {
      const sessionId = getSessionId();
      const impersonateUserId = getImpersonateUserId();
      const formData = new FormData();
      formData.append('file', file);
      const headers = {};
      if (sessionId) headers['X-Session-Id'] = sessionId;
      if (impersonateUserId) headers['X-Impersonate-User-Id'] = impersonateUserId;
      const res = await fetch(`${BASE}/api/auth/me/photo`, { method: 'POST', headers, body: formData });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error(data?.detail || text || 'Upload failed');
      return data;
    },
    listUsers: () => request('/api/auth/users'),
    createUser: (body) => request('/api/auth/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (userId, body) =>
      request(`/api/auth/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) }),
    setUserEnabled: (userId, enabled) =>
      request(`/api/auth/users/${userId}/enable`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    unlockUser: (userId) =>
      request(`/api/auth/users/${userId}/unlock`, { method: 'PATCH' }),
    impersonate: (userId) => request(`/api/auth/impersonate/${userId}`),
    impersonateStop: () => request('/api/auth/impersonate/stop'),
    login: (username, password, role, opts = {}) =>
      request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          role: opts.role ?? role ?? 'staff',
          remember_me: opts.rememberMe ?? false,
          captcha_token: opts.captchaToken ?? null,
          device_id: opts.deviceId ?? null,
          device_info: opts.deviceInfo ?? null,
        }),
      }),
    requestOtp: (email, phone) =>
      request('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: email || null, phone: phone || null }) }),
    verifyOtp: (email, phone, code, role, deviceId, deviceInfo) =>
      request('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, phone, code, role, device_id: deviceId, device_info: deviceInfo }),
      }),
    logout: (sessionId = null) =>
      request('/api/auth/logout', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }),
    sessions: () => request('/api/auth/sessions'),
    revokeSession: (sessionId) => request(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' }),
    permissions: () => request('/api/auth/permissions'),
    requestPasswordReset: (email, phone) =>
      request('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ email: email || null, phone: phone || null }) }),
    resetPassword: (body) =>
      request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
    copyUser: (userId, body) =>
      request(`/api/auth/users/${userId}/copy`, { method: 'POST', body: JSON.stringify(body) }),
  },
  roles: {
    list: () => request('/api/roles'),
    get: (id) => request(`/api/roles/${id}`),
    modules: () => request('/api/roles/modules'),
    permissionsMatrix: () => request('/api/roles/permissions-matrix'),
    create: (body) => request('/api/roles', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/roles/${id}`, { method: 'DELETE' }),
  },
  audit: {
    list: (limit = 100) => request(`/api/audit?limit=${limit}`),
  },
  student: {
    marks: () => request('/api/student/marks'),
    fees: () => request('/api/student/fees'),
    notices: () => request('/api/student/notices'),
    assignments: () => request('/api/student/assignments'),
    submitAssignment: (body) => request('/api/student/assignments/submit', { method: 'POST', body: JSON.stringify(body) }),
    certificates: () => request('/api/student/certificates'),
    requestTC: (body) => request('/api/student/certificates/request-tc', { method: 'POST', body: JSON.stringify(body) }),
    messaging: () => request('/api/student/messaging'),
    sendMessage: (body) => request('/api/student/messaging', { method: 'POST', body: JSON.stringify(body) }),
  },
  parent: {
    students: () => request('/api/parent/students'),
    payFee: (studentId, body) =>
      request(`/api/parent/students/${studentId}/pay-fee`, { method: 'POST', body: JSON.stringify(body) }),
    attendance: (studentId) => request(`/api/parent/students/${studentId}/attendance`),
    marks: (studentId) => request(`/api/parent/students/${studentId}/marks`),
    fees: (studentId) => request(`/api/parent/students/${studentId}/fees`),
    communication: (studentId) => request(`/api/parent/communication${studentId ? `?student_id=${studentId}` : ''}`),
    sendMessage: (body) => request('/api/parent/communication', { method: 'POST', body: JSON.stringify(body) }),
    communicationInbox: () => request('/api/parent/communication/inbox'),
    replyToParent: (body) => request('/api/parent/communication/reply', { method: 'POST', body: JSON.stringify(body) }),
  },
  admission: {
    list: (status, course) => {
      let path = '/api/admission';
      const params = [];
      if (status) params.push(`status=${encodeURIComponent(status)}`);
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    meritList: (course, limit) => {
      let path = '/api/admission/merit-list';
      const params = [];
      if (course) params.push(`course=${encodeURIComponent(course)}`);
      if (limit != null) params.push(`limit=${limit}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    get: (id) => request(`/api/admission/${id}`),
    create: (body) => request('/api/admission', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/admission/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    clerkVerify: (id) => request(`/api/admission/${id}/clerk-verify`, { method: 'POST' }),
    hodApprove: (id) => request(`/api/admission/${id}/hod-approve`, { method: 'POST' }),
    uploadDocument: async (applicationId, docType, file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/api/admission/${applicationId}/documents?doc_type=${encodeURIComponent(docType)}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error(data?.detail || text || 'Upload failed');
      return data;
    },
    verifyDocument: (applicationId, docId, verified) =>
      request(`/api/admission/${applicationId}/documents/${docId}`, { method: 'PATCH', body: JSON.stringify({ verified }) }),
    approve: (applicationId, body) =>
      request(`/api/admission/${applicationId}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  },
  students: {
    list: (alumni) => request(alumni === true ? '/api/students/alumni' : alumni === false ? '/api/students?alumni=false' : '/api/students'),
    alumni: () => request('/api/students/alumni'),
    get: (id) => request(`/api/students/${id}`),
    create: (body) => request('/api/students', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/students/${id}`, { method: 'DELETE' }),
    photoUrl: (id) => `${BASE}/api/students/${id}/photo`,
    uploadPhoto: async (id, file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/api/students/${id}/photo`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error(data?.detail || text || 'Upload failed');
      return data;
    },
    certificates: (id) => request(`/api/students/${id}/certificates`),
    issueCertificate: (body) => request('/api/students/certificates', { method: 'POST', body: JSON.stringify(body) }),
    promote: (body) => request('/api/students/promote', { method: 'POST', body: JSON.stringify(body) }),
    setAlumni: (id, isAlumni = true, alumniYear = '') =>
      request(`/api/students/${id}/alumni?is_alumni=${isAlumni}&alumni_year=${encodeURIComponent(alumniYear)}`, { method: 'PATCH' }),
    tcRequests: (id) => request(`/api/students/${id}/tc-requests`),
    createTcRequest: (id, body) => request(`/api/students/${id}/tc-request`, { method: 'POST', body: JSON.stringify(body) }),
    updateTcRequest: (requestId, body) =>
      request(`/api/students/tc-requests/${requestId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  staff: {
    list: (department, role) => {
      let path = '/api/staff';
      const params = [];
      if (department) params.push(`department=${encodeURIComponent(department)}`);
      if (role) params.push(`role=${encodeURIComponent(role)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    get: (id) => request(`/api/staff/${id}`),
    create: (body) => request('/api/staff', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/staff/${id}`, { method: 'DELETE' }),
    workload: (id) => request(`/api/staff/${id}/workload`),
    leaveRequests: (id) => request(`/api/staff/${id}/leave-requests`),
    allLeaveRequests: (status) => request(status ? `/api/staff/leave-requests?status=${encodeURIComponent(status)}` : '/api/staff/leave-requests'),
    createLeaveRequest: (body) => request('/api/staff/leave-requests', { method: 'POST', body: JSON.stringify(body) }),
    updateLeaveRequest: (id, body) => request(`/api/staff/leave-requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    appraisals: (id) => request(`/api/staff/${id}/appraisals`),
    createAppraisal: (body) => request('/api/staff/appraisals', { method: 'POST', body: JSON.stringify(body) }),
    publications: (id) => request(`/api/staff/${id}/publications`),
    createPublication: (body) => request('/api/staff/publications', { method: 'POST', body: JSON.stringify(body) }),
    resignation: (id) => request(`/api/staff/${id}/resignation`),
    resignations: (status) => request(status ? `/api/staff/resignations?status=${encodeURIComponent(status)}` : '/api/staff/resignations'),
    createResignation: (body) => request('/api/staff/resignations', { method: 'POST', body: JSON.stringify(body) }),
    updateResignation: (id, body) => request(`/api/staff/resignations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  departments: {
    list: () => request('/api/departments'),
    get: (id) => request(`/api/departments/${id}`),
    create: (body) => request('/api/departments', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/departments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/departments/${id}`, { method: 'DELETE' }),
  },
  courses: {
    list: () => request('/api/courses'),
    get: (id) => request(`/api/courses/${id}`),
    create: (body) => request('/api/courses', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/courses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/courses/${id}`, { method: 'DELETE' }),
  },
  semesters: {
    list: (program) => request(program ? `/api/semesters?program=${encodeURIComponent(program)}` : '/api/semesters'),
    get: (id) => request(`/api/semesters/${id}`),
    create: (body) => request('/api/semesters', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/semesters/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/semesters/${id}`, { method: 'DELETE' }),
  },
  subjectFaculty: {
    list: (subjectId, staffId) => {
      let path = '/api/subject-faculty';
      const params = [];
      if (subjectId) params.push(`subject_id=${encodeURIComponent(subjectId)}`);
      if (staffId) params.push(`staff_id=${encodeURIComponent(staffId)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    create: (body) => request('/api/subject-faculty', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/subject-faculty/${id}`, { method: 'DELETE' }),
  },
  timetable: {
    list: (program, semester, dayOfWeek, staffId, slotType) => {
      let path = '/api/timetable';
      const params = [];
      if (program) params.push(`program=${encodeURIComponent(program)}`);
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      if (dayOfWeek != null) params.push(`day_of_week=${dayOfWeek}`);
      if (staffId) params.push(`staff_id=${encodeURIComponent(staffId)}`);
      if (slotType) params.push(`slot_type=${encodeURIComponent(slotType)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    clashes: () => request('/api/timetable/clashes'),
    holidays: (year) => request(`/api/timetable/holidays${year ? `?year=${encodeURIComponent(year)}` : ''}`),
    createHoliday: (body) => request('/api/timetable/holidays', { method: 'POST', body: JSON.stringify(body) }),
    deleteHoliday: (id) => request(`/api/timetable/holidays/${id}`, { method: 'DELETE' }),
    versions: (limit) => request(`/api/timetable/versions${limit ? `?limit=${limit}` : ''}`),
    createVersion: () => request('/api/timetable/versions', { method: 'POST' }),
    getVersion: (id) => request(`/api/timetable/versions/${id}`),
    restoreVersion: (id) => request(`/api/timetable/versions/${id}/restore`, { method: 'POST' }),
    suggest: (program, semester) => {
      let path = '/api/timetable/suggest';
      const params = [];
      if (program) params.push(`program=${encodeURIComponent(program)}`);
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    get: (id) => request(`/api/timetable/${id}`),
    create: (body) => request('/api/timetable', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/timetable/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/timetable/${id}`, { method: 'DELETE' }),
  },
  attendance: {
    list: (date, studentId, subjectId) => {
      let path = '/api/attendance';
      const params = [];
      if (date) params.push(`date=${encodeURIComponent(date)}`);
      if (studentId) params.push(`student_id=${encodeURIComponent(studentId)}`);
      if (subjectId) params.push(`subject_id=${encodeURIComponent(subjectId)}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    daily: (date, program, semester) => {
      let path = `/api/attendance/daily?date=${encodeURIComponent(date)}`;
      if (program) path += `&program=${encodeURIComponent(program)}`;
      if (semester) path += `&semester=${encodeURIComponent(semester)}`;
      return request(path);
    },
    subjectWise: (subjectId, dateFrom, dateTo) => {
      let path = `/api/attendance/subject-wise?subject_id=${encodeURIComponent(subjectId)}`;
      if (dateFrom) path += `&date_from=${encodeURIComponent(dateFrom)}`;
      if (dateTo) path += `&date_to=${encodeURIComponent(dateTo)}`;
      return request(path);
    },
    biometric: (body) => request('/api/attendance/biometric', { method: 'POST', body: JSON.stringify(body) }),
    monthlyReport: (month, program, semester) => {
      let path = `/api/attendance/monthly-report?month=${encodeURIComponent(month)}`;
      if (program) path += `&program=${encodeURIComponent(program)}`;
      if (semester) path += `&semester=${encodeURIComponent(semester)}`;
      return request(path);
    },
    shortageAlerts: (month, threshold, program, semester) => {
      const params = [];
      if (month) params.push(`month=${encodeURIComponent(month)}`);
      if (threshold != null) params.push(`threshold=${threshold}`);
      if (program) params.push(`program=${encodeURIComponent(program)}`);
      if (semester) params.push(`semester=${encodeURIComponent(semester)}`);
      const path = params.length ? `/api/attendance/shortage-alerts?${params.join('&')}` : '/api/attendance/shortage-alerts';
      return request(path);
    },
    bulk: (body) => request('/api/attendance/bulk', { method: 'POST', body: JSON.stringify(body) }),
    semesterReport: (dateFrom, dateTo, program, semester) => {
      let path = `/api/attendance/semester-report?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`;
      if (program) path += `&program=${encodeURIComponent(program)}`;
      if (semester) path += `&semester=${encodeURIComponent(semester)}`;
      return request(path);
    },
    defaulterList: (opts = {}) => {
      const params = [];
      if (opts.month) params.push(`month=${encodeURIComponent(opts.month)}`);
      if (opts.dateFrom) params.push(`date_from=${encodeURIComponent(opts.dateFrom)}`);
      if (opts.dateTo) params.push(`date_to=${encodeURIComponent(opts.dateTo)}`);
      if (opts.threshold != null) params.push(`threshold=${opts.threshold}`);
      if (opts.program) params.push(`program=${encodeURIComponent(opts.program)}`);
      if (opts.semester) params.push(`semester=${encodeURIComponent(opts.semester)}`);
      const path = params.length ? `/api/attendance/defaulter-list?${params.join('&')}` : '/api/attendance/defaulter-list';
      return request(path);
    },
    alertsAbsentList: (studentId, date, limit) => {
      let path = '/api/attendance/alerts/absent';
      const params = [];
      if (studentId) params.push(`student_id=${encodeURIComponent(studentId)}`);
      if (date) params.push(`date=${encodeURIComponent(date)}`);
      if (limit != null) params.push(`limit=${limit}`);
      if (params.length) path += '?' + params.join('&');
      return request(path);
    },
    recordAbsentAlert: (body) => request('/api/attendance/alerts/absent', { method: 'POST', body: JSON.stringify(body) }),
    staff: {
      geoConfig: () => request('/api/attendance/staff/geo-config'),
      punch: (body) => request('/api/attendance/staff/punch', { method: 'POST', body: JSON.stringify(body) }),
      list: (date, staffId, limit) => {
        let path = '/api/attendance/staff';
        const params = [];
        if (date) params.push(`date=${encodeURIComponent(date)}`);
        if (staffId) params.push(`staff_id=${encodeURIComponent(staffId)}`);
        if (limit != null) params.push(`limit=${limit}`);
        if (params.length) path += '?' + params.join('&');
        return request(path);
      },
      correct: (punchId, body) => request(`/api/attendance/staff/${punchId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    },
    get: (id) => request(`/api/attendance/${id}`),
    create: (body) => request('/api/attendance', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/api/attendance/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/api/attendance/${id}`, { method: 'DELETE' }),
  },
  fees: {
    list: () => request('/api/fees'),
    analytics: () => request('/api/fees/analytics'),
    create: (body) => request('/api/fees', { method: 'POST', body: JSON.stringify(body) }),
    feeTypes: () => request('/api/fees/fee-types'),
    structure: () => request('/api/fees/structure'),
    createStructure: (body) => request('/api/fees/structure', { method: 'POST', body: JSON.stringify(body) }),
    updateStructure: (id, body) => request(`/api/fees/structure/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteStructure: (id) => request(`/api/fees/structure/${id}`, { method: 'DELETE' }),
  },
  bulkUpload: {
    /** Get expected column headers for an entity (for building/downloading template). */
    template: (entity) => request(`/api/bulk-upload/templates/${entity}`),
    /** Upload Excel file. file = File from input. Returns { created, updated, errors, message }. */
    upload: async (entity, file) => {
      const form = new FormData();
      form.append('file', file);
      return request(`/api/bulk-upload/${entity}`, { method: 'POST', body: form });
    },
  },
  backup: {
    exportUrl: () => `${BASE}/api/settings/backup/export`,
    restore: async (file) => {
      const form = new FormData();
      form.append('file', file);
      return request('/api/settings/backup/restore', { method: 'POST', body: form });
    },
  },
};

export default api;
