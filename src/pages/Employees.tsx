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
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
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
      const data = XLSX.utils.sheet_to_json(ws);
      
      // Map names to IDs
      const mappedData = data.map((row: any) => ({
        employee_code: row['Mã nhân viên']?.toString(),
        full_name: row['Họ tên'],
        department_id: departments.find(d => d.name === row['Phòng ban'] || d.name === row['Bộ phận'])?.id,
        branch_id: branches.find(b => b.name === row['Chi nhánh'])?.id,
        cccd: row['Số CCCD']?.toString(),
        is_resigned: row['Đã nghỉ việc'] === 'Có' || row['Đã nghỉ việc'] === true
      })).filter(emp => emp.employee_code && emp.department_id && emp.branch_id);

      if (mappedData.length > 0) {
        apiFetch('/api/employees/import', {
          method: 'POST',
          body: JSON.stringify({ data: mappedData })
        }).then(() => fetchData());
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        'Mã nhân viên': 'NV001',
        'Họ tên': 'Nguyễn Văn A',
        'Số CCCD': '012345678901',
        'Phòng ban': departments[0]?.name || 'Phòng Hành chính',
        'Chi nhánh': branches[0]?.name || 'Chi nhánh 1',
        'Đã nghỉ việc': 'Không'
      },
      {
        'Mã nhân viên': 'NV002',
        'Họ tên': 'Trần Thị B',
        'Số CCCD': '012345678902',
        'Phòng ban': departments[0]?.name || 'Phòng Hành chính',
        'Chi nhánh': branches[0]?.name || 'Chi nhánh 1',
        'Đã nghỉ việc': 'Không'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Mau_Import_Nhan_Vien.xlsx");
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
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
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
                  <td className="px-6 py-4 text-right">
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
                    onChange={e => setFormData({...formData, employee_code: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chi nhánh</label>
                  <select
                    value={formData.branch_id}
                    onChange={e => setFormData({...formData, branch_id: e.target.value})}
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
                    onChange={e => setFormData({...formData, department_id: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
                    onChange={e => setFormData({...formData, cccd: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  />
                </div>
                {editingEmployee && (
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_resigned}
                        onChange={e => setFormData({...formData, is_resigned: e.target.checked})}
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
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
