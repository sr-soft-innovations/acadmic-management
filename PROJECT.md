# G.P. College of Pharmacy ERP — Project document

## Vision

Single integrated ERP for pharmacy colleges: manage academics, examinations, fees, payroll, library, lab, hostel, transport, placement, and compliance (NAAC, audits) from one platform with role-based access.

## Goals

- **High-level project:** Clear architecture, documentation, and module coverage so the system is production-ready and extendable.
- **Increase work and function:** Every area has usable screens (list, add, edit, delete, export), dashboard KPIs, reports, and APIs where needed.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, React Router, fetch API |
| Backend | FastAPI, Python 3.x |
| Storage | JSON files (data/*.json); replace with PostgreSQL/SQLite when scaling |
| Auth | Session-based (X-Session-Id); optional JWT |

## Module map (work & function)

### Core (implemented with API + UI)

- **Students** — List, create, edit, delete, profile, promote, alumni.
- **Staff** — List, create, edit, profile, leave, resignations.
- **Admission** — Applications, merit list.
- **Courses / Semesters** — CRUD, subject–faculty mapping.
- **Timetable** — Slots by day, subject, room.
- **Attendance** — Mark and view by date/course.
- **Exams** — Create, schedule, seating, marks, hall ticket, revaluation.
- **Results** — GPA/CGPA, rank list.
- **Fees** — Structure, collections, fee analytics.
- **Approvals** — Pending list, approve/reject.
- **Audit** — Activity logs.
- **Roles & permissions** — Modules, role CRUD, assign permissions (Super Admin only for write).
- **Student portal** — Marks, fees, notices, assignments, certificates, messaging (self-scoped).
- **Parent portal** — View students, messages.
- **Bulk upload** — Excel upload for students.

### Module pages (functional UI)

All other routes (80+) use a **functional placeholder**: list view, Add/Edit/Delete with modal, data persisted per page in browser storage. Ready to plug in real APIs when backend endpoints are added.

- Scholarship, Notice, Messaging, Events, Accreditation.
- Library, Lab, Hostel, Transport, Placement.
- Payroll, Expense.
- Reports (builder, export Excel/PDF), Analytics (dashboard, department performance).
- Audit sub-pages (activity, login, data modification, security).

### Dashboard (role-specific)

- **Role-specific:** Super Admin (active users, server status, revenue, security alerts), Admin (stats, approvals, activity), Principal (strength, pass %, inspections), HOD (dept metrics, faculty workload), Faculty (timetable, pending), Student (attendance, fees, marks), Parent (per-child data, pay fee).
- Profile summary, notifications, calendar, quick actions.
- Admin: stats, daily attendance, student strength, pending approvals, system health, department comparison.
- Faculty: today’s timetable, attendance link, upcoming exams.
- Export and recent-activity hooks for more “work” on the home screen.

## APIs (high-level)

| Area | Endpoints (examples) |
|------|----------------------|
| Auth | login, logout, me, sessions |
| Students | CRUD, list, promote |
| Staff | CRUD, list |
| Courses / Semesters | CRUD |
| Attendance | list, mark, by date |
| Exams | CRUD, schedule, seating, marks, hall ticket, revaluation |
| Results | GPA, CGPA, rank list |
| Fees | structure, collections, analytics |
| Dashboard | stats, notifications, calendar, daily overview, student strength, department comparison, student-personal, parent-personal, staff-personal, hod-personal, super-admin-summary, upcoming-inspections, pass-percentage |
| Reports | summary (counts, recent activity) |
| Nav | GET /api/nav (items + route_permissions) |
| Roles | list, create, update, modules |

## Role permissions (summary)

| Role | Can | Cannot |
|------|-----|--------|
| **Super Admin** | Create roles, assign permissions, system settings, backup, payment gateway, email config, multi-campus, full audit | — |
| **Admin** | Students, staff, courses, departments, fees, scholarships, approvals, certificates | Access Super Admin settings, modify role permission matrix |
| **Principal** | Approve admissions/results, view reports, payroll summary, audit, scholarship | Modify system settings, payment gateway config |
| **HOD** | Approve attendance/marks/admission (dept), view dept reports, manage timetable, faculty performance | Access other departments, payroll, system settings |

## Roadmap (increase work and function)

1. **Reports & export** — Report summary API, CSV/Excel export from tables, PDF placeholder.
2. **Recent activity** — Activity API consumed by dashboard “Recent activity” widget.
3. **Fee summary on dashboard** — Total collected, due, by month.
4. **Replace JSON storage** — Optional PostgreSQL/SQLite adapter for production.
5. **Real implementations** — Replace functional placeholders with full CRUD and business logic per module (library issue/return, payroll calculation, etc.) as needed.

## Running the project

See [README.md](README.md) for backend and frontend run commands and default ports (8000 and 3000).
