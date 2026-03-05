import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NavProvider, useNav } from './context/NavContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import RequirePermission from './components/RequirePermission';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import StudentPromotion from './pages/StudentPromotion';
import Admission from './pages/Admission';
import MeritList from './pages/MeritList';
import Alumni from './pages/Alumni';
import Placeholder from './pages/Placeholder';
import Departments from './pages/Departments';
import Staff from './pages/Staff';
import StaffProfile from './pages/StaffProfile';
import StaffLeave from './pages/StaffLeave';
import StaffResignations from './pages/StaffResignations';
import Sessions from './pages/Sessions';
import AuditLogs from './pages/AuditLogs';
import RolePermissions from './pages/RolePermissions';
import Profile from './pages/Profile';
import UserManagement from './pages/UserManagement';
import ParentPortal from './pages/ParentPortal';
import ParentInbox from './pages/ParentInbox';
import StudentMarks from './pages/StudentMarks';
import StudentFees from './pages/StudentFees';
import StudentNotices from './pages/StudentNotices';
import StudentAssignments from './pages/StudentAssignments';
import StudentMessaging from './pages/StudentMessaging';
import StudentCertificates from './pages/StudentCertificates';
import FeeAnalytics from './pages/FeeAnalytics';
import AnalyticsCharts from './pages/AnalyticsCharts';
import Approvals from './pages/Approvals';
import CourseSubjects from './pages/CourseSubjects';
import SemesterSetup from './pages/SemesterSetup';
import SubjectFaculty from './pages/SubjectFaculty';
import Timetable from './pages/Timetable';
import Attendance from './pages/Attendance';
import BulkUpload from './pages/BulkUpload';
import Backup from './pages/Backup';
import Examinations from './pages/Examinations';
import ResultAnalytics from './pages/ResultAnalytics';
import Reports from './pages/Reports';
import NotFound from './pages/NotFound';
import './App.css';

function AppRoutes() {
  const { routePermissions: p } = useNav();
  return (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
        <Route index element={<RequirePermission permission={p['/']}><Dashboard /></RequirePermission>} />
        <Route path="students" element={<RequirePermission permission={p['/students']}><Students /></RequirePermission>} />
            <Route path="students/promote" element={<RequirePermission permission="students:write"><StudentPromotion /></RequirePermission>} />
            <Route path="students/alumni" element={<RequirePermission permission={p['/students']}><Alumni /></RequirePermission>} />
            <Route path="students/:id" element={<RequirePermission permission={p['/students/:id']}><StudentProfile /></RequirePermission>} />
            <Route path="admission" element={<RequirePermission permission={p['/admission']}><Admission /></RequirePermission>} />
            <Route path="admission/merit-list" element={<RequirePermission permission={p['/admission/merit-list']}><MeritList /></RequirePermission>} />
            <Route path="departments" element={<RequirePermission permission={p['/departments']}><Departments /></RequirePermission>} />
            <Route path="staff" element={<RequirePermission permission={p['/staff']}><Staff /></RequirePermission>} />
            <Route path="staff/leave" element={<RequirePermission permission={p['/staff/leave']}><StaffLeave /></RequirePermission>} />
            <Route path="staff/resignations" element={<RequirePermission permission={p['/staff/resignations']}><StaffResignations /></RequirePermission>} />
            <Route path="staff/:id" element={<RequirePermission permission={p['/staff/:id']}><StaffProfile /></RequirePermission>} />
            <Route path="courses" element={<RequirePermission permission={p['/courses']}><CourseSubjects /></RequirePermission>} />
            <Route path="semesters" element={<RequirePermission permission={p['/semesters']}><SemesterSetup /></RequirePermission>} />
            <Route path="subject-faculty" element={<RequirePermission permission={p['/subject-faculty']}><SubjectFaculty /></RequirePermission>} />
            <Route path="timetable" element={<RequirePermission permission={p['/timetable']}><Timetable /></RequirePermission>} />
            <Route path="academic/syllabus" element={<RequirePermission permission={p['/academic/syllabus']}><Placeholder title="Syllabus upload" /></RequirePermission>} />
            <Route path="academic/lesson-plans" element={<RequirePermission permission={p['/academic/lesson-plans']}><Placeholder title="Lesson plans" /></RequirePermission>} />
            <Route path="academic/study-material" element={<RequirePermission permission={p['/academic/study-material']}><Placeholder title="Study material (PDF / PPT / Video)" /></RequirePermission>} />
            <Route path="academic/assignments" element={<RequirePermission permission={p['/academic/assignments']}><Placeholder title="Assignments & quizzes" /></RequirePermission>} />
            <Route path="academic/submission-feedback" element={<RequirePermission permission={p['/academic/submission-feedback']}><Placeholder title="Submission & feedback" /></RequirePermission>} />
            <Route path="academic/blooms-taxonomy" element={<RequirePermission permission={p['/academic/blooms-taxonomy']}><Placeholder title="Bloom's taxonomy" /></RequirePermission>} />
            <Route path="academic/co-po-mapping" element={<RequirePermission permission={p['/academic/co-po-mapping']}><Placeholder title="CO–PO mapping" /></RequirePermission>} />
            <Route path="academic/calendar" element={<RequirePermission permission={p['/academic/calendar']}><Placeholder title="Academic calendar" /></RequirePermission>} />
            <Route path="academic/lms-scorm" element={<RequirePermission permission={p['/academic/lms-scorm']}><Placeholder title="LMS / SCORM integration" /></RequirePermission>} />
            <Route path="exams/internal-setup" element={<RequirePermission permission={p['/exams/internal-setup']}><Placeholder title="Internal exam setup" /></RequirePermission>} />
            <Route path="exams/university-scheduling" element={<RequirePermission permission={p['/exams/university-scheduling']}><Placeholder title="University exam scheduling" /></RequirePermission>} />
            <Route path="exams/seating" element={<RequirePermission permission={p['/exams/seating']}><Placeholder title="Seating arrangement" /></RequirePermission>} />
            <Route path="exams/marks-entry" element={<RequirePermission permission={p['/exams/marks-entry']}><Placeholder title="Marks entry (internal / practical)" /></RequirePermission>} />
            <Route path="exams/attendance-assignment-marks" element={<RequirePermission permission={p['/exams/attendance-assignment-marks']}><Placeholder title="Attendance & assignment marks" /></RequirePermission>} />
            <Route path="exams/total-grade" element={<RequirePermission permission={p['/exams/total-grade']}><Placeholder title="Total & grade calculation" /></RequirePermission>} />
            <Route path="exams/gpa-cgpa" element={<RequirePermission permission={p['/exams/gpa-cgpa']}><Placeholder title="GPA / CGPA" /></RequirePermission>} />
            <Route path="exams/hall-ticket" element={<RequirePermission permission={p['/exams/hall-ticket']}><Placeholder title="Hall ticket (QR)" /></RequirePermission>} />
            <Route path="exams/result-approval" element={<RequirePermission permission={p['/exams/result-approval']}><Placeholder title="Result approval" /></RequirePermission>} />
            <Route path="exams/report-cards" element={<RequirePermission permission={p['/exams/report-cards']}><Placeholder title="Report cards" /></RequirePermission>} />
            <Route path="exams/revaluation-supplementary" element={<RequirePermission permission={p['/exams/revaluation-supplementary']}><Placeholder title="Revaluation & supplementary" /></RequirePermission>} />
            <Route path="exams/topper-analytics" element={<RequirePermission permission={p['/exams/topper-analytics']}><Placeholder title="Topper analytics" /></RequirePermission>} />
            <Route path="exams" element={<RequirePermission permission={p['/exams']}><Examinations /></RequirePermission>} />
            <Route path="results" element={<RequirePermission permission={p['/results']}><ResultAnalytics /></RequirePermission>} />
            <Route path="attendance" element={<RequirePermission permission={p['/attendance']}><Attendance /></RequirePermission>} />
            <Route path="bulk-upload" element={<RequirePermission permission={p['/bulk-upload']}><BulkUpload /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission permission={p['/reports']}><Reports /></RequirePermission>} />
            <Route path="fees/structure" element={<RequirePermission permission={p['/fees/structure']}><Placeholder title="Course-wise fee structure" /></RequirePermission>} />
            <Route path="fees/installments" element={<RequirePermission permission={p['/fees/installments']}><Placeholder title="Installments" /></RequirePermission>} />
            <Route path="fees/scholarships" element={<RequirePermission permission={p['/fees/scholarships']}><Placeholder title="Scholarships" /></RequirePermission>} />
            <Route path="fees/online-payments" element={<RequirePermission permission={p['/fees/online-payments']}><Placeholder title="Online payments" /></RequirePermission>} />
            <Route path="fees/payment-tracking" element={<RequirePermission permission={p['/fees/payment-tracking']}><Placeholder title="Cash / UPI / Bank tracking" /></RequirePermission>} />
            <Route path="fees/receipts" element={<RequirePermission permission={p['/fees/receipts']}><Placeholder title="Receipt generation" /></RequirePermission>} />
            <Route path="fees/due-penalty" element={<RequirePermission permission={p['/fees/due-penalty']}><Placeholder title="Due & penalty automation" /></RequirePermission>} />
            <Route path="fees/refunds-concessions" element={<RequirePermission permission={p['/fees/refunds-concessions']}><Placeholder title="Refunds & concessions" /></RequirePermission>} />
            <Route path="fees/parent-view" element={<RequirePermission permission={p['/fees/parent-view']}><Placeholder title="Parent fee view" /></RequirePermission>} />
            <Route path="fees/audit-logs" element={<RequirePermission permission={p['/fees/audit-logs']}><Placeholder title="Fee audit logs" /></RequirePermission>} />
            <Route path="fees/gst-reports" element={<RequirePermission permission={p['/fees/gst-reports']}><Placeholder title="GST reports" /></RequirePermission>} />
            <Route path="fees/due-report" element={<RequirePermission permission={p['/fees/due-report']}><Placeholder title="Due report" /></RequirePermission>} />
            <Route path="fees" element={<RequirePermission permission={p['/fees']}><FeeAnalytics /></RequirePermission>} />
            <Route path="scholarship/tracking" element={<RequirePermission permission={p['/scholarship/tracking']}><Placeholder title="Scholarship tracking" /></RequirePermission>} />
            <Route path="scholarship/government-records" element={<RequirePermission permission={p['/scholarship/government-records']}><Placeholder title="Government scholarship records" /></RequirePermission>} />
            <Route path="scholarship/approval-workflow" element={<RequirePermission permission={p['/scholarship/approval-workflow']}><Placeholder title="Approval workflow" /></RequirePermission>} />
            <Route path="payroll/salary-structure" element={<RequirePermission permission={p['/payroll/salary-structure']}><Placeholder title="Salary structure" /></RequirePermission>} />
            <Route path="payroll/allowances" element={<RequirePermission permission={p['/payroll/allowances']}><Placeholder title="Allowances" /></RequirePermission>} />
            <Route path="payroll/deductions" element={<RequirePermission permission={p['/payroll/deductions']}><Placeholder title="Deductions" /></RequirePermission>} />
            <Route path="payroll/pf-esi" element={<RequirePermission permission={p['/payroll/pf-esi']}><Placeholder title="PF/ESI tracking" /></RequirePermission>} />
            <Route path="payroll/payslip" element={<RequirePermission permission={p['/payroll/payslip']}><Placeholder title="Payslip generation" /></RequirePermission>} />
            <Route path="payroll/salary-history" element={<RequirePermission permission={p['/payroll/salary-history']}><Placeholder title="Salary history" /></RequirePermission>} />
            <Route path="expense/entry" element={<RequirePermission permission={p['/expense/entry']}><Placeholder title="College expense entry" /></RequirePermission>} />
            <Route path="expense/category-wise" element={<RequirePermission permission={p['/expense/category-wise']}><Placeholder title="Category wise expenses" /></RequirePermission>} />
            <Route path="expense/monthly-report" element={<RequirePermission permission={p['/expense/monthly-report']}><Placeholder title="Monthly expense report" /></RequirePermission>} />
            <Route path="expense/budget-planning" element={<RequirePermission permission={p['/expense/budget-planning']}><Placeholder title="Budget planning" /></RequirePermission>} />
            <Route path="communication/bulk-sms" element={<RequirePermission permission={p['/communication/bulk-sms']}><Placeholder title="Bulk SMS" /></RequirePermission>} />
            <Route path="communication/whatsapp" element={<RequirePermission permission={p['/communication/whatsapp']}><Placeholder title="WhatsApp" /></RequirePermission>} />
            <Route path="communication/email" element={<RequirePermission permission={p['/communication/email']}><Placeholder title="Email" /></RequirePermission>} />
            <Route path="communication/push-notifications" element={<RequirePermission permission={p['/communication/push-notifications']}><Placeholder title="Push notifications" /></RequirePermission>} />
            <Route path="communication/department-messaging" element={<RequirePermission permission={p['/communication/department-messaging']}><Placeholder title="Department messaging" /></RequirePermission>} />
            <Route path="communication/scheduled-alerts" element={<RequirePermission permission={p['/communication/scheduled-alerts']}><Placeholder title="Scheduled alerts" /></RequirePermission>} />
            <Route path="communication/emergency-broadcast" element={<RequirePermission permission={p['/communication/emergency-broadcast']}><Placeholder title="Emergency broadcast" /></RequirePermission>} />
            <Route path="communication/delivery-status" element={<RequirePermission permission={p['/communication/delivery-status']}><Placeholder title="Delivery status" /></RequirePermission>} />
            <Route path="communication/read-receipts" element={<RequirePermission permission={p['/communication/read-receipts']}><Placeholder title="Read receipts" /></RequirePermission>} />
            <Route path="communication/auto-alerts" element={<RequirePermission permission={p['/communication/auto-alerts']}><Placeholder title="Auto-alerts" /></RequirePermission>} />
            <Route path="communication/fee-reminder-sms" element={<RequirePermission permission={p['/communication/fee-reminder-sms']}><Placeholder title="Fee reminder SMS" /></RequirePermission>} />
            <Route path="communication/attendance-alert-sms" element={<RequirePermission permission={p['/communication/attendance-alert-sms']}><Placeholder title="Attendance alert SMS" /></RequirePermission>} />
            <Route path="communication/exam-notification" element={<RequirePermission permission={p['/communication/exam-notification']}><Placeholder title="Exam notification" /></RequirePermission>} />
            <Route path="communication/bulk-messaging" element={<RequirePermission permission={p['/communication/bulk-messaging']}><Placeholder title="Bulk messaging" /></RequirePermission>} />
            <Route path="library/book-entry" element={<RequirePermission permission={p['/library/book-entry']}><Placeholder title="Book entry" /></RequirePermission>} />
            <Route path="library/isbn-tracking" element={<RequirePermission permission={p['/library/isbn-tracking']}><Placeholder title="ISBN tracking" /></RequirePermission>} />
            <Route path="library/accession-register" element={<RequirePermission permission={p['/library/accession-register']}><Placeholder title="Accession register" /></RequirePermission>} />
            <Route path="library/barcode-rfid" element={<RequirePermission permission={p['/library/barcode-rfid']}><Placeholder title="Barcode ready" /></RequirePermission>} />
            <Route path="library/issue-return" element={<RequirePermission permission={p['/library/issue-return']}><Placeholder title="Issue/Return" /></RequirePermission>} />
            <Route path="library/fine-calculation" element={<RequirePermission permission={p['/library/fine-calculation']}><Placeholder title="Fine calculation" /></RequirePermission>} />
            <Route path="library/reservation" element={<RequirePermission permission={p['/library/reservation']}><Placeholder title="Reservation" /></RequirePermission>} />
            <Route path="library/due-alerts" element={<RequirePermission permission={p['/library/due-alerts']}><Placeholder title="Due tracking" /></RequirePermission>} />
            <Route path="library/history" element={<RequirePermission permission={p['/library/history']}><Placeholder title="History" /></RequirePermission>} />
            <Route path="library/stock-verification" element={<RequirePermission permission={p['/library/stock-verification']}><Placeholder title="Stock verification" /></RequirePermission>} />
            <Route path="library/librarian-login" element={<RequirePermission permission={p['/library/librarian-login']}><Placeholder title="Librarian login" /></RequirePermission>} />
            <Route path="lab/chemical-stock" element={<RequirePermission permission={p['/lab/chemical-stock']}><Placeholder title="Chemical stock tracking" /></RequirePermission>} />
            <Route path="lab/equipment-inventory" element={<RequirePermission permission={p['/lab/equipment-inventory']}><Placeholder title="Equipment tracking" /></RequirePermission>} />
            <Route path="lab/calibration-logs" element={<RequirePermission permission={p['/lab/calibration-logs']}><Placeholder title="Calibration logs" /></RequirePermission>} />
            <Route path="lab/expiry-tracking" element={<RequirePermission permission={p['/lab/expiry-tracking']}><Placeholder title="Expiry date alert" /></RequirePermission>} />
            <Route path="lab/manuals" element={<RequirePermission permission={p['/lab/manuals']}><Placeholder title="Lab manuals" /></RequirePermission>} />
            <Route path="lab/practical-attendance" element={<RequirePermission permission={p['/lab/practical-attendance']}><Placeholder title="Practical attendance" /></RequirePermission>} />
            <Route path="lab/timetable" element={<RequirePermission permission={p['/lab/timetable']}><Placeholder title="Lab timetable" /></RequirePermission>} />
            <Route path="lab/msds-storage" element={<RequirePermission permission={p['/lab/msds-storage']}><Placeholder title="MSDS storage" /></RequirePermission>} />
            <Route path="lab/vendor-management" element={<RequirePermission permission={p['/lab/vendor-management']}><Placeholder title="Vendor management" /></RequirePermission>} />
            <Route path="lab/purchase-orders" element={<RequirePermission permission={p['/lab/purchase-orders']}><Placeholder title="Purchase order management" /></RequirePermission>} />
            <Route path="lab/audit-reports" element={<RequirePermission permission={p['/lab/audit-reports']}><Placeholder title="Audit reports" /></RequirePermission>} />
            <Route path="pharmd/posting-schedule" element={<RequirePermission permission={p['/pharmd/posting-schedule']}><Placeholder title="Posting schedule" /></RequirePermission>} />
            <Route path="pharmd/mentor-login" element={<RequirePermission permission={p['/pharmd/mentor-login']}><Placeholder title="Mentor login" /></RequirePermission>} />
            <Route path="pharmd/case-sheets" element={<RequirePermission permission={p['/pharmd/case-sheets']}><Placeholder title="Case sheets" /></RequirePermission>} />
            <Route path="pharmd/reviews-feedback" element={<RequirePermission permission={p['/pharmd/reviews-feedback']}><Placeholder title="Reviews & feedback" /></RequirePermission>} />
            <Route path="pharmd/clinical-logbook" element={<RequirePermission permission={p['/pharmd/clinical-logbook']}><Placeholder title="Clinical logbook" /></RequirePermission>} />
            <Route path="pharmd/adr-reporting" element={<RequirePermission permission={p['/pharmd/adr-reporting']}><Placeholder title="ADR reporting" /></RequirePermission>} />
            <Route path="pharmd/internship-assessment" element={<RequirePermission permission={p['/pharmd/internship-assessment']}><Placeholder title="Internship assessment" /></RequirePermission>} />
            <Route path="pharmd/competency-scorecard" element={<RequirePermission permission={p['/pharmd/competency-scorecard']}><Placeholder title="Competency scorecard" /></RequirePermission>} />
            <Route path="notice/department" element={<RequirePermission permission={p['/notice/department']}><Placeholder title="Department notice" /></RequirePermission>} />
            <Route path="notice/role-based" element={<RequirePermission permission={p['/notice/role-based']}><Placeholder title="Role based notice" /></RequirePermission>} />
            <Route path="notice/expiry" element={<RequirePermission permission={p['/notice/expiry']}><Placeholder title="Expiry date" /></RequirePermission>} />
            <Route path="notice/attachments" element={<RequirePermission permission={p['/notice/attachments']}><Placeholder title="Attachments" /></RequirePermission>} />
            <Route path="messaging/student-staff" element={<RequirePermission permission={p['/messaging/student-staff']}><Placeholder title="Student ↔ Staff messaging" /></RequirePermission>} />
            <Route path="messaging/group" element={<RequirePermission permission={p['/messaging/group']}><Placeholder title="Group messaging" /></RequirePermission>} />
            <Route path="messaging/announcements" element={<RequirePermission permission={p['/messaging/announcements']}><Placeholder title="Announcement system" /></RequirePermission>} />
            <Route path="hostel/room-allocation" element={<RequirePermission permission={p['/hostel/room-allocation']}><Placeholder title="Room allocation" /></RequirePermission>} />
            <Route path="hostel/bed-management" element={<RequirePermission permission={p['/hostel/bed-management']}><Placeholder title="Bed management" /></RequirePermission>} />
            <Route path="hostel/check-in-out" element={<RequirePermission permission={p['/hostel/check-in-out']}><Placeholder title="Check-in/out" /></RequirePermission>} />
            <Route path="hostel/attendance" element={<RequirePermission permission={p['/hostel/attendance']}><Placeholder title="Hostel attendance" /></RequirePermission>} />
            <Route path="hostel/visitor-logs" element={<RequirePermission permission={p['/hostel/visitor-logs']}><Placeholder title="Visitor log" /></RequirePermission>} />
            <Route path="hostel/fees" element={<RequirePermission permission={p['/hostel/fees']}><Placeholder title="Hostel fee" /></RequirePermission>} />
            <Route path="hostel/mess-menu" element={<RequirePermission permission={p['/hostel/mess-menu']}><Placeholder title="Mess tracking" /></RequirePermission>} />
            <Route path="hostel/alerts" element={<RequirePermission permission={p['/hostel/alerts']}><Placeholder title="Alerts" /></RequirePermission>} />
            <Route path="transport/route-bus" element={<RequirePermission permission={p['/transport/route-bus']}><Placeholder title="Bus routes" /></RequirePermission>} />
            <Route path="transport/student-allocation" element={<RequirePermission permission={p['/transport/student-allocation']}><Placeholder title="Student allocation" /></RequirePermission>} />
            <Route path="transport/driver-vehicle" element={<RequirePermission permission={p['/transport/driver-vehicle']}><Placeholder title="Driver details" /></RequirePermission>} />
            <Route path="transport/bus-pass" element={<RequirePermission permission={p['/transport/bus-pass']}><Placeholder title="Bus pass" /></RequirePermission>} />
            <Route path="transport/fees" element={<RequirePermission permission={p['/transport/fees']}><Placeholder title="Transport fees" /></RequirePermission>} />
            <Route path="transport/bus-attendance" element={<RequirePermission permission={p['/transport/bus-attendance']}><Placeholder title="Route attendance" /></RequirePermission>} />
            <Route path="transport/route-change-approval" element={<RequirePermission permission={p['/transport/route-change-approval']}><Placeholder title="Route change approval" /></RequirePermission>} />
            <Route path="transport/gps-tracking" element={<RequirePermission permission={p['/transport/gps-tracking']}><Placeholder title="GPS tracking" /></RequirePermission>} />
            <Route path="placement/company-database" element={<RequirePermission permission={p['/placement/company-database']}><Placeholder title="Company registration" /></RequirePermission>} />
            <Route path="placement/campus-drives" element={<RequirePermission permission={p['/placement/campus-drives']}><Placeholder title="Drive scheduling" /></RequirePermission>} />
            <Route path="placement/student-eligibility-filter" element={<RequirePermission permission={p['/placement/student-eligibility-filter']}><Placeholder title="Student eligibility filter" /></RequirePermission>} />
            <Route path="placement/selected-student-tracking" element={<RequirePermission permission={p['/placement/selected-student-tracking']}><Placeholder title="Selected student tracking" /></RequirePermission>} />
            <Route path="placement/cv-upload" element={<RequirePermission permission={p['/placement/cv-upload']}><Placeholder title="CV upload" /></RequirePermission>} />
            <Route path="placement/student-registration" element={<RequirePermission permission={p['/placement/student-registration']}><Placeholder title="Student registration" /></RequirePermission>} />
            <Route path="placement/interview-tracking" element={<RequirePermission permission={p['/placement/interview-tracking']}><Placeholder title="Interview tracking" /></RequirePermission>} />
            <Route path="placement/offer-letters" element={<RequirePermission permission={p['/placement/offer-letters']}><Placeholder title="Offer letters" /></RequirePermission>} />
            <Route path="placement/analytics" element={<RequirePermission permission={p['/placement/analytics']}><Placeholder title="Placement analytics" /></RequirePermission>} />
            <Route path="placement/alumni-interaction" element={<RequirePermission permission={p['/placement/alumni-interaction']}><Placeholder title="Alumni interaction" /></RequirePermission>} />
            <Route path="events/workshops" element={<RequirePermission permission={p['/events/workshops']}><Placeholder title="Workshop tracking" /></RequirePermission>} />
            <Route path="events/seminar-registration" element={<RequirePermission permission={p['/events/seminar-registration']}><Placeholder title="Seminar registration" /></RequirePermission>} />
            <Route path="events/certificates" element={<RequirePermission permission={p['/events/certificates']}><Placeholder title="Certificate generation" /></RequirePermission>} />
            <Route path="accreditation/faculty-qualification" element={<RequirePermission permission={p['/accreditation/faculty-qualification']}><Placeholder title="Faculty qualification report" /></RequirePermission>} />
            <Route path="accreditation/student-strength" element={<RequirePermission permission={p['/accreditation/student-strength']}><Placeholder title="Student strength report" /></RequirePermission>} />
            <Route path="accreditation/infrastructure" element={<RequirePermission permission={p['/accreditation/infrastructure']}><Placeholder title="Infrastructure report" /></RequirePermission>} />
            <Route path="accreditation/research-publication" element={<RequirePermission permission={p['/accreditation/research-publication']}><Placeholder title="Research publication record" /></RequirePermission>} />
            <Route path="reports/builder" element={<RequirePermission permission={p['/reports/builder']}><Placeholder title="Custom report builder" /></RequirePermission>} />
            <Route path="reports/export-excel" element={<RequirePermission permission={p['/reports/export-excel']}><Placeholder title="Export to Excel" /></RequirePermission>} />
            <Route path="reports/export-pdf" element={<RequirePermission permission={p['/reports/export-pdf']}><Placeholder title="Export to PDF" /></RequirePermission>} />
            <Route path="analytics" element={<RequirePermission permission={p['/analytics']}><AnalyticsCharts /></RequirePermission>} />
            <Route path="analytics/department-performance" element={<RequirePermission permission={p['/analytics/department-performance']}><Placeholder title="Department performance analytics" /></RequirePermission>} />
            <Route path="approvals" element={<RequirePermission permission={p['/approvals']}><Approvals /></RequirePermission>} />
            <Route path="sessions" element={<RequirePermission permission={p['/sessions']}><Sessions /></RequirePermission>} />
            <Route path="audit" element={<RequirePermission permission={p['/audit']}><AuditLogs /></RequirePermission>} />
            <Route path="audit/activity" element={<RequirePermission permission={p['/audit/activity']}><Placeholder title="User activity tracking" /></RequirePermission>} />
            <Route path="audit/login-logs" element={<RequirePermission permission={p['/audit/login-logs']}><Placeholder title="Login logs" /></RequirePermission>} />
            <Route path="audit/data-modification" element={<RequirePermission permission={p['/audit/data-modification']}><Placeholder title="Data modification logs" /></RequirePermission>} />
            <Route path="audit/security" element={<RequirePermission permission={p['/audit/security']}><Placeholder title="Security logs" /></RequirePermission>} />
            <Route path="permissions" element={<RequirePermission permission={p['/permissions']}><RolePermissions /></RequirePermission>} />
            <Route path="users" element={<RequirePermission permission={p['/users']}><UserManagement /></RequirePermission>} />
            <Route path="settings/backup" element={<RequirePermission permission={p['/settings/backup']}><Backup /></RequirePermission>} />
            <Route path="settings/payment-gateway" element={<RequirePermission permission={p['/settings/payment-gateway']}><Placeholder title="Payment gateway setup" /></RequirePermission>} />
            <Route path="settings/email" element={<RequirePermission permission={p['/settings/email']}><Placeholder title="Email configuration" /></RequirePermission>} />
            <Route path="settings/multi-campus" element={<RequirePermission permission={p['/settings/multi-campus']}><Placeholder title="Multi-campus setup" /></RequirePermission>} />
            <Route path="profile" element={<RequirePermission permission={p['/profile']}><Profile /></RequirePermission>} />
            <Route path="parent" element={<RequirePermission permission={p['/parent']}><ParentPortal /></RequirePermission>} />
            <Route path="parent-inbox" element={<RequirePermission permission={p['/parent-inbox']}><ParentInbox /></RequirePermission>} />
            <Route path="student/marks" element={<RequirePermission permission={p['/student/marks']}><StudentMarks /></RequirePermission>} />
            <Route path="student/fees" element={<RequirePermission permission={p['/student/fees']}><StudentFees /></RequirePermission>} />
            <Route path="student/payments" element={<RequirePermission permission={p['/student/fees']}><StudentFees /></RequirePermission>} />
            <Route path="student/notices" element={<RequirePermission permission={p['/student/notices']}><StudentNotices /></RequirePermission>} />
            <Route path="student/messaging" element={<RequirePermission permission={p['/student/messaging']}><StudentMessaging /></RequirePermission>} />
            <Route path="student/certificates" element={<RequirePermission permission={p['/student/certificates']}><StudentCertificates /></RequirePermission>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </NavProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
