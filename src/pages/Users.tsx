import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Download, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import Papa from 'papaparse';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<User['role']>('admin');
  const [contact, setContact] = useState('');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const togglePasswordVisibility = (userId: number) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const fetchData = async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setPassword('');
    setRole('admin');
    setContact('');
    setEditingUserId(null);
    setShowFormPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, username, password, role, contact };
    const method = editingUserId ? 'PUT' : 'POST';
    const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      resetForm();
      fetchData();
    } else {
      alert(await res.text());
    }
  };

  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setName(user.name ?? '');
    setUsername(user.username);
    setPassword(user.password ?? '');
    setRole(user.role);
    setContact(user.contact ?? '');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete user?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(users.map(u => ({
      Name: u.name ?? '',
      Username: u.username,
      Password: u.password ?? '',
      Role: u.role,
      Contact: u.contact ?? ''
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'users.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <button onClick={handleExportCSV} className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm font-medium dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
          <Download className="w-4 h-4 mr-2" /> Export to CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
            <h2 className="text-lg font-bold mb-4 flex items-center"><Plus className="w-5 h-5 mr-1"/> {editingUserId ? 'Edit User' : 'Add User'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required={!editingUserId}
                    className="w-full border rounded px-3 py-2 pr-10 text-sm dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    title={showFormPassword ? "Hide password" : "Show password"}
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select value={role} onChange={e => setRole(e.target.value as User['role'])} className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600">
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                  <option value="vip">VIP</option>
                  <option value="teknisi">Teknisi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact</label>
                <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700 text-sm">{editingUserId ? 'Update User' : 'Create User'}</button>
                {editingUserId ? (
                  <button type="button" onClick={resetForm} className="px-4 py-2 rounded text-sm border dark:border-gray-600 dark:text-gray-200">Cancel</button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Password</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b dark:border-gray-700">
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">{u.name ?? '-'}</td>
                    <td className="px-4 py-4">{u.username}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span>
                          {u.password 
                            ? (visiblePasswords[u.id] ? u.password : '••••••••') 
                            : '-'}
                        </span>
                        {u.password && (
                          <button 
                            type="button" 
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            title={visiblePasswords[u.id] ? "Hide password" : "Show password"}
                          >
                            {visiblePasswords[u.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 capitalize">{u.role}</td>
                    <td className="px-4 py-4">{u.contact ?? '-'}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(u)} className="text-blue-600 hover:text-blue-800" title="Edit user"><Pencil className="w-4 h-4"/></button>
                        <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700" title="Delete user"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
