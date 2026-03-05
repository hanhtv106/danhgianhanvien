import React, { useState, useEffect } from 'react';
import {
  Users,
  User as UserIcon,
  Building2,
  Briefcase,
  Star,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Lock,
  Shield,
  MapPin,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User } from '../types';
import { apiFetch } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');
  const [cpLoading, setCpLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const menuItems = [
    { icon: Star, label: 'Đánh giá', path: 'evaluation', permission: 'evaluations:view' },
    { icon: BarChart3, label: 'Báo cáo', path: 'reports', permission: 'reports:view' },
    { icon: Users, label: 'Nhân viên', path: 'employees', permission: 'employees:view' },
    { icon: MapPin, label: 'Chi nhánh', path: 'branches', permission: 'branches:view' },
    { icon: Building2, label: 'Phòng ban', path: 'departments', permission: 'departments:view' },
    { icon: Star, label: 'Lý do sao', path: 'reasons', permission: 'reasons:view' },
    { icon: Users, label: 'Người dùng', path: 'users', permission: 'users:view' },
    { icon: Shield, label: 'Phân quyền', path: 'permissions', permission: 'users:edit' }, // Super admins usually have users:edit
  ];

  const filteredMenu = menuItems.filter(item =>
    user.role === 'SUPER_ADMIN' || user.permissions?.includes(item.permission)
  );

  const [activeTab, setActiveTab] = useState(filteredMenu[0]?.path || 'evaluation');

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('tabChange', { detail: activeTab }));
  }, [activeTab]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    setCpSuccess('');
    if (newPassword !== confirmPassword) {
      setCpError('Mật khẩu mới không khớp');
      return;
    }
    setCpLoading(true);
    try {
      await apiFetch('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setCpSuccess('Đổi mật khẩu thành công');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowChangePassword(false), 2000);
    } catch (err: any) {
      setCpError(err.message);
    } finally {
      setCpLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <h1 className="text-xl font-bold text-indigo-600 truncate">SAMCO VINA</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-lg hover:bg-slate-100">
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {filteredMenu.map((item) => (
            <button
              key={item.path}
              onClick={() => setActiveTab(item.path)}
              className={cn(
                "w-full flex items-center p-3 rounded-xl transition-colors",
                activeTab === item.path
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <item.icon size={22} />
              {isSidebarOpen && <span className="ml-3 font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className={cn("flex flex-col", isSidebarOpen ? "items-stretch" : "items-center")}>
            <div className={cn("flex items-center mb-2", isSidebarOpen ? "px-2" : "justify-center")}>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {user.role === 'SUPER_ADMIN' ? 'Admin' : user.role === 'ADMIN' ? 'Quản trị' : 'User'}
                  </p>
                </div>
              )}
              <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Đăng xuất">
                <LogOut size={20} />
              </button>
            </div>
            {isSidebarOpen && (
              <button
                onClick={() => setShowChangePassword(true)}
                className="flex items-center px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Lock size={14} className="mr-2" />
                Đổi mật khẩu
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-20 p-2 bg-white rounded-lg shadow-md"
        >
          <Menu size={24} />
        </button>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-30 flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="relative w-64 bg-white h-full flex flex-col">
              <div className="p-6 flex items-center justify-between border-bottom">
                <h1 className="text-xl font-bold text-indigo-600">HR Star</h1>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X size={24} />
                </button>
              </div>
              <nav className="flex-1 px-4 py-4 space-y-2">
                {filteredMenu.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => {
                      setActiveTab(item.path);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center p-3 rounded-xl transition-colors",
                      activeTab === item.path
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <item.icon size={22} />
                    <span className="ml-3 font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
              <div className="p-6 border-t space-y-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowChangePassword(true);
                  }}
                  className="w-full flex items-center p-3 text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  <Lock size={22} />
                  <span className="ml-3 font-medium">Đổi mật khẩu</span>
                </button>
                <button onClick={onLogout} className="w-full flex items-center p-3 text-red-600 hover:bg-red-50 rounded-xl">
                  <LogOut size={22} />
                  <span className="ml-3 font-medium">Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, { activeTab });
            }
            return child;
          })}
        </div>
      </main>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Đổi mật khẩu</h2>
              <button onClick={() => setShowChangePassword(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {cpError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center text-red-600 text-sm">
                  <AlertCircle size={16} className="mr-2" />
                  {cpError}
                </div>
              )}
              {cpSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center text-emerald-600 text-sm">
                  <Star size={16} className="mr-2" />
                  {cpSuccess}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu cũ</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={cpLoading}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  {cpLoading ? 'Đang xử lý...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
