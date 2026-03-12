import React, { useState, useEffect } from 'react';
import { Shield, Save, Check, Lock, AlertCircle } from 'lucide-react';
import { apiFetch } from '../services/api';

interface Permission {
    id: number;
    module: string;
    action: string;
    name: string;
}

interface Role {
    id: number;
    name: string;
    description: string;
    role_permissions: { permission_id: number }[];
}

const MODULE_LABELS: Record<string, string> = {
    employees: 'Nhân viên',
    branches: 'Chi nhánh',
    departments: 'Phòng ban',
    reasons: 'Lý do sao',
    users: 'Tài khoản',
    evaluations: 'Đánh giá',
    reports: 'Báo cáo'
};

const ACTION_LABELS: Record<string, string> = {
    view: 'Xem',
    create: 'Thêm',
    edit: 'Sửa',
    delete: 'Xoá'
};

export default function Permissions() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [selectedRolePermissions, setSelectedRolePermissions] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [rolesData, permsData] = await Promise.all([
                apiFetch('/api/roles'),
                apiFetch('/api/permissions')
            ]);
            setRoles(rolesData);
            setPermissions(permsData);
            if (rolesData.length > 0 && !selectedRoleId) {
                handleSelectRole(rolesData[0]);
            } else if (selectedRoleId) {
                const currentRole = rolesData.find((r: Role) => r.id === selectedRoleId);
                if (currentRole) handleSelectRole(currentRole);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSelectRole = (role: Role) => {
        setSelectedRoleId(role.id);
        setSelectedRolePermissions(role.role_permissions.map(rp => rp.permission_id));
        setMessage({ type: '', text: '' });
    };

    const togglePermission = (permissionId: number) => {
        setSelectedRolePermissions(prev =>
            prev.includes(permissionId)
                ? prev.filter(id => id !== permissionId)
                : [...prev, permissionId]
        );
    };

    const handleSave = async () => {
        if (!selectedRoleId) return;
        setSaving(true);
        try {
            await apiFetch(`/api/roles/${selectedRoleId}/permissions`, {
                method: 'POST',
                body: JSON.stringify({ permissionIds: selectedRolePermissions })
            });
            setMessage({ type: 'success', text: 'Cập nhật quyền hạn thành công!' });
            // Refresh roles to update the local state
            const updatedRoles = await apiFetch('/api/roles');
            setRoles(updatedRoles);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    );

    const modules: string[] = Array.from(new Set(permissions.map(p => p.module)));
    const actions = ['view', 'create', 'edit', 'delete'];

    return (
        <div className="space-y-6 pb-24 md:pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Thiết lập Phân quyền</h2>
                    <p className="text-sm text-slate-500">Quản lý chi tiết quyền hạn cho từng vai trò</p>
                </div>
                {selectedRoleId && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 active:scale-95"
                    >
                        {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={18} />}
                        <span>Lưu thay đổi</span>
                    </button>
                )}
            </div>

            {message.text && (
                <div className={`p-4 rounded-2xl flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                    {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Role List */}
                <div className="w-full lg:w-72 flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-2">Vai trò</h3>
                    {roles.map(role => (
                        <button
                            key={role.id}
                            onClick={() => handleSelectRole(role)}
                            className={`flex flex-col p-4 rounded-2xl text-left transition-all ${selectedRoleId === role.id
                                ? "bg-white border-2 border-indigo-500 shadow-md shadow-indigo-50"
                                : "bg-white border border-slate-100 hover:border-indigo-200"
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Shield size={18} className={selectedRoleId === role.id ? "text-indigo-600" : "text-slate-400"} />
                                <span className={`font-bold ${selectedRoleId === role.id ? "text-slate-900" : "text-slate-600"}`}>
                                    {role.name === 'SUPER_ADMIN' ? 'Admin' : role.name === 'ADMIN' ? 'Quản trị' : 'User'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">{role.description}</p>
                        </button>
                    ))}
                </div>

                {/* Permission Grid */}
                <div className="flex-1">
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-8 py-5 text-sm font-bold text-slate-700">Module / Chức năng</th>
                                        {actions.map(action => (
                                            <th key={action} className="px-4 py-5 text-sm font-bold text-slate-700 text-center">
                                                {ACTION_LABELS[action]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {modules.map(module => (
                                        <tr key={module} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-5">
                                                <span className="font-semibold text-slate-900">{(MODULE_LABELS as any)[module] || module}</span>
                                            </td>
                                            {actions.map(action => {
                                                const perm = permissions.find(p => p.module === module && p.action === action);
                                                if (!perm) return <td key={action} className="px-4 py-5 text-center">
                                                    <Lock size={14} className="mx-auto text-slate-200" />
                                                </td>;

                                                return (
                                                    <td key={action} className="px-4 py-5 text-center">
                                                        <label className="inline-flex items-center justify-center cursor-pointer p-2">
                                                            <input
                                                                type="checkbox"
                                                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                checked={selectedRolePermissions.includes(perm.id)}
                                                                onChange={() => togglePermission(perm.id)}
                                                            />
                                                        </label>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 px-4">
                        <Lock size={14} />
                        <span>Các ô bị khoá nghĩa là chức năng đó không khả dụng cho module tương ứng.</span>
                    </div>
                </div>
            </div>

            {/* Mobile Fixed Save Button */}
            {selectedRoleId && (
                <div className="md:hidden fixed bottom-6 left-6 right-6 z-40 animate-in slide-in-from-bottom-5 duration-500">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-14 flex items-center justify-center gap-3 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-2xl shadow-indigo-300 active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save size={20} />}
                        <span>Lưu thay đổi</span>
                    </button>
                </div>
            )}
        </div>
    );
}
