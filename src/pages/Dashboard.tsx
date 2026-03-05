import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Building2, MapPin, Trophy, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function Dashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await apiFetch('/api/dashboard/overview');
                setData(res);
            } catch (err) {
                console.error('Lỗi tải dữ liệu tổng quan:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) {
        return <div className="text-center py-20 text-slate-400">Đang tải dữ liệu tổng quan...</div>;
    }

    if (!data) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                    <LayoutDashboard size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h2>
                    <p className="text-slate-500">Thông kê số liệu nhân sự và thành tích</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center relative z-10 shrink-0">
                        <Users size={32} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng nhân viên</p>
                        <p className="text-4xl font-black text-slate-900">{data.total_employees}</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center relative z-10 shrink-0">
                        <MapPin size={32} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng chi nhánh</p>
                        <p className="text-4xl font-black text-slate-900">{data.total_branches}</p>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-50 rounded-full group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center relative z-10 shrink-0">
                        <Building2 size={32} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng phòng ban</p>
                        <p className="text-4xl font-black text-slate-900">{data.total_departments}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Branch / Department breakdown */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                        <MapPin className="text-emerald-500" size={20} />
                        <h3 className="font-bold text-slate-800">Cơ cấu nhân sự</h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Theo chi nhánh</h4>
                            <div className="space-y-3">
                                {data.branch_breakdown.map((b: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                                        <span className="font-medium text-slate-700 text-sm truncate max-w-[150px]">{b.name}</span>
                                        <span className="font-black text-slate-900 bg-white px-3 py-1 rounded-xl shadow-sm text-sm">{b.count}</span>
                                    </div>
                                ))}
                                {data.branch_breakdown.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có dữ liệu</p>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Theo phòng ban</h4>
                            <div className="space-y-3">
                                {data.department_breakdown.map((d: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                                        <span className="font-medium text-slate-700 text-sm truncate max-w-[150px]">{d.name}</span>
                                        <span className="font-black text-slate-900 bg-white px-3 py-1 rounded-xl shadow-sm text-sm">{d.count}</span>
                                    </div>
                                ))}
                                {data.department_breakdown.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có dữ liệu</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Employees */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-6 border-b border-slate-100 bg-amber-50/50 flex items-center gap-3">
                        <Trophy className="text-amber-500" size={20} />
                        <h3 className="font-bold text-amber-900">Bảng vàng vinh danh</h3>
                    </div>
                    <div className="p-6 flex flex-col xl:flex-row gap-6">
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" /> Top tháng này
                            </h4>
                            <div className="space-y-3">
                                {data.top_month.map((emp: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-amber-200 hover:shadow-md transition-all">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 font-black text-slate-500 flex items-center justify-center text-sm">
                                            #{i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 text-sm truncate">{emp.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{emp.branch || 'N/A'}</p>
                                        </div>
                                        <div className="flex items-center gap-1 font-black text-amber-500 bg-amber-50 px-2 py-1 rounded-xl">
                                            <span>{emp.total}</span>
                                            <Star size={12} fill="currentColor" />
                                        </div>
                                    </div>
                                ))}
                                {data.top_month.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có dữ liệu tháng này</p>}
                            </div>
                        </div>

                        <div className="w-px bg-slate-100 hidden xl:block"></div>

                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-400" /> Top năm hiển hách
                            </h4>
                            <div className="space-y-3">
                                {data.top_year.map((emp: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-white border border-amber-100 rounded-2xl shadow-sm">
                                        <div className={`w-8 h-8 rounded-full font-black flex items-center justify-center text-sm shadow-sm ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : 'bg-amber-200/50 text-amber-800'}`}>
                                            #{i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 text-sm truncate">{emp.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{emp.branch || 'N/A'}</p>
                                        </div>
                                        <div className="flex items-center gap-1 font-black text-amber-600 bg-amber-100/50 px-2 py-1 rounded-xl border border-amber-200/50">
                                            <span>{emp.total}</span>
                                            <Star size={12} fill="currentColor" />
                                        </div>
                                    </div>
                                ))}
                                {data.top_year.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có dữ liệu năm nay</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Need to define a minimal CalendarIcon just in case to fix previous missing import inline
const CalendarIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
);
