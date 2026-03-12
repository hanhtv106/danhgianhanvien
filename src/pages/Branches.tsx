import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, MapPin, Search } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Branch } from '../types';

export default function Branches({ user }: { user: any }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [name, setName] = useState('');
  const [searchText, setSearchText] = useState('');

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

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Chi nhánh</h2>
          <p className="text-slate-500">Danh sách các chi nhánh của công ty</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Thêm chi nhánh</span>
        </button>

      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên chi nhánh..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>

        <div className="flex items-center md:justify-end px-2">
          <p className="text-xs text-slate-400 font-medium">
            Hiển thị: <span className="text-indigo-600 font-bold">{filteredBranches.length}</span> chi nhánh
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm max-w-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-sm font-semibold text-slate-700">ID</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-700">Tên chi nhánh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredBranches.map((branch) => (
              <tr 
                key={branch.id} 
                className="hover:bg-indigo-50/30 transition-all cursor-pointer group"
                onClick={() => handleOpenModal(branch)}
              >
                <td className="px-6 py-4 text-sm text-slate-500">{branch.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-slate-400" />
                    {branch.name}
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
              <div className="flex justify-between items-center mt-8">
                <div>
                  {editingBranch && (
                    <button 
                      type="button" 
                      onClick={() => {
                        handleDelete(editingBranch.id);
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
