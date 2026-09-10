import React, { useState, useEffect } from 'react';
import { ODP, Customer } from '../types';
import { Activity, Users, MapPin } from 'lucide-react';

export default function Dashboard() {
  const [odps, setOdps] = useState<ODP[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const fetchData = () => {
    fetch('/api/odps')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setOdps(data);
      })
      .catch(console.error);

    fetch('/api/customers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();

    const handleDataUpdated = () => fetchData();
    window.addEventListener('dataUpdated', handleDataUpdated);

    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdated);
    };
  }, []);

  const totalCapacity = odps.reduce((acc, curr) => acc + curr.capacity, 0);
  const totalConnected = customers.length;
  const utilization = totalCapacity > 0 ? (totalConnected / totalCapacity) * 100 : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 flex items-center">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full mr-4">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total ODPs</p>
            <p className="text-2xl font-bold">{odps.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 flex items-center">
          <div className="p-3 bg-green-100 text-green-600 rounded-full mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Customers</p>
            <p className="text-2xl font-bold">{totalConnected}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 flex items-center">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-full mr-4">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Utilisasi Kapasitas</p>
            <p className="text-2xl font-bold">{utilization.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="font-bold text-lg">ODP Status Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-6 py-3">Nama ODP</th>
                <th className="px-6 py-3">Kapasitas</th>
                <th className="px-6 py-3">Terhubung</th>
                <th className="px-6 py-3">Tersedia</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {odps.map(o => {
                const connected = o.connectedCustomers || 0;
                const available = o.capacity - connected;
                const isFull = available <= 0;
                return (
                  <tr key={o.id} className="border-b dark:border-gray-700">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{o.name}</td>
                    <td className="px-6 py-4">{o.capacity}</td>
                    <td className="px-6 py-4">{connected}</td>
                    <td className="px-6 py-4">{available}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${isFull ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {isFull ? 'Penuh' : 'Tersedia'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
