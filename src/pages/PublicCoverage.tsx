import React, { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type CoverageResult = {
  status: 'Terjangkau' | 'Tidak terjangkau' | 'ODP penuh';
};

export default function PublicCoverage() {
  const [inputCoords, setInputCoords] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [coverageResult, setCoverageResult] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parseCoordinateInput = async (value: string) => {
    const trimmed = value.trim();
    const directMatch = trimmed.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
    if (directMatch) {
      return {
        lat: parseFloat(directMatch[1]),
        lng: parseFloat(directMatch[2])
      };
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      return null;
    }

    try {
      const res = await fetch('/api/resolve-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: trimmed })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        return data;
      }
    } catch {
      return null;
    }

    return null;
  };

  const fetchCoverage = async (lat: number, lng: number) => {
    setLoading(true);
    setError('');
    setCoverageResult(null);

    try {
      const res = await fetch('/api/check-coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghitung jangkauan');
      }

      const data = await res.json();
      setCoverageResult(data);
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    setError('');
    const parsed = await parseCoordinateInput(inputCoords);
    if (!parsed) {
      setError("Format tidak valid. Masukkan 'lat, lng' atau link Google Maps.");
      return;
    }
    setLocation(parsed);
    await fetchCoverage(parsed.lat, parsed.lng);
  };

  const handleLocateMe = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung geolokasi.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setInputCoords(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
          setLocation(coords);
          await fetchCoverage(coords.lat, coords.lng);
      },
      (error) => {
        setError('Geolocation error: ' + error.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  
  // Convert backend status to simplified public status
  const getPublicStatus = (status: CoverageResult['status'] | null) => {
    if (!status) return null;
    if (status === 'Terjangkau') return 'Terjangkau';
    return 'Tidak terjangkau'; // 'ODP penuh' and 'Tidak terjangkau' map to 'Tidak terjangkau'
  };

  const publicStatus = getPublicStatus(coverageResult?.status);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-6 md:p-8">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Logo" className="h-20 w-auto max-w-[200px] object-contain mx-auto" />
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
            Periksa jangkauan gekanet di lokasi Anda.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <input
            type="text"
            value={inputCoords}
            onChange={e => setInputCoords(e.target.value)}
            placeholder="-6.19319, 106.78186 atau link Google Maps"
            className="flex-1 w-full rounded-2xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-2xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MapPin className="mr-2 h-4 w-4" />
            {loading && !location ? 'Mencari...' : 'Cek Jangkauan'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          <Navigation className="h-4 w-4" />
          {loading && location ? 'Mencari Lokasi...' : 'Gunakan Lokasi Saya'}
        </button>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200 mb-6"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {publicStatus && (
            <motion.div
              key={publicStatus} // Key helps AnimatePresence detect changes
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={
                `rounded-3xl border p-5 text-center ` +
                (publicStatus === 'Terjangkau'
                  ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900'
                  : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900')
              }
            >
              <p className="text-sm uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">Hasil Pemeriksaan</p>
              <p className={
                `mt-3 text-3xl font-bold ` +
                (publicStatus === 'Terjangkau'
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-gray-700 dark:text-gray-300')
              }>
                {publicStatus}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <footer className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        © 2026 gekanet
      </footer>
    </div>
  );
}
