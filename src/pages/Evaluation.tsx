import React, { useState, useEffect } from 'react';
import { Star, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Evaluation, StarReason, User } from '../types';
import { format, subDays, addDays } from 'date-fns';
import { cn } from '../lib/utils';

export default function EvaluationPage({ user }: { user: User }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [reasons, setReasons] = useState<StarReason[]>([]);
  const [loading, setLoading] = useState(false);

  const dates = [
    subDays(selectedDate, 2),
    subDays(selectedDate, 1),
    selectedDate
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [evalData, reasonData] = await Promise.all([
        apiFetch(`/api/evaluations?date=${format(selectedDate, 'yyyy-MM-dd')}${user.role === 'MANAGER' ? `&department_id=${user.department_id}` : ''}`),
        apiFetch('/api/reasons')
      ]);
      setEvaluations(evalData);
      setReasons(reasonData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleStarClick = async (employeeId: number, stars: number) => {
    const currentEval = evaluations.find(ev => ev.employee_id === employeeId);
    try {
      await apiFetch('/api/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          stars,
          reason_ids: currentEval?.reason_ids || []
        })
      });
      fetchData();
    } catch (err) {
      alert('Lỗi khi đánh giá');
    }
  };

  const handleReasonToggle = async (employeeId: number, reasonId: number, stars: number) => {
    const currentEval = evaluations.find(ev => ev.employee_id === employeeId);
    const currentReasons = currentEval?.reason_ids || [];
    const newReasons = currentReasons.includes(reasonId)
      ? currentReasons.filter(id => id !== reasonId)
      : [...currentReasons, reasonId];

    try {
      await apiFetch('/api/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          stars,
          reason_ids: newReasons
        })
      });
      fetchData();
    } catch (err) {
      alert('Lỗi khi cập nhật lý do');
    }
  };

  const isDateAllowed = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - d.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 2;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Đánh giá Nhân viên</h2>
          <p className="text-slate-500">Chấm sao hàng ngày cho nhân viên phòng ban</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
              <button 
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-2 px-4 font-medium text-slate-700">
                <CalendarIcon size={18} className="text-indigo-500" />
                <span>{format(selectedDate, 'dd/MM/yyyy')}</span>
              </div>
              <button 
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            {!isDateAllowed(selectedDate) && (
              <p className="text-xs text-red-500 font-medium text-center">Chỉ được đánh giá hôm nay và 2 ngày trước</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-20 text-slate-400">Đang tải dữ liệu...</div>
        ) : evaluations.length === 0 ? (
          <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300">
            Không có nhân viên nào để đánh giá
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {evaluations.map((ev: any) => (
                <div key={ev.employee_id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-lg">
                        {ev.full_name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{ev.full_name}</h4>
                        <p className="text-sm text-slate-500 font-mono">{ev.employee_code}</p>
                      </div>
                    </div>

                      <div className="flex flex-col gap-4 flex-1 max-w-md">
                        <div className="flex items-center justify-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              disabled={!isDateAllowed(selectedDate)}
                              onClick={() => handleStarClick(ev.employee_id, star)}
                              className={cn(
                                "p-2 rounded-xl transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed",
                                (ev.stars || 3) >= star ? "text-amber-400" : "text-slate-200"
                              )}
                            >
                              <Star size={32} fill={(ev.stars || 3) >= star ? "currentColor" : "none"} />
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lý do đánh giá</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {reasons.filter(r => r.stars === (ev.stars || 3)).map(r => (
                              <label 
                                key={r.id} 
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-sm",
                                  ev.reason_ids?.includes(r.id) 
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                    : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  disabled={!isDateAllowed(selectedDate)}
                                  checked={ev.reason_ids?.includes(r.id)}
                                  onChange={() => handleReasonToggle(ev.employee_id, r.id, ev.stars || 3)}
                                  className="hidden"
                                />
                                <div className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                  ev.reason_ids?.includes(r.id) ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300"
                                )}>
                                  {ev.reason_ids?.includes(r.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                                <span className="flex-1 leading-tight">{r.reason_text}</span>
                              </label>
                            ))}
                          </div>
                          {reasons.filter(r => r.stars === (ev.stars || 3)).length === 0 && (
                            <p className="text-xs text-slate-400 italic">Chưa có lý do mẫu cho mức {ev.stars || 3} sao</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Trạng thái</span>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">
                          Đã đánh giá
                        </span>
                        <span className="text-[10px] text-slate-400 italic">
                          {ev.stars ? 'Đã điều chỉnh' : 'Mặc định (3 sao)'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
        )}
      </div>
    </div>
  );
}
