import React, { useState, useEffect, useRef } from 'react';
import { Download, Calendar as CalendarIcon, Search, Building2, Briefcase, User as UserIcon, Star, ChevronDown, ArrowLeft, Filter, Trophy, Medal, MapPin } from 'lucide-react';
import { apiFetch } from '../services/api';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { Department, Employee, Branch } from '../types';
import { cn } from '../lib/utils';

type ReportView = 'EMPLOYEE' | 'DEPARTMENT';

export default function Reports({ user }: { user: any }) {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [view, setView] = useState<ReportView>('EMPLOYEE');

  // Data states
  const [employeeData, setEmployeeData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  // Filter states
  const [selectedBranch, setSelectedBranch] = useState<string>(user.role !== 'SUPER_ADMIN' ? (user.branch_id?.toString() || 'all') : 'all');
  const [selectedDept, setSelectedDept] = useState<string>(user.role === 'USER' ? (user.department_id?.toString() || 'all') : 'all');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Drill-down states
  const [detailView, setDetailView] = useState<{ type: 'EMPLOYEE' | 'DEPARTMENT', id: number } | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Searchable dropdown state for Employee Filter
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const empDropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empSummary, deptSummary, depts, emps, branchData] = await Promise.all([
        apiFetch(`/api/summary?startDate=${startDate}&endDate=${endDate}`),
        apiFetch(`/api/summary/departments?startDate=${startDate}&endDate=${endDate}`),
        apiFetch('/api/departments'),
        apiFetch('/api/employees'),
        apiFetch('/api/branches')
      ]);
      setEmployeeData(empSummary);
      setDepartmentData(deptSummary);
      setDepartments(depts);
      setAllEmployees(emps);
      setBranches(branchData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailData = async (type: 'EMPLOYEE' | 'DEPARTMENT', id: number) => {
    setDetailLoading(true);
    try {
      const endpoint = type === 'EMPLOYEE'
        ? `/api/reports/employee/${id}?startDate=${startDate}&endDate=${endDate}`
        : `/api/reports/department/${id}?startDate=${startDate}&endDate=${endDate}`;
      const result = await apiFetch(endpoint);
      setDetailData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target as Node)) {
        setIsEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [startDate, endDate]);

  useEffect(() => {
    if (detailView) {
      fetchDetailData(detailView.type, detailView.id);
    }
  }, [detailView, startDate, endDate]);

  // Filtering and Sorting logic
  const filteredEmployeeData = employeeData
    .filter(row => {
      const matchBranch = selectedBranch === 'all' || row.branch_name === branches.find(b => b.id.toString() === selectedBranch)?.name;
      const matchDept = selectedDept === 'all' || row.department_name === departments.find(d => d.id.toString() === selectedDept)?.name;
      const matchEmp = selectedEmployeeId === 'all' || row.id.toString() === selectedEmployeeId;
      return matchBranch && matchDept && matchEmp;
    })
    .sort((a, b) => (b.total_stars || 0) - (a.total_stars || 0));

  const filteredDepartmentData = departmentData
    .filter(row => {
      return selectedDept === 'all' || row.id.toString() === selectedDept;
    })
    .sort((a, b) => (b.total_stars || 0) - (a.total_stars || 0));

  const filteredEmployeesForFilter = allEmployees.filter(emp => {
    const matchSearch = emp.full_name.toLowerCase().includes(empSearchQuery.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(empSearchQuery.toLowerCase());
    const matchBranch = selectedBranch === 'all' || emp.branch_id?.toString() === selectedBranch;
    const matchDept = selectedDept === 'all' || emp.department_id?.toString() === selectedDept;
    return matchSearch && matchBranch && matchDept;
  });

  const selectedEmployeeForFilter = allEmployees.find(emp => emp.id.toString() === selectedEmployeeId);

  const exportToExcel = () => {
    let ws;
    let filename;
    if (view === 'EMPLOYEE') {
      ws = XLSX.utils.json_to_sheet(filteredEmployeeData.map(row => ({
        'Mã NV': row.employee_code,
        'Họ tên': row.full_name,
        'Chi nhánh': row.branch_name,
        'Phòng ban': row.department_name,
        'Tổng sao': row.total_stars || 0,
        'Số ngày': row.days_evaluated
      })));
      filename = `Bao_cao_nhan_vien_${startDate}_den_${endDate}.xlsx`;
    } else {
      ws = XLSX.utils.json_to_sheet(filteredDepartmentData.map(row => ({
        'Phòng ban': row.department_name,
        'Tổng nhân viên': row.total_employees,
        'Tổng sao': row.total_stars || 0,
        'Trung bình': row.total_employees > 0 ? (row.total_stars / row.total_employees).toFixed(2) : 0
      })));
      filename = `Bao_cao_phong_ban_${startDate}_den_${endDate}.xlsx`;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo");
    XLSX.writeFile(wb, filename);
  };

  if (detailView && detailData) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <button
          onClick={() => { setDetailView(null); setDetailData(null); }}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          <span>Quay lại danh sách</span>
        </button>

        {detailView.type === 'EMPLOYEE' ? (
          <div className="space-y-6">
            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-lg shadow-indigo-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <UserIcon size={40} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{detailData.employee.full_name}</h3>
                    <p className="text-indigo-100 font-mono">{detailData.employee.employee_code}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center md:text-left">
                  <div>
                    <p className="text-indigo-200 text-xs uppercase tracking-wider font-semibold mb-1">Chi nhánh</p>
                    <p className="font-medium">{detailData.employee.branch_name}</p>
                  </div>
                  <div>
                    <p className="text-indigo-200 text-xs uppercase tracking-wider font-semibold mb-1">Phòng ban</p>
                    <p className="font-medium">{detailData.employee.department_name}</p>
                  </div>
                  <div>
                    <p className="text-indigo-200 text-xs uppercase tracking-wider font-semibold mb-1">Tổng sao (kỳ)</p>
                    <p className="text-2xl font-bold">{detailData.evaluations.reduce((acc: number, ev: any) => acc + ev.stars, 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-900">Lịch sử đánh giá chi tiết</h4>
                <span className="text-sm text-slate-500">{detailData.evaluations.length} lượt đánh giá</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Ngày</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Số sao</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Lý do / Ghi chú</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Người đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailData.evaluations.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400">Không có dữ liệu đánh giá</td></tr>
                    ) : (
                      detailData.evaluations.map((ev: any) => (
                        <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-600">{ev.date}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} size={14} className={i < ev.stars ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                              ))}
                              <span className="ml-2 text-sm font-bold text-slate-700">{ev.stars}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{ev.reason_text || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{ev.evaluator_name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-lg shadow-emerald-100">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Building2 size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Phòng ban: {detailData.department.name}</h3>
                  <p className="text-emerald-100">Danh sách nhân viên và tổng hợp sao</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Mã NV</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700">Họ tên</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">Tổng sao</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">Số ngày</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailData.employees.map((emp: any) => (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => { setDetailView({ type: 'EMPLOYEE', id: emp.id }); setDetailData(null); }}
                      >
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono">{emp.employee_code}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{emp.full_name}</td>
                        <td className="px-6 py-4 text-sm text-center font-bold text-amber-600">{emp.total_stars}</td>
                        <td className="px-6 py-4 text-sm text-center text-slate-600">{emp.days_evaluated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Báo cáo Tổng hợp</h2>
          <p className="text-slate-500">Phân tích và thống kê đánh giá nhân viên</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-2xl flex">
            <button
              onClick={() => setView('EMPLOYEE')}
              className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all", view === 'EMPLOYEE' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Nhân viên
            </button>
            <button
              onClick={() => setView('DEPARTMENT')}
              className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all", view === 'DEPARTMENT' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Phòng ban
            </button>
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold">
          <Filter size={18} className="text-indigo-600" />
          <span>Bộ lọc báo cáo</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chi nhánh</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedBranch}
                disabled={user.role !== 'SUPER_ADMIN'}
                onChange={e => {
                  const newBranchId = e.target.value;
                  setSelectedBranch(newBranchId);
                  // Reset department and employee when branch changes
                  setSelectedDept('all');
                  setSelectedEmployeeId('all');
                }}
                className={cn(
                  "w-full pl-10 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20",
                  user.role !== 'SUPER_ADMIN' ? "bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500" : "bg-slate-50 border-slate-200"
                )}
              >
                <option value="all">Tất cả chi nhánh</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phòng ban</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedDept}
                disabled={user.role === 'USER' && !!user.department_id}
                onChange={e => {
                  setSelectedDept(e.target.value);
                  setSelectedEmployeeId('all'); // Reset employee when department changes
                }}
                className={cn(
                  "w-full pl-10 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20",
                  (user.role === 'USER' && !!user.department_id) ? "bg-slate-100 border-slate-200 cursor-not-allowed text-slate-500" : "bg-slate-50 border-slate-200"
                )}
              >
                <option value="all">Tất cả phòng ban</option>
                {departments
                  .filter(d => selectedBranch === 'all' || d.branch_id?.toString() === selectedBranch)
                  .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                }
              </select>
            </div>
          </div>

          <div className="space-y-2 relative" ref={empDropdownRef}>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nhân viên</label>
            <div
              onClick={() => setIsEmpDropdownOpen(!isEmpDropdownOpen)}
              className="relative cursor-pointer"
            >
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <div className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 flex items-center justify-between">
                <span className="truncate">
                  {selectedEmployeeId === 'all' ? 'Tất cả nhân viên' : selectedEmployeeForFilter?.full_name}
                </span>
                <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isEmpDropdownOpen && "rotate-180")} />
              </div>
            </div>
            {isEmpDropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <input
                    type="text"
                    placeholder="Tìm kiếm..."
                    value={empSearchQuery}
                    onChange={e => setEmpSearchQuery(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <div
                    onClick={() => { setSelectedEmployeeId('all'); setIsEmpDropdownOpen(false); }}
                    className="px-4 py-2 text-xs hover:bg-slate-50 cursor-pointer"
                  >Tất cả nhân viên</div>
                  {filteredEmployeesForFilter.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => { setSelectedEmployeeId(emp.id.toString()); setIsEmpDropdownOpen(false); }}
                      className="px-4 py-2 text-xs hover:bg-slate-50 cursor-pointer flex flex-col"
                    >
                      <span className="font-medium">{emp.full_name}</span>
                      <span className="text-[10px] text-slate-400">{emp.employee_code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Từ ngày</label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đến ngày</label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {view === 'EMPLOYEE' ? (
                  <>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 w-16">Hạng</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Mã NV</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Họ tên</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Chi nhánh</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Phòng ban</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">Tổng sao</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">Số ngày</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 w-16">Hạng</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">Phòng ban</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">Tổng nhân viên</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">Tổng sao</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-center">Trung bình sao/NV</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-20 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
              ) : (view === 'EMPLOYEE' ? filteredEmployeeData : filteredDepartmentData).length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-20 text-center text-slate-400">Không có dữ liệu</td></tr>
              ) : (
                (view === 'EMPLOYEE' ? filteredEmployeeData : filteredDepartmentData).map((row, index) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setDetailView({ type: view, id: row.id })}
                  >
                    {view === 'EMPLOYEE' ? (
                      <>
                        <td className="px-6 py-4 text-sm font-bold text-slate-500">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Trophy size={16} className="text-amber-500" />}
                            {index === 1 && <Medal size={16} className="text-slate-400" />}
                            {index === 2 && <Medal size={16} className="text-amber-700" />}
                            <span>{index + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-mono">{row.employee_code}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.full_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.branch_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.department_name}</td>
                        <td className="px-6 py-4 text-sm text-center font-bold text-amber-600">{row.total_stars || 0}</td>
                        <td className="px-6 py-4 text-sm text-center text-slate-600">{row.days_evaluated}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-sm font-bold text-slate-500">
                          <div className="flex items-center gap-2">
                            {index === 0 && <Trophy size={16} className="text-amber-500" />}
                            <span>{index + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                              <Building2 size={18} />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{row.department_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-center text-slate-600 font-medium">{row.total_employees}</td>
                        <td className="px-6 py-4 text-sm text-center font-bold text-amber-600">{row.total_stars || 0}</td>
                        <td className="px-6 py-4 text-sm text-center text-slate-600">
                          {row.total_employees > 0 ? (row.total_stars / row.total_employees).toFixed(2) : 0}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
