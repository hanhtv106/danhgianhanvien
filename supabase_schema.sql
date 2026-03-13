-- Supabase Schema for danhgianhanvien

CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  branch_id INT REFERENCES branches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  branch_id INT REFERENCES branches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  branch_id INT REFERENCES branches(id) ON DELETE SET NULL,
  cccd VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  is_resigned BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS star_reasons (
  id SERIAL PRIMARY KEY,
  stars INT NOT NULL,
  reason_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  stars INT NOT NULL DEFAULT 3,
  evaluator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uc_employee_date UNIQUE (employee_id, date)
);

CREATE TABLE IF NOT EXISTS evaluation_reasons_junction (
  evaluation_id INT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  reason_id INT NOT NULL REFERENCES star_reasons(id) ON DELETE CASCADE,
  PRIMARY KEY (evaluation_id, reason_id)
);

-- Default Admin User (admin / admin123)
-- Hash generated via bcryptjs
-- INSERT INTO users (username, password, full_name, role) 
-- VALUES ('admin', '$2b$10$52lccQxtkoOuXzu3QJPu5ulkAzlFSdXEztKZY/Zb8gUFhJVPR5Vna', 'Quản trị viên', 'ADMIN')
-- ON CONFLICT (username) DO NOTHING;
