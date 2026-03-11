import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EvaluationPage from './pages/Evaluation';
import Reports from './pages/Reports';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Reasons from './pages/Reasons';
import UsersPage from './pages/Users';
import Branches from './pages/Branches';
import Permissions from './pages/Permissions';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  
  // Initialize tab from hash, default to evaluation
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'evaluation';
  });
  
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
  };

  useEffect(() => {
    const savedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);

    // Initial setup based on hash
    if (!window.location.hash && savedUser) {
      window.location.hash = 'evaluation';
    }

    // Handle hash change for navigation
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    document.title = 'Hệ thống Đánh giá Nhân viên';
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Inactivity timeout (15 minutes)
  useEffect(() => {
    if (!user) return;

    let timeoutId: number;
    const INACTIVITY_TIME = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLogout();
        alert("Phiên làm việc đã hết hạn do bạn không hoạt động trong 15 phút.");
      }, INACTIVITY_TIME);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('token', token);
    window.location.hash = 'evaluation'; // Update hash on login
    setActiveTab('evaluation');
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'evaluation' && <EvaluationPage user={user} />}
      {activeTab === 'reports' && <Reports user={user} />}
      {activeTab === 'employees' && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('employees:view')) && <Employees />}
      {activeTab === 'branches' && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('branches:view')) && <Branches />}
      {activeTab === 'departments' && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('departments:view')) && <Departments />}
      {activeTab === 'reasons' && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('reasons:view')) && <Reasons user={user} />}
      {activeTab === 'users' && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('users:view')) && <UsersPage />}
      {activeTab === 'permissions' && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('users:edit')) && <Permissions />}
    </Layout>
  );
}
