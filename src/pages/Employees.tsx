import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Download, Upload, MapPin, Building2, User, CreditCard, Calendar, ShieldCheck, History, X, Check, Search, Filter } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Employee, Department, Branch } from '../types';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';

export default function Employees({ user }: { user: any }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(user.role !== 'SUPER_ADMIN' ? (user.branch_id?.toString() || 'all') : 'all');
  const [selectedDept, setSelectedDept] = useState(user.role === 'USER' ? (user.department_id?.toString() || 'all') : 'all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    department_id: '',
    branch_id: '',
    cccd: '',
    email: '',
    is_resigned: false,
    created_at: new Date().toISOString().split('T')[0]
  });
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    const [empData, deptData, branchData] = await Promise.all([
      apiFetch('/api/employees'),
      apiFetch('/api/departments'),
      apiFetch('/api/branches')
    ]);
    setEmployees(empData);
    setDepartments(deptData);
    setBranches(branchData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setFormData({
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_id: emp.department_id.toString(),
        branch_id: emp.branch_id.toString(),
        cccd: emp.cccd,
        email: emp.email || '',
        is_resigned: emp.is_resigned,
        created_at: emp.created_at ? new Date(emp.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        employee_code: '',
        full_name: '',
        department_id: departments[0]?.id.toString() || '',
        branch_id: branches[0]?.id.toString() || '',
        cccd: '',
        email: '',
        is_resigned: false,
        created_at: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
  };
  const handleViewDetail = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsDetailModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.department_id) {
      alert('Vui lòng chọn phòng ban');
      return;
    }
    if (!formData.branch_id) {
      alert('Vui lòng chọn chi nhánh');
      return;
    }

    const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees';
    const method = editingEmployee ? 'PUT' : 'POST';

    try {
      await apiFetch(url, {
        method,
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
      showToast(editingEmployee ? 'Cập nhật nhân viên thành công!' : 'Thêm nhân viên thành công!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      try {
        await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
        fetchData();
        showToast('Đã xóa nhân viên thành công!');
      } catch (err: any) {
        showToast('Lỗi khi xóa nhân viên', 'error');
      }
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      const validRows: any[] = [];
      const errorRows: any[] = [];

      data.forEach((row: any, index) => {
        const empCode = row['Mã nhân viên']?.toString();
        const fullName = row['Họ tên'];
        const deptName = row['Phòng ban'] || row['Bộ phận'];
        const branchName = row['Chi nhánh'];

        const dept = departments.find(d => d.name.trim().toLowerCase() === deptName?.toString().trim().toLowerCase());
        const branch = branches.find(b => b.name.trim().toLowerCase() === branchName?.toString().trim().toLowerCase());

        if (empCode && fullName && dept && branch) {
          validRows.push({
            employee_code: empCode,
            full_name: fullName,
            department_id: dept.id,
            branch_id: branch.id,
            cccd: row['Số CCCD']?.toString() || '',
            email: row['Email']?.toString() || '',
            is_resigned: row['Đã nghỉ việc'] === 'Có' || row['Đã nghỉ việc'] === true
          });
        } else {
          errorRows.push({ line: index + 2, reason: !dept ? 'Phòng ban không tồn tại' : !branch ? 'Chi nhánh không tồn tại' : 'Thiếu thông tin bắt buộc' });
        }
      });

      if (validRows.length > 0) {
        apiFetch('/api/employees/import', {
          method: 'POST',
          body: JSON.stringify({ data: validRows })
        }).then(() => {
          fetchData();
          alert(`Đã import thành công ${validRows.length} nhân viên.${errorRows.length > 0 ? `\n\nCó ${errorRows.length} dòng bị lỗi và bị bỏ qua.` : ''}`);
        });
      } else if (errorRows.length > 0) {
        alert('Không tìm thấy dữ liệu hợp lệ để import. Vui lòng kiểm tra lại tên Phòng ban và Chi nhánh.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    // Sheet 1: Template data
    const templateData = [
      {
        'Mã nhân viên': 'NV001',
        'Họ tên': 'Nguyễn Văn A',
        'Email': 'nguyenvana@gmail.com',
        'Số CCCD': '012345678901',
        'Phòng ban': departments[0]?.name || 'Phòng Hành chính',
        'Chi nhánh': branches[0]?.name || 'Chi nhánh 1',
        'Đã nghỉ việc': 'Không'
      }
    ];

    // Sheet 2: Reference data (Branches and Departments)
    const branchRef = branches.map(b => ({ 'Danh sách Chi nhánh': b.name }));
    const deptRef = departments.map(d => ({ 'Danh sách Phòng ban': d.name, 'Thuộc Chi nhánh': branches.find(b => b.id === d.branch_id)?.name }));

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws1, "Mau_Nhap_Lieu");

    const ws2 = XLSX.utils.json_to_sheet(branchRef);
    XLSX.utils.book_append_sheet(wb, ws2, "Chi_Nhanh_He_Thong");

    const ws3 = XLSX.utils.json_to_sheet(deptRef);
    XLSX.utils.book_append_sheet(wb, ws3, "Phong_Ban_He_Thong");

    XLSX.writeFile(wb, "Mau_Import_Nhan_Vien_v2.xlsx");
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.full_name.toLowerCase().includes(searchText.toLowerCase()) || 
                         emp.employee_code.toLowerCase().includes(searchText.toLowerCase());
    const matchesBranch = selectedBranch === 'all' || emp.branch_id?.toString() === selectedBranch;
    const matchesDept = selectedDept === 'all' || emp.department_id?.toString() === selectedDept;
    return matchesSearch && matchesBranch && matchesDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Nhân viên</h2>
          <p className="text-slate-500">Danh sách và thông tin nhân viên trong hệ thống</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 md:gap-3">
          <button
            onClick={downloadTemplate}
            className="btn-secondary !px-3 sm:!px-6 flex-1 sm:flex-none"
          >
            <Download size={18} className="text-indigo-500" />
            <span className="text-xs sm:text-sm">Tải mẫu</span>
          </button>
          <label className="btn-secondary cursor-pointer !px-3 sm:!px-6 flex-1 sm:flex-none">
            <Upload size={18} className="text-indigo-500" />
            <span className="text-xs sm:text-sm">Import</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
          </label>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary col-span-2 sm:col-auto !px-4 sm:!px-6"
          >
            <Plus size={18} />
            <span>Thêm nhân viên</span>
          </button>
        </div>

      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
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

        {(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && (
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
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
            <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
          </div>
        )}

        <div className="relative">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            disabled={user.role === 'USER'}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm appearance-none disabled:opacity-60"
          >
            <option value="all">Tất cả phòng ban</option>
            {departments
              .filter(d => selectedBranch === 'all' || d.branch_id?.toString() === selectedBranch)
              .map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))
            }
          </select>
          <Filter className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} />
        </div>

        <div className="flex items-center md:justify-end px-2">
          <p className="text-xs text-slate-400 font-medium">
            Hiển thị: <span className="text-indigo-600 font-bold">{filteredEmployees.length}</span> nhân viên
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-700">Mã NV</th>
                <th className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-700">Họ tên</th>
                <th className="hidden md:table-cell px-6 py-4 text-sm font-semibold text-slate-700">Chi nhánh</th>
                <th className="hidden md:table-cell px-6 py-4 text-sm font-semibold text-slate-700">Phòng ban</th>
                <th className="hidden lg:table-cell px-6 py-4 text-sm font-semibold text-slate-700">Email</th>
                <th className="px-4 md:px-6 py-4 text-sm font-semibold text-slate-700">Trạng thái</th>
              </tr>

            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-indigo-50/30 transition-all cursor-pointer group border-b border-slate-100 last:border-0" onClick={() => handleViewDetail(emp)}>
                  <td className="px-4 md:px-6 py-4">
                    <span className="text-[10px] md:text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg font-mono">{emp.employee_code}</span>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="font-bold text-slate-900 text-sm md:text-base leading-tight">{emp.full_name}</div>
                    <div className="md:hidden flex flex-col gap-0.5 mt-1">
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                        <MapPin size={10} className="text-slate-400" /> {emp.branch_name}
                      </div>
                      <div className="text-[10px] text-indigo-500 flex items-center gap-1 font-bold">
                        <Building2 size={10} className="text-indigo-400" /> {emp.department_name}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" />
                      {emp.branch_name}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Building2 size={14} className="text-slate-400" />
                      {emp.department_name}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 text-sm text-slate-500 italic">
                    {emp.email || '---'}
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm">
                    <span className={cn(
                      "px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[11px] font-bold uppercase tracking-wider block w-fit",
                      emp.is_resigned ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    )}>
                      {emp.is_resigned ? 'Nghỉ' : 'Đang làm'}
                    </span>
                  </td>
                </tr>

              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6">{editingEmployee ? 'Sửa nhân viên' : 'Thêm nhân viên mới'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mã nhân viên <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={e => setFormData({ ...formData, employee_code: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh <span className="text-red-500">*</span></label>
                  <select
                    value={formData.branch_id}
                    onChange={e => {
                      const newBranchId = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        branch_id: newBranchId,
                        // Reset department if it doesn't belong to the new branch
                        department_id: prev.department_id && departments.find(d => d.id.toString() === prev.department_id)?.branch_id?.toString() === newBranchId
                          ? prev.department_id
                          : ''
                      }));
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phòng ban <span className="text-red-500">*</span></label>
                  <select
                    value={formData.department_id}
                    onChange={e => {
                      const dept = departments.find(d => d.id.toString() === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        department_id: e.target.value,
                        branch_id: dept?.branch_id?.toString() || prev.branch_id
                      }));
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments
                      .filter(d => !formData.branch_id || d.branch_id?.toString() === formData.branch_id)
                      .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                    }
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    placeholder="example@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số CCCD <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.cccd}
                    onChange={e => setFormData({ ...formData, cccd: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày gia nhập <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.created_at}
                    onChange={e => setFormData({ ...formData, created_at: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>
              {editingEmployee && (
                <div className="flex items-center pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_resigned}
                      onChange={e => setFormData({ ...formData, is_resigned: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Đã nghỉ việc</span>
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-8">
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
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDetailModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            {/* Header with Background Gradient */}
            <div className="h-32 bg-gradient-to-r from-indigo-600 to-indigo-400 relative">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all backdrop-blur-sm z-10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Avatar Overlay */}
            <div className="px-8 -mt-12 relative z-10 flex items-end gap-6">
              <div className="w-24 h-24 bg-white p-1 rounded-3xl shadow-xl">
                <div className="w-full h-full bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-3xl">
                  {selectedEmployee.full_name?.split(' ').pop()?.charAt(0) || 'E'}
                </div>
              </div>
              <div className="mb-2">
                <h3 className="text-2xl font-black text-slate-900">{selectedEmployee.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{selectedEmployee.employee_code}</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border",
                    selectedEmployee.is_resigned ? "bg-red-50 text-red-500 border-red-100" : "bg-emerald-50 text-emerald-500 border-emerald-100"
                  )}>
                    {selectedEmployee.is_resigned ? 'Nghỉ việc' : 'Đang làm việc'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Core Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                      <User size={14} className="text-indigo-400" /> Thông tin cơ bản
                    </h4>
                    <div className="bg-slate-50/50 rounded-2xl p-4 space-y-3 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-2"><CreditCard size={14} /> CCCD:</span>
                        <span className="font-bold text-slate-700">{selectedEmployee.cccd}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-2"><span className="p-0.5 bg-indigo-50 text-indigo-500 rounded text-[10px] font-bold">@</span> Email:</span>
                        <span className="font-bold text-indigo-600 italic">{selectedEmployee.email || '---'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-2"><MapPin size={14} /> Chi nhánh:</span>
                        <span className="font-bold text-slate-700">{selectedEmployee.branch_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-2"><Building2 size={14} /> Phòng ban:</span>
                        <span className="font-bold text-slate-700">{selectedEmployee.department_name}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                      <ShieldCheck size={14} className="text-amber-500" /> Điểm đánh giá (Stars)
                    </h4>
                    <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-100 grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-[10px] text-amber-500 font-bold uppercase">Tháng</p>
                        <p className="text-xl font-black text-amber-600">{selectedEmployee.stars_month || 0}</p>
                      </div>
                      <div className="text-center border-x border-amber-100">
                        <p className="text-[10px] text-amber-500 font-bold uppercase">Năm 2026</p>
                        <p className="text-xl font-black text-amber-600">{selectedEmployee.stars_year || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-amber-500 font-bold uppercase">Tổng</p>
                        <p className="text-xl font-black text-amber-600">{selectedEmployee.stars_all_time || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: System Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                      <History size={14} className="text-slate-400" /> Nhật ký hệ thống
                    </h4>
                    <div className="bg-slate-50/50 rounded-2xl p-4 space-y-4 border border-slate-100">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 p-1.5 bg-indigo-50 text-indigo-500 rounded-lg"><Plus size={12} /></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Ngày gia nhập hệ thống</p>
                          <p className="text-sm font-semibold text-slate-700">
                            {selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '---'}
                          </p>
                          <p className="text-[11px] text-indigo-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Bởi: {selectedEmployee.created_by_name || 'Hệ thống'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                        <div className="mt-1 p-1.5 bg-amber-50 text-amber-500 rounded-lg"><Edit2 size={12} /></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Cập nhật lần cuối</p>
                          <p className="text-sm font-semibold text-slate-700">
                            {selectedEmployee.updated_at ? new Date(selectedEmployee.updated_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '---'}
                          </p>
                          <p className="text-[11px] text-amber-500/70 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Người sửa: {selectedEmployee.updated_by_name || '---'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    handleDelete(selectedEmployee.id);
                    setIsDetailModalOpen(false);
                  }}
                  className="btn-danger"
                >
                  <Trash2 size={18} />
                  <span>Xóa</span>
                </button>
                <button
                  onClick={() => {
                    handleOpenModal(selectedEmployee);
                    setIsDetailModalOpen(false);
                  }}
                  className="btn-secondary"
                >
                  <Edit2 size={18} className="text-indigo-500" />
                  <span>Cập nhật</span>
                </button>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="btn-dark"
              >
                Đóng
              </button>

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
