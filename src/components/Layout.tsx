import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Map, LayoutDashboard, Users, Settings, LogOut, Download, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { Settings as SettingsType } from '../types';

export default function Layout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  // Sidebar open by default on desktop, closed on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [settings, setSettings] = useState<SettingsType | null>(null);

  useEffect(() => {
    const fetchSettings = () => {
      fetch('/api/settings').then(r => r.json()).then(data => {
        setSettings(data);
      });
    };

    if (user) {
      fetchSettings();
    }
    
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('settingsUpdated', fetchSettings);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('settingsUpdated', fetchSettings);
    };
  }, [user]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  const navItems = [
    { to: '/app', icon: Map, label: 'Coverage Map', roles: ['admin', 'superadmin', 'vip', 'teknisi'] },
    { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['superadmin', 'vip'] },
    { to: '/app/users', icon: Users, label: 'Manage Users', roles: ['vip'] },
    { to: '/app/settings', icon: Settings, label: 'Settings', roles: ['vip'] },
    { to: '/app/export-import', icon: Download, label: 'Export/Import', roles: ['vip'] },
  ];

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        "fixed md:static inset-y-0 left-0 bg-white dark:bg-gray-800 shadow-xl md:shadow-md flex flex-col z-30 transition-all duration-300 ease-in-out",
        isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:w-0 md:opacity-0 md:overflow-hidden"
      )}>
        <div className="p-6 flex flex-col items-center justify-center min-h-[120px] relative border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center space-y-3 mt-2">
            {settings?.logo ? (
              <img src={settings.logo} alt="Logo" className="h-16 w-auto max-w-[120px] object-contain rounded" />
            ) : (
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">O</span>
              </div>
            )}
            <h1 className="text-xl font-bold whitespace-nowrap">GECoverage</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 md:hidden p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.roles.includes(user.role)).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false) }}
              className={({ isActive }) => clsx(
                "flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                isActive ? "bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <item.icon className="mr-3 h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 capitalize mb-1 px-3 truncate"> {user.name || user.username}</p>
          <p className="text-sm text-gray-500 capitalize mb-4 px-3 truncate">Role: {user.role}</p>
          <button onClick={handleLogout} className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
            <LogOut className="mr-3 h-5 w-5 shrink-0" />
            Logout
          </button>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 px-3">
            © 2026 gekanet
          </p>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header Bar */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 px-4 min-h-[72px] flex items-center z-10">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 mr-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            {/* Show logo in header when sidebar is closed (or on mobile) */}
            <div className={clsx("flex items-center space-x-3 transition-opacity duration-300", 
              isSidebarOpen ? "opacity-0 md:hidden" : "opacity-100"
            )}>
              {settings?.logo ? (
                <img src={settings.logo} alt="Logo" className="h-8 w-8 object-contain" />
              ) : (
                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-md flex items-center justify-center">
                  <span className="font-bold text-blue-600 dark:text-blue-300">O</span>
                </div>
              )}
              <h1 className="text-xl font-bold truncate">GECoverage</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative bg-gray-50 dark:bg-gray-900">
          <div className="h-full w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
