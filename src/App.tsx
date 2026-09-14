import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import MapPage from './pages/MapPage';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Settings from './pages/Settings';
import ExportImport from './pages/ExportImport';
import PublicCoverage from './pages/PublicCoverage';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 flex justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
};

export default function App() {
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;
      if (!isEditable) event.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicCoverage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<MapPage />} />
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['superadmin', 'vip']}><Dashboard /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute allowedRoles={['vip']}><Users /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['vip']}><Settings /></ProtectedRoute>} />
            <Route path="export-import" element={<ProtectedRoute allowedRoles={['vip']}><ExportImport /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
