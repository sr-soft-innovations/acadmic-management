# G.P. College of Pharmacy — ERP

A full-stack **College ERP (Enterprise Resource Planning)** system for pharmacy colleges: student & staff management, academics, examinations, fees, payroll, library, lab, hostel, transport, placement, and more.

## High-level overview

- **Frontend:** React SPA with role-based navigation, dashboards, and module pages.
- **Backend:** FastAPI REST API with JSON file storage (easy to swap for a DB later).
- **Features:** Admission, students, staff, courses, attendance, exams, results, fees, approvals, timetable, reports, audit logs, parent portal, student portal, and 80+ module pages (Library, Lab, Hostel, Transport, Placement, Scholarship, Notice, Events, Accreditation, etc.).
- **Roles:** Super Admin, Admin, Principal, HOD, Faculty/Staff, Student, Parent — each with role-specific dashboards and permissions.

## Design

High-level layout, design tokens, typography, and UI patterns are documented in **[DESIGN.md](./DESIGN.md)**. The app uses a fixed shell (header + sidebar + main), CSS variables in `index.css`, and consistent spacing/radius/shadow tokens across pages.

## Repository structure

```
gp-pharmacy-erp/
├── README.md                 # This file
├── DESIGN.md                 # High-level design: layout, tokens, typography
├── PROJECT.md                # Project vision, modules, roadmap
├── college-erp-frontend/     # React app (port 3000)
│   ├── src/
│   │   ├── api.js            # API client
│   │   ├── config/navConfig.js
│   │   ├── context/          # Auth, Nav
│   │   ├── pages/            # Dashboard, Students, Fees, etc.
│   │   └── components/
│   └── package.json
└── college-erp-backend/      # FastAPI app (port 8000)
    ├── app/
    │   ├── main.py           # App entry, CORS, routes
    │   ├── db.py             # JSON read/write
    │   ├── nav_config.py     # Dynamic nav & permissions
    │   ├── modules.py        # Module definitions for roles
    │   └── routers/         # Auth, students, staff, fees, exams, etc.
    └── requirements.txt
```

## Testing

- **Backend:** `cd college-erp-backend && python -m pytest tests/ -v`
- **Frontend:** `cd college-erp-frontend && npm test -- --watchAll=false`

## Quick start

### Backend

```bash
cd college-erp-backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: **http://localhost:8000/docs**

### Frontend

```bash
cd college-erp-frontend
npm install
npm start
```

App: **http://localhost:3000**

### Default login

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Super Admin |
| principal | (see users.json) | Principal |
| hod | hod123 | HOD (Pharmaceutics) |
| faculty1 | (hashed) | Faculty |
| student1 | student123 | Student |
| parent1 | parent123 | Parent |

Role-based sidebar, dashboards, and route permissions are applied automatically.

## Main modules (high-level)

| Area | Highlights |
|------|------------|
| **Academic & LMS** | Syllabus, lesson plans, study material, assignments, CO–PO mapping, academic calendar |
| **Examination & Results** | Internal/university exams, seating, marks, GPA/CGPA, hall ticket, report cards, revaluation |
| **Fee & Finance** | Fee structure, installments, scholarships, payments, receipts, due report, GST |
| **Payroll & Expense** | Salary structure, allowances, deductions, PF/ESI, payslip, expense entry, budget |
| **Communication** | Bulk SMS, WhatsApp, email, fee/attendance/exam alerts, bulk messaging |
| **Library** | Book entry, ISBN, issue/return, due tracking, fine, barcode |
| **Lab & Inventory** | Chemical stock, expiry alert, equipment, vendor, purchase orders |
| **Hostel & Transport** | Room/bed, hostel fee, mess, visitor log; bus routes, driver, route attendance |
| **Placement** | Company registration, drive scheduling, eligibility filter, selected tracking |
| **Notice & Messaging** | Department/role notices, expiry; student–staff and group messaging |
| **Events & Accreditation** | Workshops, seminar registration, certificates; NAAC reports (faculty, strength, infrastructure, research) |
| **Reports & Audit** | Custom report builder, export Excel/PDF, department analytics; activity, login, security logs |

## Configuration

- **Backend:** `college-erp-backend/app/config.py` (optional env vars).
- **Frontend:** `REACT_APP_API_URL` (default `http://localhost:8000`).
- **Nav & permissions:** Backend `nav_config.py` + `modules.py`; frontend `navConfig.js` as fallback.

## License

Proprietary / internal use. See your organization for terms.
