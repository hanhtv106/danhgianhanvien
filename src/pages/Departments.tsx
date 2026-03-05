import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Department } from '../types';

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);

  const fetchData = async () => {
    const [depts, branchData] = await Promise.all([
      apiFetch('/api/departments'),
      apiFetch('/api/branches')
    ]);
    setDepartments(depts);
    setBranches(branchData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setName(dept.name);
      setBranchId(dept.branch_id?.toString() || '');
    } else {
      setEditingDept(null);
      setName('');
      setBranchId('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments';
    const method = editingDept ? 'PUT' : 'POST';

    try {
      await apiFetch(url, {
        method,
        body: JSON.stringify({ name, branch_id: branchId ? parseInt(branchId) : null }),
      });
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Xóa phòng ban này có thể ảnh hưởng đến dữ liệu nhân viên. Bạn chắc chắn?')) {
      await apiFetch(`/api/departments/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Phòng ban</h2>
          <p className="text-slate-500">Danh sách các phòng ban trong công ty</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>Thêm phòng ban</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-sm font-semibold text-slate-700">ID</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-700">Tên phòng ban</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-700">Chi nhánh</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {departments.map((dept) => (
              <tr key={dept.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-500">{dept.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{dept.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                    {dept.branch_name || 'Chưa gán'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleOpenModal(dept)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(dept.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-6">{editingDept ? 'Sửa phòng ban' : 'Thêm phòng ban mới'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên phòng ban</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="VD: Phòng Hành chính"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh</label>
                <select
                  required
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
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
