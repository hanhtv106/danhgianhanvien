-- =========================================================================
-- MIGRATION: Fix lỗi Overloading Function ở Database
-- Việc dùng lệnh cũ tạo ra 2 hàm get_employees_dashboard_stats cùng lúc (một cái BIGINT, một cái INT), làm Postgres không phân biệt được.
-- Script này sẽ xoá SẠCH các hàm bị trùng lặp rồi tạo lại một cách chính xác nhất.
-- Vui lòng CHẠY TRỰC TIẾP toàn bộ script này trong công cụ SQL Editor của Supabase.
-- =========================================================================

-- XOÁ CÁC HÀM BỊ TRÙNG LẶP (OVERLOADING) TRƯỚC VỚI CẢ INT VÀ BIGINT
DROP FUNCTION IF EXISTS get_employee_stars_summary(DATE, DATE, BIGINT, BIGINT, BIGINT, BOOLEAN);
DROP FUNCTION IF EXISTS get_employee_stars_summary(DATE, DATE, INT, INT, INT, BOOLEAN);

DROP FUNCTION IF EXISTS get_employees_dashboard_stats(BIGINT, BIGINT, BOOLEAN);
DROP FUNCTION IF EXISTS get_employees_dashboard_stats(INT, INT, BOOLEAN);


-- 1. Hàm tính điểm chi tiết cho danh sách nhân viên theo thời gian (Summary/Reports)
CREATE OR REPLACE FUNCTION get_employee_stars_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_branch_id INT DEFAULT NULL,
  p_dept_id INT DEFAULT NULL,
  p_employee_id INT DEFAULT NULL,
  p_is_resigned BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  employee_id INT,
  employee_code VARCHAR,
  full_name VARCHAR,
  branch_id INT,
  branch_name VARCHAR,
  department_id INT,
  department_name VARCHAR,
  is_resigned BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  days_evaluated INT,
  total_stars INT
) AS $$
DECLARE
  v_effective_end DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF p_end_date > v_today THEN
    v_effective_end := v_today;
  ELSE
    v_effective_end := p_end_date;
  END IF;

  RETURN QUERY
  WITH emp_filtered AS (
    SELECT 
      e.id, e.employee_code, e.full_name, e.branch_id, e.department_id, e.is_resigned, e.created_at,
      b.name AS b_name,
      d.name AS d_name,
      CASE 
        WHEN (e.created_at AT TIME ZONE 'UTC')::DATE > v_effective_end THEN 0
        ELSE (v_effective_end - GREATEST((e.created_at AT TIME ZONE 'UTC')::DATE, p_start_date)) + 1
      END AS calculated_days
    FROM employees e
    LEFT JOIN branches b ON b.id = e.branch_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (p_dept_id IS NULL OR e.department_id = p_dept_id)
      AND (p_employee_id IS NULL OR e.id = p_employee_id)
      AND (p_is_resigned IS NULL OR e.is_resigned = p_is_resigned)
  ),
  eval_deltas AS (
    SELECT 
      ev.employee_id,
      SUM(ev.stars - 3) AS delta
    FROM evaluations ev
    WHERE ev.date >= p_start_date AND ev.date <= v_effective_end
    GROUP BY ev.employee_id
  )
  SELECT 
    ef.id::INT, ef.employee_code::VARCHAR, ef.full_name::VARCHAR, ef.branch_id::INT, ef.b_name::VARCHAR, ef.department_id::INT, ef.d_name::VARCHAR, ef.is_resigned::BOOLEAN, ef.created_at::TIMESTAMP WITH TIME ZONE,
    ef.calculated_days::INT,
    ((ef.calculated_days * 3) + COALESCE(ed.delta, 0))::INT AS total_stars
  FROM emp_filtered ef
  LEFT JOIN eval_deltas ed ON ed.employee_id = ef.id;
END;
$$ LANGUAGE plpgsql STABLE;



-- 2. Hàm tính điểm tổng hợp Tháng/Năm/Toàn thời gian (Dùng cho Dashboard, Danh sách nhân viên)
CREATE OR REPLACE FUNCTION get_employees_dashboard_stats(
  p_branch_id INT DEFAULT NULL,
  p_dept_id INT DEFAULT NULL,
  p_is_resigned BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  employee_code VARCHAR,
  full_name VARCHAR,
  email VARCHAR,
  department_id INT,
  branch_id INT,
  cccd VARCHAR,
  is_resigned BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  department_name VARCHAR,
  branch_name VARCHAR,
  created_by_name VARCHAR,
  updated_by_name VARCHAR,
  stars_month INT,
  stars_year INT,
  stars_all_time INT
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_start_month DATE := date_trunc('month', v_today)::DATE;
  v_start_year DATE := date_trunc('year', v_today)::DATE;
  v_start_all_time DATE := '2020-01-01'::DATE;
BEGIN
  RETURN QUERY
  WITH emp_filtered AS (
    SELECT e.*,
      b.name AS b_name, d.name AS d_name, uc.full_name AS uc_name, uu.full_name AS uu_name,
      CASE WHEN (e.created_at AT TIME ZONE 'UTC')::DATE > v_today THEN 0 ELSE (v_today - GREATEST((e.created_at AT TIME ZONE 'UTC')::DATE, v_start_month)) + 1 END AS d_month,
      CASE WHEN (e.created_at AT TIME ZONE 'UTC')::DATE > v_today THEN 0 ELSE (v_today - GREATEST((e.created_at AT TIME ZONE 'UTC')::DATE, v_start_year)) + 1 END AS d_year,
      CASE WHEN (e.created_at AT TIME ZONE 'UTC')::DATE > v_today THEN 0 ELSE (v_today - GREATEST((e.created_at AT TIME ZONE 'UTC')::DATE, v_start_all_time)) + 1 END AS d_all
    FROM employees e
    LEFT JOIN branches b ON b.id = e.branch_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN users uc ON uc.id = e.created_by
    LEFT JOIN users uu ON uu.id = e.updated_by
    WHERE (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (p_dept_id IS NULL OR e.department_id = p_dept_id)
      AND (p_is_resigned IS NULL OR e.is_resigned = p_is_resigned)
  ),
  eval_deltas AS (
    SELECT 
      ev.employee_id,
      SUM(CASE WHEN ev.date >= v_start_month AND ev.date <= v_today THEN ev.stars - 3 ELSE 0 END) AS delta_m,
      SUM(CASE WHEN ev.date >= v_start_year AND ev.date <= v_today THEN ev.stars - 3 ELSE 0 END) AS delta_y,
      SUM(CASE WHEN ev.date >= v_start_all_time AND ev.date <= v_today THEN ev.stars - 3 ELSE 0 END) AS delta_a
    FROM evaluations ev
    WHERE ev.date <= v_today
    GROUP BY ev.employee_id
  )
  SELECT 
    ef.id::INT, ef.employee_code::VARCHAR, ef.full_name::VARCHAR, ef.email::VARCHAR, ef.department_id::INT, ef.branch_id::INT, ef.cccd::VARCHAR, ef.is_resigned::BOOLEAN, ef.created_at::TIMESTAMP WITH TIME ZONE, ef.updated_at::TIMESTAMP WITH TIME ZONE,
    ef.d_name::VARCHAR AS department_name, ef.b_name::VARCHAR AS branch_name, ef.uc_name::VARCHAR AS created_by_name, ef.uu_name::VARCHAR AS updated_by_name,
    ((ef.d_month * 3) + COALESCE(ed.delta_m, 0))::INT AS stars_month,
    ((ef.d_year * 3) + COALESCE(ed.delta_y, 0))::INT AS stars_year,
    ((ef.d_all * 3) + COALESCE(ed.delta_a, 0))::INT AS stars_all_time
  FROM emp_filtered ef
  LEFT JOIN eval_deltas ed ON ed.employee_id = ef.id;
END;
$$ LANGUAGE plpgsql STABLE;
