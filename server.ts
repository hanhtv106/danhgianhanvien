import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  const PORT = process.env.PORT || 3000;

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);

      // Check if this token is still valid (not replaced by a newer login)
      const { data: userData, error } = await supabase
        .from('users')
        .select('current_token')
        .eq('id', decoded.id)
        .single();

      if (error || !userData || userData.current_token !== token) {
        return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn hoặc được đăng nhập ở nơi khác" });
      }

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

      // Store the latest token to enforce single-device login
      await supabase.from('users').update({ current_token: token }).eq('id', userData.id);

      res.json({ token, user });
    } catch (err) {
      console.error("Login route error:", err);
      res.status(500).json({ error: "Lỗi đăng nhập" });
    }
  });

  app.get("/api/auth/check", authenticate, async (req, res) => {
    res.json({ success: true });
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
    const { data } = await supabase.from('star_reasons').select('id, stars, reason_text, created_by');
    res.json(data || []);
  });
  app.post("/api/reasons", authenticate, async (req, res) => {
    const { stars, reason_text } = req.body;
    const user = (req as any).user;
    const { data, error } = await supabase.from('star_reasons').insert({
      stars, reason_text, created_by: user.id
    }).select('*').single();
    if (error) return res.status(400).json({ error: "Lỗi khi thêm lý do" });
    res.json(data);
  });
  app.put("/api/reasons/:id", authenticate, async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    const { stars, reason_text } = req.body;

    const { data: reason } = await supabase.from('star_reasons').select('created_by').eq('id', id).single();
    if (!reason) return res.status(404).json({ error: "Lý do không tồn tại" });
    if (user.role !== 'SUPER_ADMIN' && reason.created_by !== user.id) {
      return res.status(403).json({ error: "Bạn không có quyền sửa lý do này" });
    }

    await supabase.from('star_reasons').update({ stars, reason_text }).eq('id', id);
    res.json({ success: true });
  });
  app.delete("/api/reasons/:id", authenticate, async (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;

    const { data: reason } = await supabase.from('star_reasons').select('created_by').eq('id', id).single();
    if (!reason) return res.status(404).json({ error: "Lý do không tồn tại" });
    if (user.role !== 'SUPER_ADMIN' && reason.created_by !== user.id) {
      return res.status(403).json({ error: "Bạn không có quyền xóa lý do này" });
    }

    await supabase.from('star_reasons').delete().eq('id', id);
    res.json({ success: true });
  });

  app.get("/api/employees", authenticate, async (req, res) => {
    const user = (req as any).user;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const startOfYear = `${currentYear}-01-01`;
    const startOfAllTime = `2020-01-01`;

    const nextMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(nextMonth.getTime() - 1);
    const endOfMonth = lastDayOfMonth.toISOString().split('T')[0];
    const endOfYear = `${currentYear}-12-31`;

    const monthStartObj = new Date(startOfMonth);
    const monthEndObj = todayStr > endOfMonth ? new Date(endOfMonth) : new Date(todayStr);
    const monthDiffDays = Math.ceil((monthEndObj.getTime() - monthStartObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const yearStartObj = new Date(startOfYear);
    const yearEndObj = todayStr > endOfYear ? new Date(endOfYear) : new Date(todayStr);
    const yearDiffDays = Math.ceil((yearEndObj.getTime() - yearStartObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const allTimeStartObj = new Date(startOfAllTime);
    const allTimeEndObj = todayStr > endOfYear ? new Date(endOfYear) : new Date(todayStr);
    const allTimeDiffDays = Math.ceil((allTimeEndObj.getTime() - allTimeStartObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let query = supabase.from('employees').select(`
      id, employee_code, full_name, department_id, branch_id, cccd, is_resigned, created_at, updated_at,
      departments(name), branches(name),
      created_by_user:users!employees_created_by_fkey(full_name),
      updated_by_user:users!employees_updated_by_fkey(full_name)
    `);

    if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
      query = query.eq('branch_id', user.branch_id);
    }
    if (user.role === 'USER' && user.department_id) {
      query = query.eq('department_id', user.department_id);
    }

    const { data: employees, error: eErr } = await query;
    if (eErr) return res.status(500).json({ error: "Lỗi hệ thống" });

    // Fetch all evaluations for these employees
    const empIds = employees.map(e => e.id);
    const { data: evals, error: evErr } = await supabase.from('evaluations')
      .select('employee_id, stars, date')
      .in('employee_id', empIds)
      .gte('date', startOfAllTime)
      .lte('date', endOfYear);

    const evaluationData = evals || [];

    const rows = employees.map((e: any) => {
      const empEvals = evaluationData.filter(ev => ev.employee_id === e.id);

      // Month stars
      const monthDelta = empEvals.filter(ev => ev.date >= startOfMonth && ev.date <= endOfMonth).reduce((a, c) => a + (c.stars - 3), 0);
      const monthDays = getEmpDiffDays(e.created_at, monthStartObj, monthEndObj, monthDiffDays);
      const monthStars = monthDays * 3 + monthDelta;

      // Year stars
      const yearDelta = empEvals.filter(ev => ev.date >= startOfYear && ev.date <= endOfYear).reduce((a, c) => a + (c.stars - 3), 0);
      const yearDays = getEmpDiffDays(e.created_at, yearStartObj, yearEndObj, yearDiffDays);
      const yearStars = yearDays * 3 + yearDelta;

      // All Time stars
      const allTimeDelta = empEvals.reduce((a, c) => a + (c.stars - 3), 0);
      const allTimeDays = getEmpDiffDays(e.created_at, allTimeStartObj, allTimeEndObj, allTimeDiffDays);
      const allTimeStars = allTimeDays * 3 + allTimeDelta;

      return {
        ...e,
        department_name: e.departments?.name,
        branch_name: e.branches?.name,
        created_by_name: (e as any).created_by_user?.full_name,
        updated_by_name: (e as any).updated_by_user?.full_name,
        stars_month: monthStars,
        stars_year: yearStars,
        stars_all_time: allTimeStars
      };
    });
    res.json(rows);
  });

  app.post("/api/employees", authenticate, async (req, res) => {
    const { employee_code, full_name, department_id, branch_id, cccd, is_resigned, created_at } = req.body;
    const user = (req as any).user;
    const { data, error } = await supabase.from('employees').insert({
      employee_code, full_name, department_id, branch_id, cccd,
      is_resigned: is_resigned ? true : false,
      created_by: user.id,
      created_at: created_at ? new Date(created_at).toISOString() : new Date().toISOString()
    }).select('id').single();
    if (error) return res.status(400).json({ error: "Lỗi khi thêm nhân viên" });
    res.json({ id: data.id });
  });

  app.post("/api/employees/import", authenticate, async (req, res) => {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    try {
      const user = (req as any).user;
      const records = data.map((emp: any) => ({
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_id: emp.department_id,
        branch_id: emp.branch_id,
        cccd: emp.cccd || '',
        is_resigned: emp.is_resigned ? true : false,
        created_by: user.id
      }));
      const { error } = await supabase.from('employees').upsert(records, { onConflict: 'employee_code' });
      if (error) throw error;
      res.json({ success: true, count: data.length });
    } catch (e: any) {
      res.status(400).json({ error: "Lỗi khi import nhân viên: " + e.message });
    }
  });

  app.put("/api/employees/:id", authenticate, async (req, res) => {
    const { employee_code, full_name, department_id, branch_id, cccd, is_resigned, created_at } = req.body;
    const user = (req as any).user;
    const updateData: any = {
      employee_code, full_name, department_id, branch_id, cccd,
      is_resigned: is_resigned ? true : false,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };
    if (created_at) {
      updateData.created_at = new Date(created_at).toISOString();
    }
    try {
      const { error } = await supabase.from('employees').update(updateData).eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Lỗi /api/employees/:id PUT:", err);
      res.status(400).json({ error: "Lỗi khi cập nhật nhân viên" });
    }
  });

  app.delete("/api/employees/:id", authenticate, async (req, res) => {
    await supabase.from('employees').delete().eq('id', req.params.id);
    res.json({ success: true });
  });

  app.get("/api/evaluations", authenticate, async (req, res) => {
    const { date, department_id, branch_id, search } = req.query;
    try {
      let query = supabase.from('employees').select(`
        id, full_name, employee_code, is_resigned, branch_id, department_id
      `).eq('is_resigned', false);

      const user = (req as any).user;

      // Branch filtering
      if (user.role === 'SUPER_ADMIN') {
        if (branch_id && branch_id !== 'all') {
          query = query.eq('branch_id', branch_id);
        }
      } else if (user.branch_id) {
        query = query.eq('branch_id', user.branch_id);
      }

      // Department filtering
      if (department_id && department_id !== 'all') {
        query = query.eq('department_id', department_id);
      } else if (user.role === 'USER' && user.department_id) {
        query = query.eq('department_id', user.department_id);
      }

      // Search filtering
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,employee_code.ilike.%${search}%`);
      }

      const { data: employees, error } = await query;
      if (error) throw error;

      let evals: any[] = [];
      if (employees && employees.length > 0) {
        const empIds = employees.map((e: any) => e.id);
        const { data: evData } = await supabase.from('evaluations')
          .select('id, employee_id, stars, date, note, evaluation_reasons_junction (reason_id)')
          .in('employee_id', empIds)
          .eq('date', date);
        evals = evData || [];
      }

      const processedRows = (employees || []).map((emp: any) => {
        const ev = evals.find((e: any) => e.employee_id === emp.id);
        return {
          employee_id: emp.id,
          full_name: emp.full_name,
          employee_code: emp.employee_code,
          stars: ev?.stars || null,
          date: ev?.date || null,
          reason_ids: ev?.evaluation_reasons_junction?.map((r: any) => r.reason_id) || [],
          note: ev?.note || ""
        };
      });
      res.json(processedRows);
    } catch (err) {
      res.status(500).json({ error: "Lỗi hệ thống khi lấy danh sách đánh giá" });
    }
  });

  app.post("/api/evaluations", authenticate, async (req, res) => {
    const { employee_id, date, stars, reason_ids, note } = req.body;
    const evaluator_id = (req as any).user.id;
    console.log("Saving evaluation:", { employee_id, date, stars, reason_ids });
    try {
      const updateObj = { employee_id, date, stars, evaluator_id, note };
      const { data: evData, error: evError } = await supabase.from('evaluations')
        .upsert(updateObj, { onConflict: 'employee_id,date' })
        .select('id');

      if (evError) {
        console.error("Supabase upsert error:", evError);
        throw evError;
      }

      const firstId = evData && evData.length > 0 ? evData[0].id : null;
      if (!firstId) throw new Error("Could not get evaluation ID after upsert");

      await supabase.from('evaluation_reasons_junction').delete().eq('evaluation_id', firstId);

      if (Array.isArray(reason_ids) && reason_ids.length > 0) {
        const junctions = reason_ids.map(rid => ({ evaluation_id: firstId, reason_id: rid }));
        await supabase.from('evaluation_reasons_junction').insert(junctions);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Lỗi /api/evaluations POST:", err);
      res.status(500).json({ error: "Lỗi khi lưu đánh giá" });
    }
  });

  function getEmpDiffDays(created_at: string | null | undefined, filterStart: Date, filterEnd: Date, globalDiffDays: number) {
    if (!created_at) {
      // Nếu không có ngày gia nhập, chỉ tính từ ngày hôm nay (mặc định 1 ngày)
      return 1;
    }
    const createdDate = new Date(created_at);
    createdDate.setHours(0, 0, 0, 0);

    const filterStartClean = new Date(filterStart);
    filterStartClean.setHours(0, 0, 0, 0);
    const filterEndClean = new Date(filterEnd);
    filterEndClean.setHours(0, 0, 0, 0);

    // Ngày bắt đầu tính điểm thực tế là ngày muộn nhất giữa ngày gia nhập và ngày bắt đầu bộ lọc
    const effectiveEmpStart = createdDate > filterStartClean ? createdDate : filterStartClean;

    // Nếu ngày gia nhập muộn hơn cả ngày kết thúc bộ lọc (ví dụ lọc tháng 1 nhưng nhân viên vào tháng 3)
    if (effectiveEmpStart > filterEndClean) {
      return 0;
    }

    return Math.ceil(Math.abs(filterEndClean.getTime() - effectiveEmpStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

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
        id, employee_code, full_name, branch_id, department_id, created_at,
        departments(name), branches(name)
      `).eq('is_resigned', false);

      if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
        q = q.eq('branch_id', user.branch_id);
      }
      if (user.role === 'USER' && user.department_id) {
        q = q.eq('department_id', user.department_id);
      }

      const { data: employees, error } = await q;
      if (error) throw error;

      let evals: any[] = [];
      if (employees && employees.length > 0) {
        const empIds = employees.map((e: any) => e.id);

        // Batch employee IDs into chunks if there are too many, but Supabase limit is usually high enough for .in()
        // We will perform a single query for evaluations
        const { data: evData } = await supabase.from('evaluations')
          .select('employee_id, stars')
          .in('employee_id', empIds)
          .gte('date', startDate)
          .lte('date', effectiveEndDateStr);

        evals = evData || [];
      }

      const rows = (employees || []).map((emp: any) => {
        const rows = (employees || []).map((emp: any) => {
          const evalsInRange = evals.filter((e: any) => e.employee_id === emp.id);
          const delta = evalsInRange.reduce((acc: number, cur: any) => acc + (cur.stars - 3), 0);
          const empDiffDays = getEmpDiffDays(emp.created_at, start, effectiveEnd, diffDays);
          return {
            id: emp.id,
            employee_code: emp.employee_code,
            full_name: emp.full_name,
            department_name: emp.departments?.name,
            branch_name: emp.branches?.name,
            total_stars: empDiffDays * 3 + delta,
            days_evaluated: empDiffDays
          };
        });
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
      let query = supabase.from('departments').select('id, name, branch_id, employees(id, is_resigned, created_at)');

      if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
        query = query.eq('branch_id', user.branch_id);
      }
      if (user.role === 'USER' && user.department_id) {
        query = query.eq('id', user.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allEmpIds: number[] = [];
      data.forEach((dept: any) => {
        const activeEmps = (dept.employees || []).filter((e: any) => !e.is_resigned);
        activeEmps.forEach((e: any) => allEmpIds.push(e.id));
      });

      let evals: any[] = [];
      if (allEmpIds.length > 0) {
        const { data: evData } = await supabase.from('evaluations')
          .select('employee_id, stars')
          .in('employee_id', allEmpIds)
          .gte('date', startDate)
          .lte('date', effectiveEndDateStr);
        evals = evData || [];
      }

      const rows = data.map((dept: any) => {
        const activeEmps = (dept.employees || []).filter((e: any) => !e.is_resigned);
        let totalStars = 0;
        activeEmps.forEach((emp: any) => {
          const evalsInRange = evals.filter((e: any) => e.employee_id === emp.id);
          const delta = evalsInRange.reduce((a: number, c: any) => a + (c.stars - 3), 0);
          const empDays = getEmpDiffDays(emp.created_at, start, effectiveEnd, diffDays);
          totalStars += (empDays * 3 + delta);
        });
        return {
          id: dept.id,
          department_name: dept.name,
          total_employees: activeEmps.length,
          total_stars: totalStars
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
      const effectiveEnd = new Date(effectiveEndDateStr);
      let diffDays = Math.ceil(Math.abs(effectiveEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const user = (req as any).user;
      const { data: dept } = await supabase.from('departments').select('*').eq('id', department_id).single();
      if (!dept) return res.status(404).json({ error: "Phòng ban không tồn tại" });

      // Authorization Check
      if (user.role !== 'SUPER_ADMIN') {
        if (user.branch_id && dept.branch_id !== user.branch_id) return res.status(403).json({ error: "Không có quyền xem bộ phận này" });
        if (user.role === 'USER' && user.department_id && dept.id !== user.department_id) return res.status(403).json({ error: "Không có quyền xem bộ phận này" });
      }

      const { data: emps } = await supabase.from('employees')
        .select('id, employee_code, full_name, created_at')
        .eq('department_id', department_id).eq('is_resigned', false);

      let evals: any[] = [];
      if (emps && emps.length > 0) {
        const empIds = emps.map((e: any) => e.id);
        const { data: evData } = await supabase.from('evaluations')
          .select('employee_id, stars')
          .in('employee_id', empIds)
          .gte('date', startDate)
          .lte('date', effectiveEndDateStr);
        evals = evData || [];
      }

      const empRows = (emps || []).map((emp: any) => {
        const evalsInRange = evals.filter((e: any) => e.employee_id === emp.id);
        const delta = evalsInRange.reduce((a: number, c: any) => a + (c.stars - 3), 0);
        const empDiffDays = getEmpDiffDays(emp.created_at, start, effectiveEnd, diffDays);
        return {
          id: emp.id,
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          total_stars: empDiffDays * 3 + delta,
          days_evaluated: empDiffDays
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
      const { data: empData } = await supabase.from('employees').select(`
        *, departments(name), branches(name),
        created_by_user:users!employees_created_by_fkey(full_name),
        updated_by_user:users!employees_updated_by_fkey(full_name)
      `).eq('id', employee_id).single();
      if (!empData) return res.status(404).json({ error: "Nhân viên không tồn tại" });

      // Authorization Check
      if (user.role !== 'SUPER_ADMIN') {
        if (user.branch_id && empData.branch_id !== user.branch_id) return res.status(403).json({ error: "Không có quyền xem nhân viên này" });
        if (user.role === 'USER' && user.department_id && empData.department_id !== user.department_id) return res.status(403).json({ error: "Không có quyền xem nhân viên này" });
      }

      const employee = {
        ...empData,
        department_name: empData.departments?.name,
        branch_name: empData.branches?.name,
        created_by_name: (empData as any).created_by_user?.full_name,
        updated_by_name: (empData as any).updated_by_user?.full_name
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

  // Dashboard
  app.get("/api/dashboard/overview", authenticate, async (req, res) => {
    try {
      const user = (req as any).user;
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // We fetch everything and process in JS since sqlite/supabase aggregations can be tricky with auth filters if not using views.
      let qEmps = supabase.from('employees')
        .select('id, full_name, branch_id, department_id, created_at, branches(name), departments(name)')
        .eq('is_resigned', false);

      if (user.role !== 'SUPER_ADMIN' && user.branch_id) {
        qEmps = qEmps.eq('branch_id', user.branch_id);
      }
      if (user.role === 'USER' && user.department_id) {
        qEmps = qEmps.eq('department_id', user.department_id);
      }

      const { data: employees, error: eErr } = await qEmps;
      if (eErr) throw eErr;

      const total_employees = employees?.length || 0;

      // Direct counts for KPI cards (not inferred from employees)
      let bQuery = supabase.from('branches').select('*', { count: 'exact', head: true });
      if (user.role !== 'SUPER_ADMIN' && user.branch_id) bQuery = bQuery.eq('id', user.branch_id);
      const { count: total_branches } = await bQuery;

      let dQuery = supabase.from('departments').select('*', { count: 'exact', head: true });
      if (user.role !== 'SUPER_ADMIN' && user.branch_id) dQuery = dQuery.eq('branch_id', user.branch_id);
      if (user.role === 'USER' && user.department_id) dQuery = dQuery.eq('id', user.department_id);
      const { count: total_departments } = await dQuery;

      // Breakdown (employee per branch/dept) - keeping this logic for the charts/lists
      const branchBreakdown: Record<string, number> = {};
      const deptBreakdown: Record<string, number> = {};

      employees?.forEach((e: any) => {
        if (e.branch_id) {
          const bName = e.branches?.name || 'Chưa xếp nhánh';
          branchBreakdown[bName] = (branchBreakdown[bName] || 0) + 1;
        }
        if (e.department_id) {
          const dName = e.departments?.name || 'Chưa xếp phòng';
          deptBreakdown[dName] = (deptBreakdown[dName] || 0) + 1;
        }
      });

      // Definitions for time ranges
      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;
      const startOfMonth = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      const startOfAllTime = `2020-01-01`; // Safe lower bound

      // Determine the last day of the current month
      const nextMonth = new Date(currentYear, currentMonth, 1);
      const lastDayOfMonth = new Date(nextMonth.getTime() - 1);
      const endOfMonth = lastDayOfMonth.toISOString().split('T')[0];

      let evals: any[] = [];
      if (employees && employees.length > 0) {
        const empIds = employees.map((e: any) => e.id);
        const { data: evData } = await supabase.from('evaluations')
          .select('employee_id, stars, date')
          .in('employee_id', empIds)
          .gte('date', startOfAllTime)
          .lte('date', endOfYear);
        evals = evData || [];
      }

      // Calculate diff days
      const todayStr = new Date().toISOString().split('T')[0];

      // All time
      const allTimeStartObj = new Date(startOfAllTime);
      const allTimeEndObj = todayStr > endOfYear ? new Date(endOfYear) : new Date(todayStr); // should use endOfYear if we want to cap at today
      const allTimeDiffDays = Math.ceil((allTimeEndObj.getTime() - allTimeStartObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Year
      const yearStartObj = new Date(startOfYear);
      const yearEndObj = todayStr > endOfYear ? new Date(endOfYear) : new Date(todayStr);
      const yearDiffDays = Math.ceil((yearEndObj.getTime() - yearStartObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Month
      const monthStartObj = new Date(startOfMonth);
      const monthEndObj = todayStr > endOfMonth ? new Date(endOfMonth) : new Date(todayStr);
      const monthDiffDays = Math.ceil((monthEndObj.getTime() - monthStartObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const empScoresAllTime = employees?.map((emp: any) => {
        const evs = evals.filter((e: any) => e.employee_id === emp.id);
        const delta = evs.reduce((a: number, c: any) => a + (c.stars - 3), 0);
        const empDiffDays = getEmpDiffDays(emp.created_at, allTimeStartObj, allTimeEndObj, allTimeDiffDays);
        return { id: emp.id, name: emp.full_name, branch: emp.branches?.name, total: empDiffDays * 3 + delta };
      }) || [];

      const empScoresYear = employees?.map((emp: any) => {
        const evs = evals.filter((e: any) => e.employee_id === emp.id && e.date >= startOfYear && e.date <= endOfYear);
        const delta = evs.reduce((a: number, c: any) => a + (c.stars - 3), 0);
        const empDiffDays = getEmpDiffDays(emp.created_at, yearStartObj, yearEndObj, yearDiffDays);
        return { id: emp.id, name: emp.full_name, branch: emp.branches?.name, total: empDiffDays * 3 + delta };
      }) || [];

      const empScoresMonth = employees?.map((emp: any) => {
        const evs = evals.filter((e: any) => e.employee_id === emp.id && e.date >= startOfMonth && e.date <= endOfMonth);
        const delta = evs.reduce((a: number, c: any) => a + (c.stars - 3), 0);
        const empDiffDays = getEmpDiffDays(emp.created_at, monthStartObj, monthEndObj, monthDiffDays);
        return { id: emp.id, name: emp.full_name, branch: emp.branches?.name, total: empDiffDays * 3 + delta };
      }) || [];

      const top_all_time = empScoresAllTime.sort((a, b) => b.total - a.total).slice(0, 3);
      const top_year = empScoresYear.sort((a, b) => b.total - a.total).slice(0, 3);
      const top_month = empScoresMonth.sort((a, b) => b.total - a.total).slice(0, 3);

      res.json({
        total_branches: total_branches || 0,
        total_departments: total_departments || 0,
        total_employees,
        branch_breakdown: Object.entries(branchBreakdown).map(([name, count]) => ({ name, count })),
        department_breakdown: Object.entries(deptBreakdown).map(([name, count]) => ({ name, count })),
        top_all_time,
        top_year,
        top_month
      });
    } catch (err) {
      res.status(500).json({ error: "Lỗi lấy dữ liệu tổng quan" });
    }
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

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (Supabase Connected)`);
  });
}

startServer();
