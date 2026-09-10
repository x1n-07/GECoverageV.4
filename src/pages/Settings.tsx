import React, { useState, useEffect } from 'react';
import { Settings as SettingsType } from '../types';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType>({ coverageDistance: 50 });
  const [distance, setDistance] = useState(50);
  const [logo, setLogo] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setSettings(data);
      setDistance(data.coverageDistance ?? 50);
      setLogo(data.logo);
    });
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverageDistance: distance, logo })
    });
    if (res.ok) {
      const updatedSettings = await res.json();
      setSettings(updatedSettings);
      setLogo(updatedSettings.logo);
      setSaved(true);
      window.dispatchEvent(new Event('settingsUpdated'));
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Application Settings</h1>
      
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
        <h2 className="font-bold mb-4 border-b pb-2 dark:border-gray-700">ODP Configuration</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">ODP Coverage Distance (meters)</label>
          <p className="text-xs text-gray-500 mb-2">This determines the radius drawn around each ODP and affects coverage calculation.</p>
          <input 
            type="number" 
            value={distance} 
            onChange={e => setDistance(parseInt(e.target.value) || 0)} 
            min="10" 
            max="1000"
            className="w-full max-w-xs border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" 
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Application Logo</label>
          <p className="text-xs text-gray-500 mb-2">Upload a logo to display in the application header.</p>
          <input 
            type="file" 
            accept=".png, .jpg, .jpeg, .svg, .webp, image/*"
            onChange={handleLogoChange}
            className="w-full max-w-xs border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" 
          />
          <div className="flex items-center space-x-4 mt-4">
            {logo ? (
              <div>
                <p className="text-xs text-gray-500 mb-1">Preview:</p>
                <img src={logo} alt="Logo Preview" className="h-20 max-w-[200px] object-contain border p-2 rounded bg-gray-50 dark:bg-gray-800" />
                <button type="button" onClick={() => setLogo(undefined)} className="text-xs text-red-500 hover:text-red-700 mt-2 block">Remove Logo</button>
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No logo selected</p>
            )}
          </div>
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
          Save Settings
        </button>
        {saved && <span className="ml-3 text-green-600 text-sm font-medium">Saved successfully!</span>}
      </form>
    </div>
  );
}
