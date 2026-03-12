import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Edit2, Search, Building2, Filter } from 'lucide-react';
import { apiFetch } from '../services/api';
import { StarReason } from '../types';

export default function Reasons({ user }: { user: any }) {
  const [reasons, setReasons] = useState<StarReason[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<StarReason | null>(null);
  const [formData, setFormData] = useState({ stars: 3, reason_text: '', department_id: '' });
  
  const [searchText, setSearchText] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState(user.role === 'USER' ? (user.department_id?.toString() || 'all') : 'all');

  const fetchData = async () => {
    const [reasonsData, deptsData] = await Promise.all([
      apiFetch('/api/reasons'),
      apiFetch('/api/departments')
    ]);
    setReasons(reasonsData);
    setDepartments(deptsData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (reason?: StarReason) => {
    if (reason) {
      setEditingReason(reason);
      setFormData({ 
        stars: reason.stars, 
        reason_text: reason.reason_text,
        department_id: reason.department_id ? reason.department_id.toString() : ''
      });
    } else {
      setEditingReason(null);
      let defaultDeptId = '';
      if (user.role !== 'SUPER_ADMIN') {
        if (user.department_id) {
          defaultDeptId = user.department_id.toString();
        } else if (departments.length > 0) {
          defaultDeptId = departments[0].id.toString();
        }
      }
      setFormData({ stars: 3, reason_text: '', department_id: defaultDeptId });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingReason ? `/api/reasons/${editingReason.id}` : '/api/reasons';
    const method = editingReason ? 'PUT' : 'POST';

    try {
      const payload: any = { 
        stars: formData.stars, 
        reason_text: formData.reason_text,
        department_id: formData.department_id ? parseInt(formData.department_id) : null
      };

      await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      setIsModalOpen(false);
      setEditingReason(null);
      setFormData({ stars: 3, reason_text: '', department_id: '' });
      await fetchData(); // Refresh to get proper audit names
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Xóa lý do này?')) {
      await apiFetch(`/api/reasons/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const canManage = (reason: StarReason | null) => {
    if (!reason) return true; // For new reasons
    return user.role === 'SUPER_ADMIN' || reason.created_by === user.id;
  };

  const filteredReasons = reasons.filter(r => {
    const matchesSearch = r.reason_text.toLowerCase().includes(searchText.toLowerCase());
    const matchesDept = selectedDeptFilter === 'all' || 
                       r.department_id === null || 
                       r.department_id?.toString() === selectedDeptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Lý do Sao</h2>
          <p className="text-slate-500">Thiết lập các lý do tương ứng với số sao đánh giá</p>
        </div>
        {(user.role === 'SUPER_ADMIN' || user.permissions?.includes('reasons:edit')) && (
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary"
          >
            <Plus size={18} />
            <span>Thêm lý do</span>
          </button>
        )}

      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo nội dung lý do..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>

        <div className="relative">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            disabled={user.role === 'USER'}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none disabled:opacity-60"
          >
            <option value="all">Tất cả bộ phận</option>
            {user.role === 'SUPER_ADMIN' && <option value="null">Áp dụng chung</option>}
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
        </div>

        <div className="flex items-center md:justify-end px-2">
          <p className="text-xs text-slate-400 font-medium">
            Hiển thị: <span className="text-indigo-600 font-bold">{filteredReasons.length}</span> lý do
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5].map(starCount => {
          const starReasons = filteredReasons.filter(r => r.stars === starCount);
          // Sort reasons: first global reasons, then by department name
          const sortedReasons = [...starReasons].sort((a, b) => {
            if (!a.department_id && b.department_id) return -1;
            if (a.department_id && !b.department_id) return 1;
            const nameA = a.department_name || '';
            const nameB = b.department_name || '';
            return nameA.localeCompare(nameB);
          });

          return (
            <div key={starCount} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: starCount }).map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                  <span className="ml-2 text-slate-900 font-bold">{starCount} Sao</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {sortedReasons.map(reason => (
                  <div 
                    key={reason.id} 
                    onClick={() => handleOpenModal(reason)}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-white border border-transparent hover:border-indigo-100 transition-all cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <div className="flex flex-col flex-1 pr-2">
                      <span className="text-sm text-slate-700 font-bold">{reason.reason_text}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-indigo-500 uppercase font-black tracking-widest bg-indigo-50 w-fit px-2 py-0.5 rounded-md">
                          {reason.department_name ? reason.department_name : 'Áp dụng chung'}
                        </span>
                        {!canManage(reason) && (
                          <span className="text-[10px] text-slate-400 italic">Chỉ đọc</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {sortedReasons.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-4">Chưa có lý do nào</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingReason ? 'Sửa lý do đánh giá' : 'Thêm lý do đánh giá'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số sao <span className="text-red-500">*</span></label>
                <select
                  value={formData.stars}
                  onChange={e => setFormData({ ...formData, stars: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                >
                  <option value={1}>1 Sao</option>
                  <option value={2}>2 Sao</option>
                  <option value={3}>3 Sao (Mặc định)</option>
                  <option value={4}>4 Sao</option>
                  <option value={5}>5 Sao</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung lý do <span className="text-red-500">*</span></label>
                <textarea
                  required
                  value={formData.reason_text}
                  onChange={e => setFormData({ ...formData, reason_text: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px]"
                  placeholder="VD: Đi làm muộn, Hoàn thành xuất sắc công việc..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bộ phận áp dụng</label>
                <select
                  value={formData.department_id}
                  onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                  disabled={user.role !== 'SUPER_ADMIN' && !!user.department_id}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {(user.role === 'SUPER_ADMIN') && <option value="">-- Áp dụng chung cho tất cả --</option>}
                  {departments
                    .filter(d => user.role === 'SUPER_ADMIN' || !user.department_id || d.id === user.department_id)
                    .map(d => (
                    <option key={d.id} value={d.id.toString()}>{d.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {user.role !== 'SUPER_ADMIN' && user.department_id 
                    ? 'Bạn chỉ có thể chọn bộ phận mà bạn quản lý.' 
                    : 'Chọn bộ phận để áp dụng riêng biệt lý do này.'}
                </p>
              </div>

              {editingReason && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nhật ký hệ thống</p>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Người thêm: <span className="text-indigo-600 font-bold">{editingReason.created_by_name || 'Hệ thống'}</span>
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center mt-8">
                <div>
                  {editingReason && (
                    <button 
                      type="button" 
                      onClick={() => {
                        handleDelete(editingReason.id);
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
                    Đóng
                  </button>
                  {canManage(editingReason!) && (
                    <button 
                      type="submit" 
                      className="btn-primary"
                    >
                      Lưu
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
