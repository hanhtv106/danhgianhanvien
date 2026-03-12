import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, User as UserIcon, Shield, MapPin, Search, Filter, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../services/api';
import { User, Department, Branch } from '../types';

export default function UsersPage({ user }: { user: any }) {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(user.role !== 'SUPER_ADMIN' ? (user.branch_id?.toString() || 'all') : 'all');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role_id: '',
    role: 'USER',
    department_id: '',
    branch_id: ''
  });

  const fetchData = async () => {
    try {
      const [userData, deptData, branchData, rolesData] = await Promise.all([
        apiFetch('/api/users'),
        apiFetch('/api/departments'),
        apiFetch('/api/branches'),
        apiFetch('/api/roles')
      ]);
      setUsers(userData);
      setDepartments(deptData);
      setBranches(branchData);
      setRoles(rolesData || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: '',
        full_name: user.full_name,
        role: user.role,
        role_id: (user as any).role_id?.toString() || '',
        department_id: user.department_id?.toString() || '',
        branch_id: user.branch_id?.toString() || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        role: 'USER',
        role_id: roles.find(r => r.name === 'USER')?.id?.toString() || '',
        department_id: '',
        branch_id: ''
      });
    }
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const usernameRegex = /^[a-z0-9@.]{5,24}$/;
    if (!usernameRegex.test(formData.username)) {
      alert('Tên tài khoản phải từ 5-24 ký tự, chỉ chứa chữ cái thường, số, @ và dấu chấm.');
      return;
    }

    if (!editingUser || formData.password) {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
      if (!passwordRegex.test(formData.password)) {
        alert('Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt (!@#$%^&*)');
        return;
      }
    }

    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
      try {
        await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
        fetchData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchText.toLowerCase()) || 
                         u.username.toLowerCase().includes(searchText.toLowerCase());
    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    const matchesBranch = selectedBranchFilter === 'all' || u.branch_id?.toString() === selectedBranchFilter;
    return matchesSearch && matchesRole && matchesBranch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Tài khoản</h2>
          <p className="text-slate-500">Quản trị viên và Trưởng phòng đăng nhập hệ thống</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Thêm tài khoản</span>
        </button>

      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc username..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>

        <div className="relative">
          <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="SUPER_ADMIN">Admin</option>
            <option value="ADMIN">Quản trị</option>
            <option value="USER">User</option>
          </select>
          <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
        </div>

        {user.role === 'SUPER_ADMIN' && (
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={selectedBranchFilter}
              onChange={(e) => setSelectedBranchFilter(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
          </div>
        )}

        <div className="flex items-center md:justify-end px-2">
          <p className="text-xs text-slate-400 font-medium">
            Hiển thị: <span className="text-indigo-600 font-bold">{filteredUsers.length}</span> tài khoản
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-700">Tài khoản</th>
                <th className="hidden sm:table-cell px-6 py-4 text-sm font-semibold text-slate-700">Họ tên</th>
                <th className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-700">Vai trò</th>
                <th className="hidden lg:table-cell px-6 py-4 text-sm font-semibold text-slate-700">Chi nhánh</th>
                <th className="hidden md:table-cell px-6 py-4 text-sm font-semibold text-slate-700">Phòng ban</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr 
                  key={user.id} 
                  className="hover:bg-indigo-50/30 transition-all cursor-pointer group"
                  onClick={() => handleOpenModal(user)}
                >
                  <td className="px-4 md:px-6 py-4 text-sm font-mono group-hover:text-indigo-600 transition-colors">
                    <div className="font-bold">{user.username}</div>
                    <div className="sm:hidden text-xs text-slate-500 font-sans mt-0.5">{user.full_name}</div>
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 text-sm font-medium text-slate-900">{user.full_name}</td>
                  <td className="px-4 md:px-6 py-4 text-sm">
                    <span className={`px-2 md:px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold ${user.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-600' :
                      user.role === 'ADMIN' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}>
                      {user.role === 'SUPER_ADMIN' ? 'Admin' : user.role === 'ADMIN' ? 'Quản trị' : 'User'}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 text-sm text-slate-600">{(user as any).branch_name || '-'}</td>
                  <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600">{(user as any).department_name || '-'}</td>
                </tr>

              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingUser ? 'Sửa tài khoản' : 'Thêm tài khoản mới'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="5-24 ký tự, cho phép @ và ."
                />
                <p className="mt-1 text-[10px] text-slate-400">Từ 5-24 ký tự chữ thường, không chứa ký tự đặc biệt ngoài @ và .</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mật khẩu {editingUser ? '(Để trống nếu không đổi)' : <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingUser}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none pr-12"
                    placeholder="Mật khẩu mạnh..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và (!@#$%^&*)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò <span className="text-red-500">*</span></label>
                <select
                  value={formData.role_id}
                  onChange={e => {
                    const selectedRole = roles.find(r => r.id.toString() === e.target.value);
                    setFormData({
                      ...formData,
                      role_id: e.target.value,
                      role: selectedRole?.name || 'USER',
                      department_id: selectedRole?.name === 'SUPER_ADMIN' ? '' : formData.department_id,
                      branch_id: selectedRole?.name === 'SUPER_ADMIN' ? '' : formData.branch_id
                    });
                  }}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  required
                >
                  <option value="">-- Chọn vai trò --</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name === 'SUPER_ADMIN' ? 'Admin' : r.name === 'ADMIN' ? 'Quản trị' : 'User'}</option>)}
                </select>
              </div>
              {String(formData.role_id) !== '1' && formData.role_id !== '' && (
                <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin size={16} className="text-indigo-600" />
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Phạm vi Quản lý</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh <span className="text-red-500">*</span></label>
                      <select
                        value={formData.branch_id}
                        required
                        onChange={e => {
                          const newBranchId = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            branch_id: newBranchId,
                            department_id: prev.department_id && departments.find(d => d.id.toString() === prev.department_id)?.branch_id?.toString() === newBranchId
                              ? prev.department_id
                              : ''
                          }));
                        }}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm"
                      >
                        <option value="">-- Chọn chi nhánh --</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phòng ban quản lý (Nếu có)</label>
                      <select
                        value={formData.department_id}
                        onChange={e => {
                          const dept = departments.find(d => d.id.toString() === e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            department_id: e.target.value,
                            branch_id: (dept as any)?.branch_id?.toString() || prev.branch_id
                          }));
                        }}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none shadow-sm"
                      >
                        <option value="">-- Không chọn (Quản lý toàn bộ chi nhánh) --</option>
                        {departments
                          .filter(d => !formData.branch_id || (d as any).branch_id?.toString() === formData.branch_id)
                          .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                        }
                      </select>
                      <p className="mt-1 text-[10px] text-slate-400">Nếu bỏ trống, tài khoản sẽ quản lý tất cả phòng thuộc chi nhánh đã chọn.</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center mt-8">
                <div>
                  {editingUser && (
                    <button 
                      type="button" 
                      onClick={() => {
                        handleDelete(editingUser.id);
                        setIsModalOpen(false);
                      }} 
                      className="btn-danger"
                    >
                      <Trash2 size={18} />
                      <span>Xóa</span>
                    </button>

                  )}
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="btn-secondary"
                  >
                    Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                  >
                    Lưu
                  </button>

                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
