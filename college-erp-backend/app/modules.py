"""Module definitions for role permission assignment. Each module has View, Add, Edit, Delete."""

# Permission mapping: read=View, add=Add, edit=Edit, delete=Delete. write is shorthand for add+edit+delete.
MODULES = [
    {"id": "dashboard", "label": "Dashboard", "permissions": ["dashboard:read"]},
    {"id": "students", "label": "Students", "permissions": ["students:read", "students:add", "students:edit", "students:delete"]},
    {"id": "staff", "label": "Staff", "permissions": ["staff:read", "staff:add", "staff:edit", "staff:delete"]},
    {"id": "departments", "label": "Departments", "permissions": ["departments:read", "departments:add", "departments:edit", "departments:delete"]},
    {"id": "academic", "label": "Academic & LMS", "permissions": ["academic:read", "academic:add", "academic:edit", "academic:delete"]},
    {"id": "courses", "label": "Courses", "permissions": ["courses:read", "courses:add", "courses:edit", "courses:delete"]},
    {"id": "attendance", "label": "Attendance", "permissions": ["attendance:read", "attendance:add", "attendance:edit", "attendance:delete"]},
    {"id": "reports", "label": "Reports", "permissions": ["reports:read"]},
    {"id": "fees", "label": "Fees & Finance", "permissions": ["fees:read", "fees:add", "fees:edit", "fees:delete"]},
    {"id": "communication", "label": "Communication", "permissions": ["communication:read", "communication:add", "communication:edit", "communication:delete"]},
    {"id": "library", "label": "Library", "permissions": ["library:read", "library:add", "library:edit", "library:delete"]},
    {"id": "lab", "label": "Laboratory (Pharmacy)", "permissions": ["lab:read", "lab:add", "lab:edit", "lab:delete"]},
    {"id": "pharmd", "label": "Pharm.D / Hospital Training", "permissions": ["pharmd:read", "pharmd:add", "pharmd:edit", "pharmd:delete"]},
    {"id": "hostel", "label": "Hostel", "permissions": ["hostel:read", "hostel:add", "hostel:edit", "hostel:delete"]},
    {"id": "transport", "label": "Transport", "permissions": ["transport:read", "transport:add", "transport:edit", "transport:delete"]},
    {"id": "placement", "label": "Placement Management", "permissions": ["placement:read", "placement:add", "placement:edit", "placement:delete"]},
    {"id": "payroll", "label": "Payroll Management", "permissions": ["payroll:read", "payroll:add", "payroll:edit", "payroll:delete"]},
    {"id": "expense", "label": "Expense Management", "permissions": ["expense:read", "expense:add", "expense:edit", "expense:delete"]},
    {"id": "scholarship", "label": "Scholarship Management", "permissions": ["scholarship:read", "scholarship:add", "scholarship:edit", "scholarship:delete"]},
    {"id": "notice", "label": "Notice Board", "permissions": ["notice:read", "notice:add", "notice:edit", "notice:delete"]},
    {"id": "messaging", "label": "Internal Messaging", "permissions": ["messaging:read", "messaging:add", "messaging:edit", "messaging:delete"]},
    {"id": "events", "label": "Event & Seminar Management", "permissions": ["events:read", "events:add", "events:edit", "events:delete"]},
    {"id": "accreditation", "label": "Accreditation & NAAC Reports", "permissions": ["accreditation:read", "accreditation:add", "accreditation:edit", "accreditation:delete"]},
    {"id": "analytics", "label": "Graphs & charts", "permissions": ["analytics:read"]},
    {"id": "approvals", "label": "Approvals", "permissions": ["approvals:read", "approvals:add", "approvals:edit", "approvals:delete"]},
    {"id": "sessions", "label": "Sessions", "permissions": ["sessions:read", "sessions:add", "sessions:edit", "sessions:delete"]},
    {"id": "audit", "label": "Audit logs", "permissions": ["audit:read"]},
    {"id": "users", "label": "Users", "permissions": ["users:read", "users:add", "users:edit", "users:delete"]},
    {"id": "role_management", "label": "Role & permission management", "permissions": ["role_management:read", "role_management:add", "role_management:edit", "role_management:delete"]},
    {"id": "parent_portal", "label": "Parent portal", "permissions": ["parent_portal:read"]},
    {"id": "student_portal", "label": "Student portal", "permissions": ["student_portal:read"]},
    {"id": "certificates", "label": "Certificates", "permissions": ["certificates:read", "certificates:add"]},
]

# Map write -> add, edit, delete for backward compatibility when resolving permissions
WRITE_IMPLIES = ["add", "edit", "delete"]
