import express from "express";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

const app = express();
app.use(express.json({ limit: "50mb" }));

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// API Routes
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Fetch user with role_id and permissions
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*, roles(id, name, role_permissions(permissions(name)))')
      .eq('username', username)
      .single();

    if (userError || !userData || !bcrypt.compareSync(password, userData.password)) {
      return res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    }

    // Process permissions into a simple array of strings ['module:action', ...]
    const permissions = userData.roles?.role_permissions?.map((rp: any) => rp.permissions?.name).filter(Boolean) || [];

    const user = {
      id: userData.id,
      username: userData.username,
      role: userData.roles?.name || userData.role, // Use role from roles table if possible
      full_name: userData.full_name,
      department_id: userData.department_id,
      branch_id: userData.branch_id,
      permissions: permissions
    };

    const token = jwt.sign(user, JWT_SECRET);
    res.json({ token, user });
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ error: "Lỗi đăng nhập" });
  }
});

app.post("/api/change-password", authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = (req as any).user.id;
  try {
    const { data: dbUser } = await supabase.from('users').select('password').eq('id', userId).single();
    if (!dbUser || !bcrypt.compareSync(oldPassword, dbUser.password)) {
      return res.status(400).json({ error: "Mật khẩu cũ không đúng" });
    }

    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    await supabase.from('users').update({ password: hashedNewPassword }).eq('id', userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi đổi mật khẩu" });
  }
});

app.get("/api/users", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, role_id, department_id, branch_id, departments(name), branches(name)');

    if (error) throw error;

    const rows = data.map((u: any) => ({
      ...u,
      department_name: u.departments?.name,
      branch_name: u.branches?.name
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách người dùng" });
  }
});

app.post("/api/users", authenticate, async (req, res) => {
  const { username, password, full_name, role, role_id, department_id, branch_id } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const { data, error } = await supabase.from('users').insert({
      username, password: hashedPassword, full_name, role, role_id,
      department_id: department_id || null,
      branch_id: branch_id || null
    }).select('id').single();

    if (error) throw error;
    res.json({ id: data.id });
  } catch (e) {
    res.status(400).json({ error: "Tên đăng nhập đã tồn tại hoặc lỗi hệ thống" });
  }
});

app.put("/api/users/:id", authenticate, async (req, res) => {
  const { username, password, full_name, role, role_id, department_id, branch_id } = req.body;
  const { id } = req.params;
  try {
    const updates: any = { username, full_name, role, role_id, department_id: department_id || null, branch_id: branch_id || null };
    if (password) updates.password = bcrypt.hashSync(password, 10);

    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: "Lỗi khi cập nhật người dùng" });
  }
});

app.delete("/api/users/:id", authenticate, async (req, res) => {
  try {
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: "Lỗi khi xóa người dùng" }); }
});

app.get("/api/branches", authenticate, async (req, res) => {
  const user = (req as any).user;
  let query = supabase.from('branches').select('*');

  if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
    query = query.eq('id', user.branch_id);
  }

  const { data } = await query;
  res.json(data || []);
});
app.post("/api/branches", authenticate, async (req, res) => {
  const { name } = req.body;
  const { data, error } = await supabase.from('branches').insert({ name }).select('*').single();
  if (error) return res.status(400).json({ error: "Chi nhánh đã tồn tại" });
  res.json(data);
});
app.put("/api/branches/:id", authenticate, async (req, res) => {
  await supabase.from('branches').update({ name: req.body.name }).eq('id', req.params.id);
  res.json({ success: true });
});
app.delete("/api/branches/:id", authenticate, async (req, res) => {
  await supabase.from('branches').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.get("/api/departments", authenticate, async (req, res) => {
  const user = (req as any).user;
  let query = supabase.from('departments').select('*, branches(name)');

  if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
    query = query.eq('branch_id', user.branch_id);
  }

  const { data } = await query;
  const rows = (data || []).map((d: any) => ({
    ...d,
    branch_name: d.branches?.name
  }));
  res.json(rows);
});
app.post("/api/departments", authenticate, async (req, res) => {
  const { name, branch_id } = req.body;
  const { data, error } = await supabase.from('departments').insert({ name, branch_id: branch_id || null }).select('*').single();
  if (error) return res.status(400).json({ error: "Bộ phận đã tồn tại hoặc dữ liệu không hợp lệ" });
  res.json(data);
});
app.put("/api/departments/:id", authenticate, async (req, res) => {
  const { name, branch_id } = req.body;
  await supabase.from('departments').update({ name, branch_id: branch_id || null }).eq('id', req.params.id);
  res.json({ success: true });
});
app.delete("/api/departments/:id", authenticate, async (req, res) => {
  await supabase.from('departments').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.get("/api/reasons", authenticate, async (req, res) => {
  const { data } = await supabase.from('star_reasons').select('id, stars, reason_text');
  res.json(data || []);
});
app.post("/api/reasons", authenticate, async (req, res) => {
  const { stars, reason_text } = req.body;
  const { data } = await supabase.from('star_reasons').insert({ stars, reason_text }).select('*').single();
  res.json(data);
});
app.put("/api/reasons/:id", authenticate, async (req, res) => {
  await supabase.from('star_reasons').update({ stars: req.body.stars, reason_text: req.body.reason_text }).eq('id', req.params.id);
  res.json({ success: true });
});
app.delete("/api/reasons/:id", authenticate, async (req, res) => {
  await supabase.from('star_reasons').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.get("/api/employees", authenticate, async (req, res) => {
  const user = (req as any).user;
  let query = supabase.from('employees').select('id, employee_code, full_name, department_id, branch_id, cccd, is_resigned, departments(name), branches(name)');

  if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
    query = query.eq('branch_id', user.branch_id);
  }
  if (user.role === 'USER' && user.department_id) {
    query = query.eq('department_id', user.department_id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Lỗi hệ thống" });
  const rows = data.map((e: any) => ({
    ...e,
    department_name: e.departments?.name,
    branch_name: e.branches?.name
  }));
  res.json(rows);
});

app.post("/api/employees", authenticate, async (req, res) => {
  const { employee_code, full_name, department_id, branch_id, cccd, is_resigned } = req.body;
  const { data, error } = await supabase.from('employees').insert({
    employee_code, full_name, department_id, branch_id, cccd, is_resigned: is_resigned ? true : false
  }).select('id').single();
  if (error) return res.status(400).json({ error: "Lỗi khi thêm nhân viên" });
  res.json({ id: data.id });
});

app.post("/api/employees/import", authenticate, async (req, res) => {
  const { data } = req.body;
  if (!data || !Array.isArray(data)) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  try {
    const records = data.map((emp: any) => ({
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      department_id: emp.department_id,
      branch_id: emp.branch_id,
      cccd: emp.cccd || '',
      is_resigned: emp.is_resigned ? true : false
    }));
    const { error } = await supabase.from('employees').upsert(records, { onConflict: 'employee_code' });
    if (error) throw error;
    res.json({ success: true, count: data.length });
  } catch (e: any) {
    res.status(400).json({ error: "Lỗi khi import nhân viên: " + e.message });
  }
});

app.put("/api/employees/:id", authenticate, async (req, res) => {
  const { employee_code, full_name, department_id, branch_id, cccd, is_resigned } = req.body;
  const { error } = await supabase.from('employees').update({
    employee_code, full_name, department_id, branch_id, cccd, is_resigned: is_resigned ? true : false
  }).eq('id', req.params.id);
  if (error) return res.status(400).json({ error: "Lỗi khi cập nhật" });
  res.json({ success: true });
});

app.delete("/api/employees/:id", authenticate, async (req, res) => {
  await supabase.from('employees').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.get("/api/evaluations", authenticate, async (req, res) => {
  const { date, department_id } = req.query;
  try {
    let query = supabase.from('employees').select(`
      id, full_name, employee_code, is_resigned, branch_id, department_id,
      evaluations (id, stars, date, evaluation_reasons_junction (reason_id))
    `).eq('is_resigned', false);

    const user = (req as any).user;
    if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
      query = query.eq('branch_id', user.branch_id);
    }
    if (department_id) {
      query = query.eq('department_id', department_id);
    } else if (user.role === 'USER' && user.department_id) {
      query = query.eq('department_id', user.department_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const processedRows = data.map((emp: any) => {
      const evals = emp.evaluations?.filter((ev: any) => ev.date === date);
      const ev = evals?.[0];
      return {
        employee_id: emp.id,
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        stars: ev?.stars || null,
        date: ev?.date || null,
        reason_ids: ev?.evaluation_reasons_junction?.map((r: any) => r.reason_id) || []
      };
    });
    res.json(processedRows);
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi lấy danh sách đánh giá" });
  }
});

app.post("/api/evaluations", authenticate, async (req, res) => {
  const { employee_id, date, stars, reason_ids } = req.body;
  const evaluator_id = (req as any).user.id;
  try {
    const { data: evData, error: evError } = await supabase.from('evaluations').upsert({
      employee_id, date, stars, evaluator_id
    }, { onConflict: 'employee_id,date' }).select('id').single();

    if (evError) throw evError;

    await supabase.from('evaluation_reasons_junction').delete().eq('evaluation_id', evData.id);

    if (Array.isArray(reason_ids) && reason_ids.length > 0) {
      const junctions = reason_ids.map(rid => ({ evaluation_id: evData.id, reason_id: rid }));
      await supabase.from('evaluation_reasons_junction').insert(junctions);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi lưu đánh giá" });
  }
});

app.get("/api/summary", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  const user = (req as any).user;
  try {
    if (!startDate || !endDate) return res.status(400).json({ error: "Thiếu ngày bắt đầu hoặc kết thúc" });
    const start = new Date(startDate as string);
    const effectiveEndDateStr = (endDate as string) > new Date().toISOString().split('T')[0] ? new Date().toISOString().split('T')[0] : (endDate as string);
    const effectiveEnd = new Date(effectiveEndDateStr);

    let diffDays = 0;
    if (effectiveEnd >= start) {
      const diffTime = Math.abs(effectiveEnd.getTime() - start.getTime());
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    let q = supabase.from('employees').select(`
      id, employee_code, full_name, branch_id, department_id,
      departments(name), branches(name), 
      evaluations(stars, date)
    `).eq('is_resigned', false);

    if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
      q = q.eq('branch_id', user.branch_id);
    }
    if (user.role === 'USER' && user.department_id) {
      q = q.eq('department_id', user.department_id);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = data.map((emp: any) => {
      const evalsInRange = (emp.evaluations || []).filter((e: any) => e.date >= startDate && e.date <= effectiveEndDateStr);
      const sumStarsDelta = evalsInRange.reduce((acc: number, cur: any) => acc + (cur.stars - 3), 0);
      return {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_name: emp.departments?.name,
        branch_name: emp.branches?.name,
        total_stars: diffDays * 3 + sumStarsDelta,
        days_evaluated: diffDays
      };
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Lỗi báo cáo tổng hợp" }); }
});

app.get("/api/summary/departments", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const start = new Date(startDate as string);
    const effectiveEndDateStr = (endDate as string) > new Date().toISOString().split('T')[0] ? new Date().toISOString().split('T')[0] : (endDate as string);
    const effectiveEnd = new Date(effectiveEndDateStr);
    let diffDays = 0;
    if (effectiveEnd >= start) {
      diffDays = Math.ceil(Math.abs(effectiveEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    const user = (req as any).user;
    let query = supabase.from('departments').select('id, name, branch_id, employees(id, is_resigned, evaluations(stars, date))');

    if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
      query = query.eq('branch_id', user.branch_id);
    }
    if (user.role === 'USER' && user.department_id) {
      query = query.eq('id', user.department_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data.map((dept: any) => {
      const activeEmps = (dept.employees || []).filter((e: any) => !e.is_resigned);
      let totalStarsDelta = 0;
      activeEmps.forEach((emp: any) => {
        const evals = (emp.evaluations || []).filter((e: any) => e.date >= startDate && e.date <= effectiveEndDateStr);
        totalStarsDelta += evals.reduce((a: number, c: any) => a + (c.stars - 3), 0);
      });
      return {
        id: dept.id,
        department_name: dept.name,
        total_employees: activeEmps.length,
        total_stars: activeEmps.length > 0 ? (activeEmps.length * diffDays * 3 + totalStarsDelta) : 0
      };
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Lỗi báo cáo bộ phận" }); }
});

app.get("/api/reports/department/:id", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  const department_id = req.params.id;
  try {
    const effectiveEndDateStr = (endDate as string) > new Date().toISOString().split('T')[0] ? new Date().toISOString().split('T')[0] : (endDate as string);
    const start = new Date(startDate as string);
    let diffDays = Math.ceil(Math.abs(new Date(effectiveEndDateStr).getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const user = (req as any).user;
    const { data: dept } = await supabase.from('departments').select('*').eq('id', department_id).single();
    if (!dept) return res.status(404).json({ error: "Phòng ban không tồn tại" });

    // Authorization Check
    if (user.role !== 'SUPER_ADMIN') {
      if (user.branch_id && dept.branch_id !== user.branch_id) return res.status(403).json({ error: "Không có quyền xem bộ phận này" });
      if (user.role === 'USER' && user.department_id && dept.id !== user.department_id) return res.status(403).json({ error: "Không có quyền xem bộ phận này" });
    }

    const { data: emps } = await supabase.from('employees')
      .select('id, employee_code, full_name, evaluations(stars, date)')
      .eq('department_id', department_id).eq('is_resigned', false);

    const empRows = (emps || []).map((emp: any) => {
      const evals = (emp.evaluations || []).filter((e: any) => e.date >= startDate && e.date <= effectiveEndDateStr);
      const sumDelta = evals.reduce((a: number, c: any) => a + (c.stars - 3), 0);
      return {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        total_stars: diffDays * 3 + sumDelta,
        days_evaluated: diffDays
      };
    });
    res.json({ department: dept, employees: empRows });
  } catch (err) { res.status(500).json({ error: "Lỗi chi tiết phòng ban" }); }
});

app.get("/api/reports/employee/:id", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  const employee_id = req.params.id;
  try {
    const effectiveEndDateStr = (endDate as string) > new Date().toISOString().split('T')[0] ? new Date().toISOString().split('T')[0] : (endDate as string);

    const user = (req as any).user;
    const { data: empData } = await supabase.from('employees').select('*, departments(name), branches(name)').eq('id', employee_id).single();
    if (!empData) return res.status(404).json({ error: "Nhân viên không tồn tại" });

    // Authorization Check
    if (user.role !== 'SUPER_ADMIN') {
      if (user.branch_id && empData.branch_id !== user.branch_id) return res.status(403).json({ error: "Không có quyền xem nhân viên này" });
      if (user.role === 'USER' && user.department_id && empData.department_id !== user.department_id) return res.status(403).json({ error: "Không có quyền xem nhân viên này" });
    }

    const employee = {
      ...empData,
      department_name: empData.departments?.name,
      branch_name: empData.branches?.name
    };

    const { data: evals } = await supabase.from('evaluations')
      .select('*, users(full_name), evaluation_reasons_junction(star_reasons(reason_text))')
      .eq('employee_id', employee_id)
      .gte('date', startDate)
      .lte('date', effectiveEndDateStr)
      .order('date', { ascending: false });

    const evaluationsRows = (evals || []).map((ev: any) => {
      const reasons = ev.evaluation_reasons_junction?.map((erj: any) => erj.star_reasons?.reason_text) || [];
      return {
        ...ev,
        evaluator_name: ev.users?.full_name,
        reason_text: reasons.join(', ')
      };
    });

    res.json({ employee, evaluations: evaluationsRows });
  } catch (err) { res.status(500).json({ error: "Lỗi chi tiết nhân viên" }); }
});

// RBAC Management
app.get("/api/roles", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from('roles').select('*, role_permissions(permission_id)');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: "Lỗi lấy danh sách vai trò" }); }
});

app.get("/api/permissions", authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase.from('permissions').select('*').order('module').order('action');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: "Lỗi lấy danh sách quyền" }); }
});

app.post("/api/roles/:id/permissions", authenticate, async (req, res) => {
  const roleId = req.params.id;
  const { permissionIds } = req.body; // Array of IDs
  try {
    // Delete old
    await supabase.from('role_permissions').delete().eq('role_id', roleId);
    // Insert new
    if (permissionIds && permissionIds.length > 0) {
      const inserts = permissionIds.map((pid: number) => ({ role_id: parseInt(roleId), permission_id: pid }));
      const { error } = await supabase.from('role_permissions').insert(inserts);
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Lỗi cập nhật quyền hạn" }); }
});

export default app;
