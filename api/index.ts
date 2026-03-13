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

    // Update last active time for this user (session heartbeat)
    await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', decoded.id);

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

    // 🚨 BLOCK: Single-Device Concurrent Login Check (First-Login-Wins)
    if (userData.last_active_at) {
      const lastActive = new Date(userData.last_active_at).getTime();
      const now = new Date().getTime();
      const diffSeconds = (now - lastActive) / 1000;

      // If user was active in last 60 seconds, block new login
      if (diffSeconds < 60) {
        return res.status(403).json({ error: "Tài khoản đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ hoặc chờ 1 phút." });
      }
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
    await supabase.from('users').update({ 
      current_token: token,
      last_active_at: new Date().toISOString()
    }).eq('id', userData.id);

    res.json({ token, user });
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ error: "Lỗi đăng nhập" });
  }
});

app.post("/api/logout", authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    // Clear token and active status immediately on manual logout
    await supabase.from('users').update({ 
      current_token: null, 
      last_active_at: null 
    }).eq('id', userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đăng xuất" });
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

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ error: "Mật khẩu mới không đủ mạnh (tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt)" });
    }

    const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
    await supabase.from('users').update({ password: hashedNewPassword }).eq('id', userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi đổi mật khẩu" });
  }
});

app.get("/api/users", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    let query = supabase
      .from('users')
      .select('id, username, full_name, role, role_id, department_id, branch_id, departments(name), branches(name)');

    if (user.role === 'ADMIN') {
      if (user.branch_id) {
        query = query.eq('branch_id', user.branch_id);
      } else {
        query = query.eq('id', user.id); // If admin has no branch context, they only see themselves? (Should not happen)
      }
    } else if (user.role === 'USER') {
      if (user.department_id) {
        query = query.eq('department_id', user.department_id);
      } else {
        query = query.eq('id', user.id);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    const rows = (data || []).map((u: any) => ({
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
  const currentUser = (req as any).user;

  // Validation
  const lowerUsername = (username || '').toLowerCase();
  const usernameRegex = /^[a-z0-9@.]{5,24}$/;
  if (!usernameRegex.test(lowerUsername)) {
    return res.status(400).json({ error: "Tên tài khoản phải từ 5-24 ký tự, chỉ chứa chữ cái thường, số, @ và dấu chấm." });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ error: "Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt (!@#$%^&*)" });
  }

  // RBAC check for creating users
  if (currentUser.role === 'ADMIN') {
    if (branch_id && parseInt(branch_id) !== currentUser.branch_id) {
      return res.status(403).json({ error: "Bạn chỉ có thể tạo người dùng trong chi nhánh của mình" });
    }
  } else if (currentUser.role === 'USER') {
    return res.status(403).json({ error: "Bạn không có quyền tạo người dùng" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    const { data, error } = await supabase.from('users').insert({
      username: lowerUsername, password: hashedPassword, full_name, role, role_id,
      department_id: department_id || null,
      branch_id: branch_id || (currentUser.role === 'ADMIN' ? currentUser.branch_id : null)
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

  // Validation
  const lowerUsername = (username || '').toLowerCase();
  const usernameRegex = /^[a-z0-9@.]{5,24}$/;
  if (!usernameRegex.test(lowerUsername)) {
    return res.status(400).json({ error: "Tên tài khoản phải từ 5-24 ký tự, chỉ chứa chữ cái thường, số, @ và dấu chấm." });
  }

  if (password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: "Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt (!@#$%^&*)" });
    }
  }

  try {
    const updates: any = { username: lowerUsername, full_name, role, role_id, department_id: department_id || null, branch_id: branch_id || null };
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

  if (user.role !== 'SUPER_ADMIN') {
    if (user.role === 'ADMIN' && user.branch_id) {
      query = query.eq('branch_id', user.branch_id);
    } else if (user.role === 'USER' && user.department_id) {
      query = query.eq('id', user.department_id);
    } else if (!user.branch_id && !user.department_id) {
      // Fallback or specific restriction
      return res.json([]);
    }
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
  const user = (req as any).user;

  if (user.role === 'ADMIN') {
    if (branch_id && parseInt(branch_id) !== user.branch_id) {
      return res.status(403).json({ error: "Không có quyền tạo bộ phận cho chi nhánh khác" });
    }
  } else if (user.role === 'USER') {
    return res.status(403).json({ error: "Bạn không có quyền quản lý bộ phận" });
  }

  const { data, error } = await supabase.from('departments').insert({ 
      name, 
      branch_id: user.role === 'ADMIN' ? user.branch_id : (branch_id || null) 
  }).select('*').single();

  if (error) return res.status(400).json({ error: "Bộ phận đã tồn tại hoặc dữ liệu không hợp lệ" });
  res.json(data);
});
app.put("/api/departments/:id", authenticate, async (req, res) => {
  const { name, branch_id } = req.body;
  const user = (req as any).user;
  const { id } = req.params;

  const { data: existing } = await supabase.from('departments').select('branch_id').eq('id', id).single();
  if (!existing) return res.status(404).json({ error: "Bộ phận không tồn tại" });

  if (user.role === 'ADMIN') {
    if (existing.branch_id !== user.branch_id) return res.status(403).json({ error: "Không có quyền sửa bộ phận này" });
    if (branch_id && parseInt(branch_id) !== user.branch_id) return res.status(403).json({ error: "Không thể chuyển bộ phận sang chi nhánh khác" });
  } else if (user.role === 'USER') {
    return res.status(403).json({ error: "Bạn không có quyền sửa bộ phận" });
  }

  await supabase.from('departments').update({ name, branch_id: branch_id || null }).eq('id', id);
  res.json({ success: true });
});
app.delete("/api/departments/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const { data: existing } = await supabase.from('departments').select('branch_id').eq('id', id).single();
  if (!existing) return res.status(404).json({ error: "Bộ phận không tồn tại" });

  if (user.role !== 'SUPER_ADMIN') {
    if (user.role === 'ADMIN' && existing.branch_id !== user.branch_id) return res.status(403).json({ error: "Không có quyền xóa bộ phận này" });
    if (user.role === 'USER') return res.status(403).json({ error: "Bạn không có quyền xóa bộ phận" });
  }

  await supabase.from('departments').delete().eq('id', id);
  res.json({ success: true });
});

app.get("/api/reasons", authenticate, async (req, res) => {
  const user = (req as any).user;
  let query = supabase.from('star_reasons')
    .select('id, stars, reason_text, created_by, department_id, departments(name, branch_id), created_by_user:users!star_reasons_created_by_fkey(full_name)');

  if (user.role?.toUpperCase() === 'ADMIN' && user.branch_id) {
    const { data: bDepts } = await supabase.from('departments').select('id').eq('branch_id', user.branch_id);
    const dIds = bDepts?.map((d: any) => d.id) || [];
    if (dIds.length > 0) {
      query = query.or(`department_id.is.null,department_id.in.(${dIds.join(',')})`);
    } else {
      query = query.is('department_id', null);
    }
  } else if (user.role?.toUpperCase() === 'USER' && user.department_id) {
    query = query.or(`department_id.is.null,department_id.eq.${user.department_id}`);
  }

  const { data } = await query;
  const rows = (data || []).map((r: any) => ({
    ...r,
    department_name: r.departments?.name,
    created_by_name: r.created_by_user?.full_name
  }));
  res.json(rows);
});
app.post("/api/reasons", authenticate, async (req, res) => {
  const { stars, reason_text, department_id } = req.body;
  const user = (req as any).user;
  
  let final_department_id = department_id || null;
  if (user.role === 'ADMIN') {
    // Branch admin must pick a department in their branch
     if (!final_department_id) {
         return res.status(400).json({ error: "Quản trị viên chi nhánh phải chọn một bộ phận cụ thể" });
     }
     const { data: dept } = await supabase.from('departments').select('branch_id').eq('id', final_department_id).single();
     if (!dept || dept.branch_id != user.branch_id) {
         return res.status(403).json({ error: "Bộ phận không thuộc chi nhánh của bạn" });
     }
  } else if (user.role === 'USER') {
     if (user.department_id) {
         final_department_id = user.department_id;
     } else {
         return res.status(403).json({ error: "Người dùng phải thuộc về một bộ phận" });
     }
  }

  const { data: insertedData, error } = await supabase.from('star_reasons').insert({
    stars, reason_text, created_by: user.id, department_id: final_department_id
  }).select('*, departments(name)').single();
  
  if (error) {
    console.error("Error creating reason:", error);
    return res.status(400).json({ error: "Lỗi khi thêm lý do: " + error.message });
  }
  
  const { data: creator } = await supabase.from('users').select('full_name').eq('id', user.id).single();
  
  const newReason = {
    ...insertedData,
    department_name: (insertedData as any).departments?.name,
    created_by_name: creator?.full_name || user.full_name
  };
  res.json(newReason);
});
app.put("/api/reasons/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { stars, reason_text, department_id } = req.body;

  const { data: reason } = await supabase.from('star_reasons')
    .select('created_by, department_id, departments(branch_id)')
    .eq('id', parseInt(id))
    .single();
    
  if (!reason) return res.status(404).json({ error: "Lý do không tồn tại" });
  
  let canEdit = user.role === 'SUPER_ADMIN' || user.permissions?.includes('reasons:edit') || reason.created_by === user.id;

  if (user.role === 'ADMIN') {
    if ((reason as any).departments?.branch_id != user.branch_id) canEdit = false;
  } else if (user.role === 'USER') {
    if (reason.department_id != user.department_id) canEdit = false;
  }

  if (!canEdit) {
    return res.status(403).json({ error: "Bạn không có quyền sửa lý do này" });
  }

  let final_department_id = department_id || null;
  if (user.role === 'ADMIN') {
     if (!final_department_id) return res.status(400).json({ error: "Phải chọn bộ phận" });
     const { data: d } = await supabase.from('departments').select('branch_id').eq('id', final_department_id).single();
     if (!d || d.branch_id != user.branch_id) return res.status(403).json({ error: "Bộ phận không hợp lệ" });
  } else if (user.role === 'USER') {
     final_department_id = user.department_id;
  }

  const { error: updateError } = await supabase.from('star_reasons')
    .update({ stars, reason_text, department_id: final_department_id })
    .eq('id', parseInt(id));
    
  if (updateError) {
    console.error("Error updating reason:", updateError);
    return res.status(400).json({ error: "Lỗi khi cập nhật lý do: " + updateError.message });
  }
  res.json({ success: true });
});
app.delete("/api/reasons/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const { data: reason } = await supabase.from('star_reasons').select('created_by, department_id, departments(branch_id)').eq('id', parseInt(id)).single();
  if (!reason) return res.status(404).json({ error: "Lý do không tồn tại" });
  
  let canDelete = user.role === 'SUPER_ADMIN' || user.permissions?.includes('reasons:delete') || reason.created_by === user.id;

  if (user.role === 'ADMIN') {
    if ((reason as any).departments?.branch_id != user.branch_id) canDelete = false;
  } else if (user.role === 'USER') {
    // Users cannot delete global reasons (department_id is null) or reasons from other departments
    if (reason.department_id == null || reason.department_id != user.department_id) canDelete = false;
  }

  if (!canDelete) {
    return res.status(403).json({ error: "Bạn không có quyền xóa lý do này" });
  }

  const { error: deleteError } = await supabase.from('star_reasons').delete().eq('id', parseInt(id));
  if (deleteError) {
    console.error("Error deleting reason:", deleteError);
    return res.status(400).json({ error: "Lỗi khi xóa lý do: " + deleteError.message });
  }
  res.json({ success: true });
});

app.get("/api/employees", authenticate, async (req, res) => {
  const user = (req as any).user;
  try {
    let p_branch_id = null;
    let p_dept_id = null;
    if (user.role && user.role.toUpperCase() !== 'SUPER_ADMIN' && user.branch_id) {
      p_branch_id = parseInt(user.branch_id as any) || null;
    }
    if (user.role && user.role.toUpperCase() === 'USER' && user.department_id) {
      p_dept_id = parseInt(user.department_id as any) || null;
    }

    const { data: rows, error } = await supabase.rpc('get_employees_dashboard_stats', { 
      p_branch_id, 
      p_dept_id,
      p_is_resigned: null 
    });

    console.log(`[API /employees] Request by role=${user.role}, branch=${p_branch_id}, dept=${p_dept_id} -> returned ${rows?.length || 0} rows. Error: ${error?.message}`);

    if (error) {
      console.error("RPC Error:", error);
      return res.status(500).json({ error: "Lỗi hệ thống khi lấy danh sách nhân viên" });
    }

    res.json(rows || []);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách nhân viên" });
  }
});

app.post("/api/employees", authenticate, async (req, res) => {
  const { employee_code, full_name, email, department_id, branch_id, cccd, is_resigned, created_at } = req.body;
  const user = (req as any).user;

  // RBAC validation
  if (user.role === 'ADMIN') {
    if (branch_id && branch_id != user.branch_id) return res.status(403).json({ error: "Không thể tạo nhân viên cho chi nhánh khác" });
    const { data: dept } = await supabase.from('departments').select('branch_id').eq('id', department_id).single();
    if (!dept || dept.branch_id != user.branch_id) return res.status(403).json({ error: "Bộ phận không thuộc chi nhánh của bạn" });
  } else if (user.role === 'USER') {
    if (department_id && department_id != user.department_id) return res.status(403).json({ error: "Bạn chỉ có quyền tạo nhân viên trong bộ phận của mình" });
  }

  const { data, error } = await supabase.from('employees').insert({
    employee_code, full_name, email, department_id, 
    branch_id: user.role === 'ADMIN' ? user.branch_id : (branch_id || (user.role === 'USER' ? user.branch_id : null)), 
    cccd,
    is_resigned: is_resigned ? true : false,
    created_by: user.id,
    created_at: created_at ? new Date(created_at).toISOString() : new Date().toISOString()
  }).select('id').single();
  if (error) return res.status(400).json({ error: "Lỗi khi thêm nhân viên: " + error.message });
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
      email: emp.email || '',
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
  const { employee_code, full_name, email, department_id, branch_id, cccd, is_resigned, created_at } = req.body;
  const user = (req as any).user;
  const { id } = req.params;

  const { data: existing } = await supabase.from('employees').select('branch_id, department_id').eq('id', id).single();
  if (!existing) return res.status(404).json({ error: "Nhân viên không tồn tại" });

  // RBAC Check
  if (user.role === 'ADMIN') {
    if (existing.branch_id != user.branch_id) return res.status(403).json({ error: "Không có quyền sửa nhân viên của chi nhánh khác" });
    if (branch_id && branch_id != user.branch_id) return res.status(403).json({ error: "Không thể chuyển nhân viên sang chi nhánh khác" });
    if (department_id) {
      const { data: dept } = await supabase.from('departments').select('branch_id').eq('id', department_id).single();
      if (!dept || dept.branch_id != user.branch_id) return res.status(403).json({ error: "Bộ phận đích không thuộc chi nhánh của bạn" });
    }
  } else if (user.role === 'USER') {
    if (existing.department_id != user.department_id) return res.status(403).json({ error: "Không có quyền sửa nhân viên bộ phận này" });
    if (department_id && parseInt(department_id) !== user.department_id) return res.status(403).json({ error: "Không thể chuyển nhân viên sang bộ phận khác" });
  }

  const updateData: any = {
    employee_code, full_name, email, department_id, branch_id, cccd,
    is_resigned: is_resigned ? true : false,
    updated_by: user.id,
    updated_at: new Date().toISOString()
  };
  if (created_at) {
    updateData.created_at = new Date(created_at).toISOString();
  }
  try {
    const { error } = await supabase.from('employees').update(updateData).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi /api/employees/:id PUT:", err);
    res.status(400).json({ error: "Lỗi khi cập nhật nhân viên" });
  }
});

app.delete("/api/employees/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;

  const { data: existing } = await supabase.from('employees').select('branch_id, department_id').eq('id', id).single();
  if (!existing) return res.status(404).json({ error: "Nhân viên không tồn tại" });

  if (user.role === 'ADMIN' && existing.branch_id != user.branch_id) return res.status(403).json({ error: "Không có quyền xóa nhân viên chi nhánh khác" });
  if (user.role === 'USER' && existing.department_id != user.department_id) return res.status(403).json({ error: "Không có quyền xóa nhân viên bộ phận khác" });

  await supabase.from('employees').delete().eq('id', id);
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
        note: ev?.note || "",
        department_id: emp.department_id
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

app.get("/api/summary", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  const user = (req as any).user;
  try {
    if (!startDate || !endDate) return res.status(400).json({ error: "Thiếu ngày bắt đầu hoặc kết thúc" });
    
    let p_branch_id = null;
    let p_dept_id = null;
    if (user.role && user.role.toUpperCase() !== 'SUPER_ADMIN' && user.branch_id) {
      p_branch_id = parseInt(user.branch_id as any) || null;
    }
    if (user.role && user.role.toUpperCase() === 'USER' && user.department_id) {
      p_dept_id = parseInt(user.department_id as any) || null;
    }

    const { data: rows, error } = await supabase.rpc('get_employee_stars_summary', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_branch_id,
      p_dept_id,
      p_employee_id: null,
      p_is_resigned: false
    });

    if (error) {
      console.error("Summary RPC Error:", error);
      throw error;
    }
    res.json(rows || []);

  } catch (err) { res.status(500).json({ error: "Lỗi báo cáo tổng hợp" }); }
});

app.get("/api/summary/departments", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  const user = (req as any).user;
  try {
    if (!startDate || !endDate) return res.status(400).json({ error: "Thiếu ngày bắt đầu hoặc kết thúc" });

    let p_branch_id = null;
    let p_dept_id = null;
    if (user.role && user.role.toUpperCase() !== 'SUPER_ADMIN' && user.branch_id) {
      p_branch_id = parseInt(user.branch_id as any) || null;
    }
    if (user.role && user.role.toUpperCase() === 'USER' && user.department_id) {
      p_dept_id = parseInt(user.department_id as any) || null;
    }

    const { data: employees, error } = await supabase.rpc('get_employee_stars_summary', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_branch_id,
      p_dept_id,
      p_employee_id: null,
      p_is_resigned: false
    });

    if (error) throw error;

    const deptMap: Record<number, { id: number, department_name: string, total_employees: number, total_stars: number }> = {};
    
    (employees || []).forEach((emp: any) => {
      if (!emp.department_id) return;
      if (!deptMap[emp.department_id]) {
        deptMap[emp.department_id] = { id: emp.department_id, department_name: emp.department_name, total_employees: 0, total_stars: 0 };
      }
      deptMap[emp.department_id].total_employees += 1;
      deptMap[emp.department_id].total_stars += emp.total_stars;
    });

    let dQuery = supabase.from('departments').select('id, name');
    if (p_branch_id) dQuery = dQuery.eq('branch_id', p_branch_id);
    if (p_dept_id) dQuery = dQuery.eq('id', p_dept_id);
    
    const { data: allDepts } = await dQuery;
    
    const rows = (allDepts || []).map(d => {
      if (deptMap[d.id]) return deptMap[d.id];
      return { id: d.id, department_name: d.name, total_employees: 0, total_stars: 0 };
    });

    res.json(rows);
  } catch (err) { res.status(500).json({ error: "Lỗi báo cáo bộ phận" }); }
});

app.get("/api/reports/department/:id", authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  const department_id = req.params.id;
  const user = (req as any).user;
  try {
    const { data: dept } = await supabase.from('departments').select('*').eq('id', department_id).single();
    if (!dept) return res.status(404).json({ error: "Phòng ban không tồn tại" });

    if (user.role !== 'SUPER_ADMIN') {
      if (user.branch_id && dept.branch_id != user.branch_id) return res.status(403).json({ error: "Không có quyền xem bộ phận này" });
      if (user.role === 'USER' && user.department_id && dept.id != user.department_id) return res.status(403).json({ error: "Không có quyền xem bộ phận này" });
    }

    console.log(`[API /reports/department] role=${user.role}, branch=${user.branch_id}, accessing dept=${department_id}`);

    const { data: employees, error } = await supabase.rpc('get_employee_stars_summary', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_branch_id: null,
      p_dept_id: parseInt(department_id),
      p_employee_id: null,
      p_is_resigned: false
    });

    if (error) throw error;

    res.json({ department: dept, employees: employees || [] });
  } catch (err) { res.status(500).json({ error: "Lỗi chi tiết phòng ban: " + (err as any).message }); }
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
        evaluator_name: ev.users?.full_name || 'Hệ thống',
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

    let p_branch_id = null;
    let p_dept_id = null;
    if (user.role && user.role.toUpperCase() !== 'SUPER_ADMIN' && user.branch_id) {
      p_branch_id = parseInt(user.branch_id as any) || null;
    }
    if (user.role && user.role.toUpperCase() === 'USER' && user.department_id) {
      p_dept_id = parseInt(user.department_id as any) || null;
    }

    const { data: employees, error: eErr } = await supabase.rpc('get_employees_dashboard_stats', { 
      p_branch_id, 
      p_dept_id,
      p_is_resigned: false 
    });

    console.log(`[API /dashboard] Request by role=${user.role}, branch=${p_branch_id}, dept=${p_dept_id} -> returned ${employees?.length || 0} rows. Error: ${eErr?.message}`);

    if (eErr) throw eErr;

    const total_employees = employees?.length || 0;

    let bQuery = supabase.from('branches').select('*', { count: 'exact', head: true });
    if (p_branch_id) bQuery = bQuery.eq('id', p_branch_id);
    const { count: total_branches } = await bQuery;

    let dQuery = supabase.from('departments').select('*', { count: 'exact', head: true });
    if (p_branch_id) dQuery = dQuery.eq('branch_id', p_branch_id);
    if (p_dept_id) dQuery = dQuery.eq('id', p_dept_id);
    const { count: total_departments } = await dQuery;

    const branchBreakdown: Record<string, number> = {};
    const deptBreakdown: Record<string, number> = {};

    employees?.forEach((e: any) => {
      if (e.branch_id) {
        const bName = e.branch_name || 'Chưa xếp nhánh';
        branchBreakdown[bName] = (branchBreakdown[bName] || 0) + 1;
      }
      if (e.department_id) {
        const dName = e.department_name || 'Chưa xếp phòng';
        deptBreakdown[dName] = (deptBreakdown[dName] || 0) + 1;
      }
    });

    const top_all_time = [...(employees || [])].sort((a, b) => b.stars_all_time - a.stars_all_time).slice(0, 3).map(e => ({ id: e.id, name: e.full_name, branch: e.branch_name, total: e.stars_all_time }));
    const top_year = [...(employees || [])].sort((a, b) => b.stars_year - a.stars_year).slice(0, 3).map(e => ({ id: e.id, name: e.full_name, branch: e.branch_name, total: e.stars_year }));
    const top_month = [...(employees || [])].sort((a, b) => b.stars_month - a.stars_month).slice(0, 3).map(e => ({ id: e.id, name: e.full_name, branch: e.branch_name, total: e.stars_month }));

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
    console.error(err);
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


export default app;
