import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, MapPin } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Branch } from '../types';

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [name, setName] = useState('');

  const fetchData = async () => {
    try {
      const data = await apiFetch('/api/branches');
      setBranches(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setName(branch.name);
    } else {
      setEditingBranch(null);
      setName('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingBranch ? `/api/branches/${editingBranch.id}` : '/api/branches';
    const method = editingBranch ? 'PUT' : 'POST';

    try {
      await apiFetch(url, {
        method,
        body: JSON.stringify({ name }),
      });
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Xóa chi nhánh này có thể ảnh hưởng đến dữ liệu nhân viên. Bạn chắc chắn?')) {
      try {
        await apiFetch(`/api/branches/${id}`, { method: 'DELETE' });
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
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Chi nhánh</h2>
          <p className="text-slate-500">Danh sách các chi nhánh của công ty</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>Thêm chi nhánh</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-sm font-semibold text-slate-700">ID</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-700">Tên chi nhánh</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branches.map((branch) => (
              <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-500">{branch.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    {branch.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleOpenModal(branch)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(branch.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingBranch ? 'Sửa chi nhánh' : 'Thêm chi nhánh mới'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên chi nhánh <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  placeholder="VD: Chi nhánh Hà Nội"
                />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors font-medium">Hủy</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-lg shadow-indigo-200">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
