-- SQL script to create RBAC Tables for danhgianhanvien

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

-- 2. Create Permissions Table (formatted as module:action)
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL, -- view, create, edit, delete
  name VARCHAR(100) NOT NULL UNIQUE
);

-- 3. Create Role-Permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Add role_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);

-- 5. Seed initial roles
INSERT INTO roles (id, name, description) VALUES
(1, 'SUPER_ADMIN', 'Toàn quyền hệ thống'),
(2, 'ADMIN', 'Quản lý nhân sự và đánh giá'),
(3, 'USER', 'Chỉ đánh giá và xem báo cáo')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed permissions for each module
-- Modules: employees, branches, departments, reasons, users, evaluations, reports
INSERT INTO permissions (module, action, name) VALUES
('employees', 'view', 'employees:view'), ('employees', 'create', 'employees:create'), ('employees', 'edit', 'employees:edit'), ('employees', 'delete', 'employees:delete'),
('branches', 'view', 'branches:view'), ('branches', 'create', 'branches:create'), ('branches', 'edit', 'branches:edit'), ('branches', 'delete', 'branches:delete'),
('departments', 'view', 'departments:view'), ('departments', 'create', 'departments:create'), ('departments', 'edit', 'departments:edit'), ('departments', 'delete', 'departments:delete'),
('reasons', 'view', 'reasons:view'), ('reasons', 'create', 'reasons:create'), ('reasons', 'edit', 'reasons:edit'), ('reasons', 'delete', 'reasons:delete'),
('users', 'view', 'users:view'), ('users', 'create', 'users:create'), ('users', 'edit', 'users:edit'), ('users', 'delete', 'users:delete'),
('evaluations', 'view', 'evaluations:view'), ('evaluations', 'create', 'evaluations:create'), ('evaluations', 'edit', 'evaluations:edit'), ('evaluations', 'delete', 'evaluations:delete'),
('reports', 'view', 'reports:view'), ('reports', 'create', 'reports:create'), ('reports', 'edit', 'reports:edit'), ('reports', 'delete', 'reports:delete')
ON CONFLICT (name) DO NOTHING;

-- 7. map super admin permissions (all)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON CONFLICT DO NOTHING;

-- 8. map admin permissions (exclude branches delete, exclude users management normally, or according to user preference)
-- For now, give them view/create/edit on everything except deleting branches or managing users if you like
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE module NOT IN ('users', 'branches')
ON CONFLICT DO NOTHING;

-- 9. map user permissions (view/create evaluation, view reports)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE (module = 'evaluations' AND action IN ('view', 'create')) OR (module = 'reports' AND action = 'view')
ON CONFLICT DO NOTHING;

-- Update the admin user to have the super_admin role_id
UPDATE users SET role_id = 1 WHERE username = 'admin';
