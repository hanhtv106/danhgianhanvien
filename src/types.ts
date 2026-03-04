export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  department_id?: number;
  branch_id?: number;
}

export interface Branch {
  id: number;
  name: string;
}

export interface Department {
  id: number;
  name: string;
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
}

export interface StarReason {
  id: number;
  stars: number;
  reason_text: string;
}

export interface Evaluation {
  employee_id: number;
  full_name: string;
  employee_code: string;
  stars: number | null;
  reason_ids: number[];
  date: string;
}
