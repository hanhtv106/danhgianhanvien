import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Filter, MapPin } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Department } from '../types';

export default function Departments({ user }: { user: any }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterBranchId, setFilterBranchId] = useState(user.role !== 'SUPER_ADMIN' ? (user.branch_id?.toString() || 'all') : 'all');

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

  const filteredDepartments = departments.filter(dept => {
    const matchesSearch = dept.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesBranch = filterBranchId === 'all' || dept.branch_id?.toString() === filterBranchId;
    return matchesSearch && matchesBranch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Phòng ban</h2>
          <p className="text-slate-500">Danh sách các phòng ban trong công ty</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Thêm phòng ban</span>
        </button>

      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên phòng ban..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>

        {user.role === 'SUPER_ADMIN' && (
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
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
            Hiển thị: <span className="text-indigo-600 font-bold">{filteredDepartments.length}</span> phòng ban
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="hidden sm:table-cell px-6 py-4 text-sm font-semibold text-slate-700">ID</th>
              <th className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-700">Phòng ban</th>
              <th className="hidden sm:table-cell px-6 py-4 text-sm font-semibold text-slate-700">Chi nhánh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDepartments.map((dept) => (
              <tr 
                key={dept.id} 
                className="hover:bg-indigo-50/30 transition-all cursor-pointer group"
                onClick={() => handleOpenModal(dept)}
              >
                <td className="hidden sm:table-cell px-6 py-4 text-sm text-slate-500">{dept.id}</td>
                <td className="px-4 md:px-6 py-4">
                   <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{dept.name}</div>
                   <div className="sm:hidden text-[10px] text-slate-400 font-medium mt-1">
                      <MapPin size={10} className="inline mr-1" />{dept.branch_name || 'Chưa gán'}
                   </div>
                </td>
                <td className="hidden sm:table-cell px-6 py-4 text-sm text-slate-600 border-none">
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                    {dept.branch_name || 'Chưa gán'}
                  </span>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên phòng ban <span className="text-red-500">*</span></label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh <span className="text-red-500">*</span></label>
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
              <div className="flex justify-between items-center mt-8">
                <div>
                  {editingDept && (
                    <button 
                      type="button" 
                      onClick={() => {
                        handleDelete(editingDept.id);
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
