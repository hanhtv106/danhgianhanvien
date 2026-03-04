import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Star, Edit2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { StarReason } from '../types';

export default function Reasons() {
  const [reasons, setReasons] = useState<StarReason[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<StarReason | null>(null);
  const [formData, setFormData] = useState({ stars: 3, reason_text: '' });

  const fetchData = async () => {
    const data = await apiFetch('/api/reasons');
    setReasons(data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (reason?: StarReason) => {
    if (reason) {
      setEditingReason(reason);
      setFormData({ stars: reason.stars, reason_text: reason.reason_text });
    } else {
      setEditingReason(null);
      setFormData({ stars: 3, reason_text: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingReason ? `/api/reasons/${editingReason.id}` : '/api/reasons';
    const method = editingReason ? 'PUT' : 'POST';
    
    try {
      await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      setEditingReason(null);
      setFormData({ stars: 3, reason_text: '' });
      fetchData();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Lý do Sao</h2>
          <p className="text-slate-500">Thiết lập các lý do tương ứng với số sao đánh giá</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>Thêm lý do</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5].map(starCount => (
          <div key={starCount} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: starCount }).map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                <span className="ml-2 text-slate-900 font-bold">{starCount} Sao</span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {reasons.filter(r => r.stars === starCount).map(reason => (
                <div key={reason.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                  <span className="text-sm text-slate-700">{reason.reason_text}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => handleOpenModal(reason)} className="p-1 text-slate-400 hover:text-indigo-600">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(reason.id)} className="p-1 text-slate-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {reasons.filter(r => r.stars === starCount).length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-4">Chưa có lý do nào</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingReason ? 'Sửa lý do đánh giá' : 'Thêm lý do đánh giá'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Số sao</label>
                <select
                  value={formData.stars}
                  onChange={e => setFormData({...formData, stars: parseInt(e.target.value)})}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung lý do</label>
                <textarea
                  required
                  value={formData.reason_text}
                  onChange={e => setFormData({...formData, reason_text: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px]"
                  placeholder="VD: Đi làm muộn, Hoàn thành xuất sắc công việc..."
                />
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
