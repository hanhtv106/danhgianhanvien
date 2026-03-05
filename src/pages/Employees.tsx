import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Download, Upload, MapPin } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Employee, Department, Branch } from '../types';
import * as XLSX from 'xlsx';

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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
    is_resigned: false
  });

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
        is_resigned: emp.is_resigned
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        employee_code: '',
        full_name: '',
        department_id: departments[0]?.id.toString() || '',
        branch_id: branches[0]?.id.toString() || '',
        cccd: '',
        is_resigned: false
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
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
      fetchData();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý Nhân viên</h2>
          <p className="text-slate-500">Danh sách và thông tin nhân viên trong hệ thống</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download size={18} />
            <span>Tải file mẫu</span>
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
            <Upload size={18} />
            <span>Import Excel</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImport} />
          </label>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
            <span>Thêm nhân viên</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Mã NV</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Họ tên</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Chi nhánh</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Phòng ban</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">CCCD</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Trạng thái</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => handleViewDetail(emp)}>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">{emp.employee_code}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{emp.full_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.branch_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.department_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.cccd}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      emp.is_resigned ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      {emp.is_resigned ? 'Đã nghỉ việc' : 'Đang làm việc'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleOpenModal(emp)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mã nhân viên</label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={e => setFormData({ ...formData, employee_code: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phòng ban</label>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số CCCD</label>
                  <input
                    type="text"
                    required
                    value={formData.cccd}
                    onChange={e => setFormData({ ...formData, cccd: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                {editingEmployee && (
                  <div className="flex items-end pb-2">
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
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">Hủy</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDetailModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-slate-900">Chi tiết nhân viên</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div className="space-y-6">
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-1">Thông tin cơ bản</p>
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Mã nhân viên:</span>
                      <span className="font-bold text-slate-900">{selectedEmployee.employee_code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Họ và tên:</span>
                      <span className="font-bold text-slate-900">{selectedEmployee.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Số CCCD:</span>
                      <span className="font-bold text-slate-900">{selectedEmployee.cccd}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-1">Công tác</p>
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Chi nhánh:</span>
                      <span className="font-bold text-slate-900">{selectedEmployee.branch_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Phòng ban:</span>
                      <span className="font-bold text-slate-900">{selectedEmployee.department_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Trạng thái:</span>
                      <span className={cn("font-bold", selectedEmployee.is_resigned ? "text-red-500" : "text-emerald-500")}>
                        {selectedEmployee.is_resigned ? 'Đã nghỉ việc' : 'Đang làm việc'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-1">Dữ liệu hệ thống</p>
                  <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Ngày tạo:</span>
                      <span className="font-medium text-slate-900">
                        {selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString('vi-VN') : '---'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Người tạo:</span>
                      <span className="font-medium text-indigo-600">{selectedEmployee.created_by_name || 'Hệ thống'}</span>
                    </div>
                    <hr className="border-slate-200" />
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Lần sửa cuối:</span>
                      <span className="font-medium text-slate-900">
                        {selectedEmployee.updated_at ? new Date(selectedEmployee.updated_at).toLocaleDateString('vi-VN') : 'Chưa sửa'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 text-sm">Người sửa:</span>
                      <span className="font-medium text-indigo-600">{selectedEmployee.updated_by_name || '---'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 italic text-indigo-600 text-xs text-center">
                  Cảm ơn bạn đã đóng góp vào hệ thống quản lý nhân sự.
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button onClick={() => setIsDetailModalOpen(false)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
