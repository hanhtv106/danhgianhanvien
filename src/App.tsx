import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Layout from './components/Layout';
import EvaluationPage from './pages/Evaluation';
import Reports from './pages/Reports';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Reasons from './pages/Reasons';
import UsersPage from './pages/Users';
import Branches from './pages/Branches';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('evaluation');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);

    const handleTabChange = (e: any) => setActiveTab(e.detail);
    window.addEventListener('tabChange', handleTabChange);
    return () => window.removeEventListener('tabChange', handleTabChange);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    setActiveTab('evaluation');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      {activeTab === 'evaluation' && <EvaluationPage user={user} />}
      {activeTab === 'reports' && <Reports />}
      {activeTab === 'employees' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && <Employees />}
      {activeTab === 'branches' && user.role === 'SUPER_ADMIN' && <Branches />}
      {activeTab === 'departments' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && <Departments />}
      {activeTab === 'reasons' && (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') && <Reasons />}
      {activeTab === 'users' && user.role === 'SUPER_ADMIN' && <UsersPage />}
    </Layout>
  );
}
