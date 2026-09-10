import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok && data.user) {
      setUser(data.user);
      navigate('/app');
    } else {
      setError(data.error || 'Login failed');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <form onSubmit={handleLogin} className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-gray-800">
        <div className="mb-6 flex flex-col items-center">
          <img src="/logo.png" alt="CoverageKu logo" className="mb-4 h-16 w-16 object-contain" />
          <h2 className="text-center text-2xl font-bold text-gray-800 dark:text-white">ODP Coverage App</h2>
        </div>
        {error && <div className="mb-4 text-sm text-red-500">{error}</div>}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </div>
        <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          Sign In
        </button>
        <div className="mt-4 text-xs text-gray-500 text-center">
          © 2026 gekanet
        </div>
      </form>
    </div>
  );
}
