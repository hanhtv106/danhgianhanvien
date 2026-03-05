import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, User as UserIcon, Shield, MapPin } from 'lucide-react';
import { apiFetch } from '../services/api';
import { User, Department, Branch } from '../types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
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
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Tài khoản</h2>
          <p className="text-slate-500">Quản trị viên và Trưởng phòng đăng nhập hệ thống</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>Thêm tài khoản</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Tên đăng nhập</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Họ tên</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Vai trò</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Chi nhánh</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Phòng ban</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{user.username}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{user.full_name}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${user.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-600' :
                      user.role === 'ADMIN' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                      }`}>
                      {user.role === 'SUPER_ADMIN' ? 'Admin' : user.role === 'ADMIN' ? 'Quản trị' : 'User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{(user as any).branch_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{(user as any).department_name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(user)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mật khẩu {editingUser && '(Để trống nếu không đổi)'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò</label>
                <select
                  value={formData.role_id}
                  onChange={e => {
                    const selectedRole = roles.find(r => r.id.toString() === e.target.value);
                    setFormData({
                      ...formData,
                      role_id: e.target.value,
                      role: selectedRole?.name || 'USER',
                      department_id: (selectedRole?.name === 'SUPER_ADMIN' || selectedRole?.name === 'ADMIN') ? '' : formData.department_id,
                      branch_id: (selectedRole?.name === 'SUPER_ADMIN' || selectedRole?.name === 'ADMIN') ? '' : formData.branch_id
                    });
                  }}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  required
                >
                  <option value="">-- Chọn vai trò --</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name === 'SUPER_ADMIN' ? 'Admin' : r.name === 'ADMIN' ? 'Quản trị' : 'User'}</option>)}
                </select>
              </div>
              {formData.role === 'USER' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh</label>
                    <select
                      value={formData.branch_id}
                      onChange={e => {
                        const newBranchId = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          branch_id: newBranchId,
                          // Reset department if it doesn't belong to the new branch
                          department_id: prev.department_id && departments.find(d => d.id.toString() === prev.department_id)?.branch_id?.toString() === newBranchId
                            ? prev.department_id
                            : ''
                        }));
                      }}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      required
                    >
                      <option value="">-- Chọn chi nhánh --</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phòng ban quản lý</label>
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
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      required
                    >
                      <option value="">-- Chọn phòng ban --</option>
                      {departments
                        .filter(d => !formData.branch_id || (d as any).branch_id?.toString() === formData.branch_id)
                        .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                      }
                    </select>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Hủy</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
