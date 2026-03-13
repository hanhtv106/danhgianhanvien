export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  department_id?: number;
  branch_id?: number;
  permissions?: string[];
}

export interface Branch {
  id: number;
  name: string;
}

export interface Department {
  id: number;
  name: string;
  branch_id?: number;
  branch_name?: string;
}

export interface Position {
  id: number;
  name: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  department_id: number;
  department_name?: string;
  branch_id: number;
  branch_name?: string;
  cccd: string;
  is_resigned: boolean;
  created_at?: string;
  created_by_name?: string;
  updated_at?: string;
  updated_by_name?: string;
  stars_month?: number;
  stars_year?: number;
  stars_all_time?: number;
  email?: string;
}

export interface StarReason {
  id: number;
  stars: number;
  reason_text: string;
  created_by?: number;
  department_id?: number | null;
  department_name?: string;
}

export interface Evaluation {
  employee_id: number;
  full_name: string;
  employee_code: string;
  stars: number | null;
  reason_ids: number[];
  note?: string;
  date: string;
  department_id?: number;
}
