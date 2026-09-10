import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Fix for default leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Generate a repeating diagonal-text watermark data URL (Base64 SVG)
// isSatellite: true → white text with dark outline (visible on satellite tiles)
// isSatellite: false → dark gray text (visible on light street tiles)
const buildWatermarkUrl = (accountName: string, isSatellite: boolean): string => {
  const fullText = `@gekanet | ${accountName}`;
  const escaped = fullText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  const fill = isSatellite ? '#ffffff' : '#475569';
  const opacity = isSatellite ? '0.6' : '0.35';
  const strokeAttr = isSatellite
    ? ' stroke="#1e293b" stroke-width="0.5" paint-order="stroke"'
    : '';
  const svgRaw = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="55" fill="${fill}"${strokeAttr} opacity="${opacity}" font-size="11" font-family="Arial, sans-serif" font-weight="600" text-anchor="middle" transform="rotate(-30, 50, 50)">${escaped}</text></svg>`;
  const bytes = new TextEncoder().encode(svgRaw);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return `url("data:image/svg+xml;base64,${btoa(binary)}")`;
};

const MapUpdater = ({ location }: { location: { lat: number; lng: number } | null }) => {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    map.setView([location.lat, location.lng], 15, { animate: true });
  }, [location, map]);

  return null;
};

const MapRefSetter = ({ mapRef, onReady }: { mapRef: React.MutableRefObject<L.Map | null>; onReady: () => void }) => {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    onReady();
  }, [map, mapRef, onReady]);

  return null;
};

type CoverageResult = {
  status: 'Terjangkau' | 'Tidak terjangkau' | 'ODP penuh';
};

export default function PublicCoverage() {
  const [inputCoords, setInputCoords] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [coverageResult, setCoverageResult] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
  const mapRef = useRef<L.Map | null>(null);
  const auth = useAuth();

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
    const parsed = await parseCoordinateInput(inputCoords);
    if (!parsed) {
      setError("Format tidak valid. Masukkan 'lat, lng' atau link Google Maps.");
      return;
    }
    setLocation(parsed);

    // If the user is not logged in, redirect to WhatsApp for CS instead of
    // showing results to the public. Logged-in users (internal team) keep the
    // existing in-app coverage check behavior.
    if (!auth?.user) {
      try {
        const rawPhone = '085225225959';
        const phone = rawPhone.replace(/[^0-9+]/g, '').replace(/^0/, '62');
        const msg = `Permohonan pemeriksaan jangkauan untuk koordinat: ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)} apakah dapat dilayani`;
        const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(msg)}`;
        window.location.href = url;
      } catch (e) {
        setError('Gagal membuka WhatsApp. Silakan coba lagi.');
      }
      return;
    }

    await fetchCoverage(parsed.lat, parsed.lng);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung geolokasi.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setInputCoords(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
          setLocation(coords);

          if (!auth?.user) {
            try {
              const rawPhone = '085225225959';
              const phone = rawPhone.replace(/[^0-9+]/g, '').replace(/^0/, '62');
              const msg = `Permohonan pemeriksaan jangkauan untuk koordinat: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} apakah dapat dilayani`;
              const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(msg)}`;
              window.location.href = url;
            } catch (e) {
              setError('Gagal membuka WhatsApp. Silakan coba lagi.');
            }
            return;
          }

          await fetchCoverage(coords.lat, coords.lng);
      },
      (error) => {
        setError('Geolocation error: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleMapReady = (map: L.Map) => {
    mapRef.current = map;
    setMapReady(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="mb-6 flex flex-col gap-4">
            <div>
              <h1 className="text-3xl font-bold">Periksa Jangkauan</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Masukkan koordinat atau link Google Maps untuk mengetahui apakah lokasi berada dalam jangkauan ODP.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={inputCoords}
                onChange={e => setInputCoords(e.target.value)}
                placeholder="-6.19319, 106.78186 atau link Google Maps"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleCheck}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <MapPin className="mr-2 h-4 w-4" />
                Cek Jangkauan
              </button>
            </div>

            <button
              type="button"
              onClick={handleLocateMe}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Navigation className="h-4 w-4" />
              Gunakan Lokasi Saya
            </button>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200">
                {error}
              </div>
            )}

            {coverageResult && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Hasil Pemeriksaan</p>
                <p className={`mt-3 text-2xl font-semibold ${coverageResult.status === 'Terjangkau' ? 'text-emerald-700 dark:text-emerald-300' : coverageResult.status === 'ODP penuh' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {coverageResult.status}
                </p>
              </div>
            )}

            <div className="h-[420px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900">
               <div className="relative h-full w-full">
               <MapContainer
                  center={location ? [location.lat, location.lng] : [-7.847975142402355, 110.48151709681206]}
                  zoom={location ? 15 : 12}
                 className="h-full w-full"
               >
                 <MapRefSetter mapRef={mapRef} onReady={() => setMapReady(true)} />
                 {mapLayer === 'streets' ? (
                   <TileLayer
                     url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                     attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                   />
                 ) : (
                   <>
                     <TileLayer
                       url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                       attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                       maxZoom={19}
                     />
                     <TileLayer
                       url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                       attribution=""
                       maxZoom={19}
                     />
                   </>
                 )}
                 {location && (
                   <>
                     <MapUpdater location={location} />
                     <Marker position={[location.lat, location.lng]} icon={redIcon}>
                       <Popup>
                         Lokasi pemeriksaan<br />{location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                       </Popup>
                     </Marker>
                   </>
                 )}
               </MapContainer>

               {/* Repeating Watermark Overlay (Above map tiles, below UI buttons) */}
                <div
                  className="absolute inset-0 z-[500] pointer-events-none select-none"
                  style={{
                    backgroundImage: buildWatermarkUrl(auth.user?.name || auth.user?.username || 'public-guest', mapLayer === 'satellite'),
                    backgroundRepeat: 'repeat'
                  }}
                />

               {/* Layer Toggle Button */}
               <button
                 type="button"
                 onClick={() => setMapLayer(mapLayer === 'streets' ? 'satellite' : 'streets')}
                 className={`absolute top-3 right-3 z-[1000] p-1.5 border rounded-xl shadow-lg transition ${
                   mapLayer === 'satellite'
                     ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                     : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                 }`}
                 title={mapLayer === 'streets' ? "Switch to Satellite view" : "Switch to Streets view"}
               >
                 <div className="inline-flex items-center gap-1">
                   <Layers className="w-3.5 h-3.5" />
                   <span className="text-[9px] font-semibold">{mapLayer === 'streets' ? 'Satelit' : 'Jalan'}</span>
                 </div>
               </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
