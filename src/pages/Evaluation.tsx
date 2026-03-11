import React, { useState, useEffect } from 'react';
import { Star, Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Plus, Check, Save, Search, Filter, RotateCcw, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../services/api';
import { Branch, Department, Evaluation, StarReason, User } from '../types';
import { format, subDays, addDays } from 'date-fns';
import { cn } from '../lib/utils';

export default function EvaluationPage({ user }: { user: User }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [originalEvaluations, setOriginalEvaluations] = useState<Evaluation[]>([]);
  const [reasons, setReasons] = useState<StarReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeEmpIdForReasons, setActiveEmpIdForReasons] = useState<number | null>(null);
  const [tempEvaluation, setTempEvaluation] = useState<Evaluation | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter states
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedBranch, setSelectedBranch] = useState(user.role !== 'SUPER_ADMIN' ? (user.branch_id?.toString() || 'all') : 'all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchText, setSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        date: format(selectedDate, 'yyyy-MM-dd'),
        branch_id: selectedBranch,
        department_id: selectedDept,
        search: searchText
      });

      const [evalData, reasonData] = await Promise.all([
        apiFetch(`/api/evaluations?${queryParams.toString()}`),
        apiFetch('/api/reasons')
      ]);
      const processedEvals = await Promise.all(evalData.map(async (ev: Evaluation) => {
        if (ev.stars === null && isDateAllowed(selectedDate)) {
          const firstThreeStarReason = reasonData.find((r: StarReason) => r.stars === 3);
          const autoValue = {
            ...ev,
            stars: 3,
            reason_ids: firstThreeStarReason ? [firstThreeStarReason.id] : [],
            note: ""
          };

          // Gọi API tự động lưu ngay lập tức
          try {
            await apiFetch('/api/evaluations', {
              method: 'POST',
              body: JSON.stringify({
                employee_id: autoValue.employee_id,
                date: format(selectedDate, 'yyyy-MM-dd'),
                stars: autoValue.stars,
                reason_ids: autoValue.reason_ids,
                note: autoValue.note
              })
            });
            return autoValue;
          } catch (err) {
            console.error("Tự động lưu thất bại:", err);
            return autoValue; // Vẫn trả về giá trị mặc định ở client
          }
        }
        return ev;
      }));

      setEvaluations(processedEvals);
      setOriginalEvaluations(JSON.parse(JSON.stringify(processedEvals)));
      setReasons(reasonData);
      setDirtyIds(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [bData, dData] = await Promise.all([
          apiFetch('/api/branches'),
          apiFetch('/api/departments')
        ]);
        setBranches(bData);
        setDepartments(dData);
      } catch (err) {
        console.error('Lỗi tải bộ lọc:', err);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedBranch, selectedDept, searchText]);

  const handleStarClick = (employeeId: number, stars: number) => {
    if (!isDateAllowed(selectedDate)) return;

    const currentEv = evaluations.find(e => e.employee_id === employeeId);
    if (!currentEv) return;

    const shouldClear = currentEv.stars !== stars;
    let newReasonIds = shouldClear ? [] : (currentEv.reason_ids || []);
    let newNote = shouldClear ? "" : (currentEv.note || "");

    if (stars === 3 && shouldClear) {
      const firstThreeStarReason = reasons.find(r => r.stars === 3);
      if (firstThreeStarReason) {
        newReasonIds = [firstThreeStarReason.id];
      }
    }

    setTempEvaluation({ ...currentEv, stars, reason_ids: newReasonIds, note: newNote });
    setActiveEmpIdForReasons(employeeId);
  };

  const handleReasonToggle = (reasonId: number) => {
    if (!tempEvaluation) return;

    const currentReasons = tempEvaluation.reason_ids || [];
    const newReasons = currentReasons.includes(reasonId)
      ? currentReasons.filter(id => id !== reasonId)
      : [...currentReasons, reasonId];

    setTempEvaluation({ ...tempEvaluation, reason_ids: newReasons });
  };

  const handleNoteChange = (note: string) => {
    if (!tempEvaluation) return;
    setTempEvaluation({ ...tempEvaluation, note });
  };

  const handleTempStarClick = (stars: number) => {
    if (!tempEvaluation) return;

    const shouldClear = tempEvaluation.stars !== stars;
    let newReasonIds = shouldClear ? [] : (tempEvaluation.reason_ids || []);
    let newNote = tempEvaluation.note || ""; // Keep note when changing stars

    if (stars === 3 && shouldClear) {
      const firstThreeStarReason = reasons.find(r => r.stars === 3);
      if (firstThreeStarReason) {
        newReasonIds = [firstThreeStarReason.id];
      }
    }
    setTempEvaluation({ ...tempEvaluation, stars, reason_ids: newReasonIds, note: newNote });
  };

  const handleSave = async () => {
    if (!tempEvaluation) return;
    const employeeId = tempEvaluation.employee_id;

    setSavingIds(prev => new Set(prev).add(employeeId));
    try {
      await apiFetch('/api/evaluations', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employeeId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          stars: tempEvaluation.stars || 3,
          reason_ids: tempEvaluation.reason_ids || [],
          note: tempEvaluation.note || ""
        })
      });

      setEvaluations(prev => prev.map(ev =>
        ev.employee_id === employeeId ? { ...tempEvaluation } : ev
      ));
      setOriginalEvaluations(prev => prev.map(original =>
        original.employee_id === employeeId ? { ...tempEvaluation } : original
      ));
      setDirtyIds(prev => {
        const next = new Set(prev);
        next.delete(employeeId);
        return next;
      });
      showToast('Đã lưu đánh giá thành công!');
      setActiveEmpIdForReasons(null);
      setTempEvaluation(null);
    } catch (err) {
      showToast('Lỗi khi lưu đánh giá. Vui lòng thử lại.', 'error');
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(employeeId);
        return next;
      });
    }
  };

  const handleCancel = (employeeId: number) => {
    const original = originalEvaluations.find(e => e.employee_id === employeeId);
    if (!original) return;

    setEvaluations(prev => prev.map(ev =>
      ev.employee_id === employeeId ? { ...original } : ev
    ));
    setDirtyIds(prev => {
      const next = new Set(prev);
      next.delete(employeeId);
      return next;
    });
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

  const activeEvaluation = evaluations.find(e => e.employee_id === activeEmpIdForReasons);

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white rounded-3xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select
            value={selectedBranch}
            onChange={(e) => {
              setSelectedBranch(e.target.value);
              setSelectedDept('all');
            }}
            disabled={user.role !== 'SUPER_ADMIN'}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none disabled:opacity-60"
          >
            <option value="all">Tất cả chi nhánh</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none"
          >
            <option value="all">Tất cả phòng ban</option>
            {departments
              .filter(d => selectedBranch === 'all' || d.branch_id?.toString() === selectedBranch)
              .map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))
            }
          </select>
        </div>

        <div className="flex items-center justify-center">
          <p className="text-xs text-slate-400 font-medium">
            Hiển thị: <span className="text-indigo-600 font-bold">{evaluations.length}</span> nhân viên
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={format(selectedDate, 'yyyy-MM-dd')}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              const swipeThreshold = 50;
              if (info.offset.x < -swipeThreshold) {
                setSelectedDate(prev => addDays(prev, 1));
              } else if (info.offset.x > swipeThreshold) {
                setSelectedDate(prev => subDays(prev, 1));
              }
            }}
            className="space-y-4 cursor-grab active:cursor-grabbing"
          >
            {loading ? (
              <div className="text-center py-20 text-slate-400">Đang tải dữ liệu...</div>
            ) : evaluations.length === 0 ? (
              <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300">
                Không có nhân viên nào để đánh giá
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {evaluations.map((ev) => (
                  <div key={ev.employee_id} className="bg-white rounded-2xl border border-slate-200 p-3 md:p-6 shadow-sm hover:shadow-md transition-all">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
                      <div className="flex items-center gap-3 md:w-64 shrink-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 text-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center font-bold text-base md:text-lg shrink-0">
                          {ev.full_name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm md:text-base truncate">{ev.full_name}</h4>
                          <p className="text-xs text-slate-500 font-mono truncate">{ev.employee_code}</p>
                        </div>
                      </div>

                      <div className="flex flex-1 items-center justify-center min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5 md:gap-2 bg-slate-50/50 p-1 rounded-2xl md:bg-transparent md:p-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              disabled={!isDateAllowed(selectedDate)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStarClick(ev.employee_id, star);
                              }}
                              className={cn(
                                "p-1 md:p-1.5 rounded-lg transition-all transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed",
                                (ev.stars || 0) >= star ? "text-amber-400" : "text-slate-200"
                              )}
                            >
                              <Star size={32} className="md:w-11 md:h-11" fill={(ev.stars || 0) >= star ? "currentColor" : "none"} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="hidden md:block md:w-64"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {activeEmpIdForReasons && tempEvaluation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 truncate max-w-[280px]">
                  Đánh giá {tempEvaluation.full_name}
                </h3>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleTempStarClick(star)}
                      className={cn(
                        "transition-all transform hover:scale-110",
                        (tempEvaluation.stars || 0) >= star ? "text-amber-400" : "text-slate-200"
                      )}
                    >
                      <Star size={20} fill={(tempEvaluation.stars || 0) >= star ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveEmpIdForReasons(null);
                  setTempEvaluation(null);
                }}
                className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
              {/* Lý do đã chọn */}
              <section className="space-y-3">
                <label className="text-sm font-bold text-indigo-700 flex items-center gap-2">
                  <Check size={18} className="text-indigo-600" />
                  Lý do đã chọn ({(tempEvaluation.reason_ids || []).length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {reasons
                    .filter(r => r.stars === (tempEvaluation.stars || 3) && tempEvaluation.reason_ids?.includes(r.id))
                    .filter(r => !r.department_id || r.department_id === tempEvaluation.department_id)
                    .map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleReasonToggle(r.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                      >
                        {r.reason_text}
                        <X size={14} />
                      </button>
                    ))
                  }
                  {(!tempEvaluation.reason_ids || tempEvaluation.reason_ids.length === 0) && (
                    <p className="text-xs text-slate-400 italic py-1">Chưa chọn lý do nào</p>
                  )}
                </div>
              </section>

              {/* Phân cách giữa lý do đã chọn và lý do mẫu */}
              <div className="relative py-2 flex items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-slate-300 tracking-[0.2em]">Gợi ý từ hệ thống</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              {/* Danh sách lý do mẫu */}
              <section className="space-y-3">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Plus size={18} className="text-slate-400" />
                  Danh sách lý do mẫu <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {reasons
                    .filter(r => r.stars === (tempEvaluation.stars || 3) && !tempEvaluation.reason_ids?.includes(r.id))
                    .filter(r => !r.department_id || r.department_id === tempEvaluation.department_id)
                    .map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleReasonToggle(r.id)}
                        className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white text-left transition-all hover:border-indigo-300 hover:bg-slate-50 relative overflow-hidden group"
                      >
                        <div className="w-6 h-6 rounded-lg border border-slate-300 bg-white flex items-center justify-center transition-all shrink-0">
                          {/* Empty box for available selection */}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                           <span className="font-medium text-slate-700 truncate">
                             {r.reason_text}
                           </span>
                           {r.department_name && (
                             <span className="text-[10px] text-indigo-500 font-medium px-2 py-0.5 bg-indigo-50 rounded-full w-fit mt-1 border border-indigo-100">
                               Dành riêng cho {r.department_name}
                             </span>
                           )}
                        </div>
                      </button>
                    ))
                  }
                  {reasons.filter(r => 
                    r.stars === (tempEvaluation.stars || 3) && 
                    !tempEvaluation.reason_ids?.includes(r.id) &&
                    (!r.department_id || r.department_id === tempEvaluation.department_id)
                  ).length === 0 && (
                    <div className="text-center py-4 border border-dashed border-slate-200 rounded-2xl">
                      <p className="text-slate-400 text-xs italic">Đã chọn tất cả lý do hoặc không có lý do phù hợp</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2 font-['Inter']">
                  <MessageSquare size={18} className="text-indigo-600" />
                  Ý kiến bổ sung (Tùy chọn)
                </label>
                <textarea
                  placeholder="Nhập thêm nhận xét của bạn tại đây..."
                  value={tempEvaluation.note || ""}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm min-h-[100px] resize-none"
                />
              </section>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
              {(tempEvaluation.stars !== null && (!tempEvaluation.reason_ids || tempEvaluation.reason_ids.length === 0)) && (
                <p className="text-xs text-red-500 font-medium italic text-right">Vui lòng chọn ít nhất một lý do mẫu</p>
              )}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setActiveEmpIdForReasons(null);
                    setTempEvaluation(null);
                  }}
                  className="flex-1 py-4 rounded-2xl font-bold bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                >
                  Huỷ bỏ
                </button>
                <button
                  onClick={handleSave}
                  disabled={savingIds.has(tempEvaluation.employee_id) || (tempEvaluation.stars !== null && (!tempEvaluation.reason_ids || tempEvaluation.reason_ids.length === 0))}
                  className={cn(
                    "flex-[2] py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-white shadow-lg active:scale-95",
                    (tempEvaluation.stars === null || (tempEvaluation.reason_ids && tempEvaluation.reason_ids.length > 0))
                      ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                      : "bg-slate-300 cursor-not-allowed shadow-none"
                  )}
                >
                  {savingIds.has(tempEvaluation.employee_id) ? (
                    <RotateCcw className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Save size={20} />
                      <span>Xác nhận Lưu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-5 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <Check size={20} /> : <X size={20} />}
          <span className="font-bold text-sm tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
