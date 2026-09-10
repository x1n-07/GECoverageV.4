import React, { useState } from 'react';
import { Download, Upload, FileText } from 'lucide-react';
import Papa from 'papaparse';

export default function ExportImport() {
  const [message, setMessage] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  const handleDownloadTemplate = () => {
    const csv = Papa.unparse({
      fields: ['SHELTER', '(OLT/CARD)-PON', 'NO OTB', 'NAMA ODP', 'KOORDINAT ODP', 'KAPASITAS', 'NAMA PELANGGAN', 'KOORDINAT PELANGGAN'],
      data: []
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_import.csv';
    link.click();
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        setMessage('Failed to export data.');
        return;
      }
      const data = await res.json();
      
      if (!data.odps || !data.customers) {
        setMessage('Invalid data received from server.');
        return;
      }
      
      const rows: any[] = [];
      
      data.odps.forEach((odp: any) => {
      const odpCustomers = data.customers.filter((c: any) => c.odpId === odp.id);
      
      const odpShelter = odp.shelter || '-';
      const odpPon = odp.pon || '-';
      const odpOtb = odp.otb || '-';
      const odpName = odp.name || '-';
      const odpCoord = `https://maps.app.goo.gl/?q=${odp.lat},${odp.lng}`;
      
      if (odpCustomers.length === 0) {
        rows.push({
          SHELTER: odpShelter,
          '(OLT/CARD)-PON': odpPon,
          'NO OTB': odpOtb,
          'NAMA ODP': odpName,
          'KOORDINAT ODP': odpCoord,
          KAPASITAS: odp.capacity || 8,
          'NAMA PELANGGAN': '-',
          'KOORDINAT PELANGGAN': '-'
        });
      } else {
        odpCustomers.forEach((cust: any) => {
          rows.push({
            SHELTER: odpShelter,
            '(OLT/CARD)-PON': odpPon,
            'NO OTB': odpOtb,
            'NAMA ODP': odpName,
            'KOORDINAT ODP': odpCoord,
            KAPASITAS: odp.capacity || 8,
            'NAMA PELANGGAN': cust.name || '-',
            'KOORDINAT PELANGGAN': `https://maps.app.goo.gl/?q=${cust.lat},${cust.lng}`
          });
        });
      }
    });

    const csv = Papa.unparse({
      fields: ['SHELTER', '(OLT/CARD)-PON', 'NO OTB', 'NAMA ODP', 'KOORDINAT ODP', 'KAPASITAS', 'NAMA PELANGGAN', 'KOORDINAT PELANGGAN'],
      data: rows
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data_odp_pelanggan.csv';
    link.click();
    } catch (err) {
      console.error(err);
      setMessage('Failed to export data.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so choosing the same file again still triggers onChange
    e.target.value = '';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          if (!rows || !Array.isArray(rows)) {
            setMessage('Invalid CSV file or empty data.');
            return;
          }

          const normalizedRows = rows.map((row) => {
            return Object.entries(row).reduce((acc, [key, value]) => {
              // Strip BOM and all non-alphanumeric characters for clean indexing
              acc[String(key).replace(/^\uFEFF/, '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()] = value;
              return acc;
            }, {} as Record<string, any>);
          });

          const importedOdps: any[] = [];
          const importedCustomers: any[] = [];
          let odpIdCounter = Date.now();
          let custIdCounter = Date.now() + 100000;

          const odpMap = new Map<string, number>();

          const parseCoordinate = (value: unknown) => {
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            const match = trimmed.match(/q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i) || trimmed.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
            if (!match) return null;
            return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
          };

          const normalizeValue = (value: unknown) => {
            if (value == null) return '';
            const text = String(value).trim();
            return text === '-' ? '' : text;
          };

          const hasAnyValue = (...values: unknown[]) => values.some((value) => normalizeValue(value) !== '');

          normalizedRows.forEach((row) => {
            const odpName = normalizeValue(row['NAMAODP']);
            const customerName = normalizeValue(row['NAMAPELANGGAN']);
            const hasOdpData = hasAnyValue(odpName, row['SHELTER'], row['KABEL'], row['OLTCARDPON'], row['TUBE'], row['NOOTB'], row['CORE'], row['KAPASITAS'], row['KOORDINATODP']);
            const hasCustomerData = hasAnyValue(customerName, row['KOORDINATPELANGGAN']);

            if (!hasOdpData && !hasCustomerData) return;

            const resolvedOdpName = odpName || (customerName ? `ODP-${customerName}` : `ODP-${odpIdCounter}`);
            let odpId = odpMap.get(resolvedOdpName);
            if (!odpId) {
              odpId = odpIdCounter++;
              odpMap.set(resolvedOdpName, odpId);

              const coord = parseCoordinate(row['KOORDINATODP']);

              importedOdps.push({
                id: odpId,
                name: resolvedOdpName,
                shelter: normalizeValue(row['SHELTER'] ?? row['KABEL']),
                pon: normalizeValue(row['OLTCARDPON'] ?? row['TUBE']),
                otb: normalizeValue(row['NOOTB'] ?? row['CORE']),
                lat: coord?.lat ?? 0,
                lng: coord?.lng ?? 0,
                capacity: normalizeValue(row['KAPASITAS']) ? parseInt(normalizeValue(row['KAPASITAS']), 10) : 8
              });
            }

            if (hasCustomerData) {
              const coord = parseCoordinate(row['KOORDINATPELANGGAN']);
              const resolvedCustomerName = customerName || `Customer-${custIdCounter}`;

              importedCustomers.push({
                id: custIdCounter++,
                name: resolvedCustomerName,
                lat: coord?.lat ?? 0,
                lng: coord?.lng ?? 0,
                odpId: odpId
              });
            }
          });

          if (importedOdps.length === 0 && importedCustomers.length === 0) {
            setMessage('No valid ODP or customer data found in the selected file.');
            return;
          }

          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ importedOdps, importedCustomers, importMode })
          });

          const result = await res.json().catch(() => ({}));

          if (res.ok) {
            setMessage(result.message || 'Data imported successfully!');
            window.dispatchEvent(new Event('dataUpdated'));
          } else {
            setMessage(result.error || 'Failed to import data.');
          }
        } catch (err) {
          setMessage('Invalid file format. Please upload a valid CSV export.');
        }
      },
      error: () => {
        setMessage('Error parsing CSV file.');
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Export / Import Data</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 text-center flex flex-col items-center justify-center">
          <Download className="w-12 h-12 text-blue-500 mb-4" />
          <h2 className="font-bold mb-2">Export Data</h2>
          <p className="text-sm text-gray-500 mb-4">Download all ODPs and Customers as a CSV file matching the requested format.</p>
          <button onClick={handleExport} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
            Export CSV
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 text-center flex flex-col items-center justify-center">
          <FileText className="w-12 h-12 text-purple-500 mb-4" />
          <h2 className="font-bold mb-2">Download Template</h2>
          <p className="text-sm text-gray-500 mb-4">Download an empty CSV template with headers for importing data.</p>
          <button onClick={handleDownloadTemplate} className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-700">
            Download Template
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700 text-center flex flex-col items-center justify-center">
          <Upload className="w-12 h-12 text-green-500 mb-2" />
          <h2 className="font-bold mb-1">Import Data</h2>
          <p className="text-xs text-gray-500 mb-3">Upload a CSV file to restore or add data.</p>
          
          <div className="flex items-center justify-center gap-4 mb-3 text-xs text-gray-700 dark:text-gray-300 relative z-10">
            <label className="flex items-center gap-1 cursor-pointer">
              <input 
                type="radio" 
                name="importMode" 
                value="replace" 
                checked={importMode === 'replace'} 
                onChange={() => setImportMode('replace')} 
              />
              Ganti Semua
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input 
                type="radio" 
                name="importMode" 
                value="append" 
                checked={importMode === 'append'} 
                onChange={() => setImportMode('append')} 
              />
              Tambah Saja
            </label>
          </div>

          {/* File input overlays ONLY the button so radio options stay clickable */}
          <div className="relative z-10">
            <input type="file" accept=".csv" onChange={handleImport} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <button className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 pointer-events-none">
              Choose CSV File
            </button>
          </div>
        </div>
      </div>
      {message && <div className="mt-4 p-3 bg-blue-50 text-blue-800 rounded">{message}</div>}
    </div>
  );
}
