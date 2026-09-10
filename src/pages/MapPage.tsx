import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../contexts/AuthContext';
import { ODP, Customer, Settings } from '../types';
import { MapPin, Navigation, Plus, Trash2, Edit3, Maximize2, Minimize2, ChevronDown, ChevronUp, Layers } from 'lucide-react';

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

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
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

export default function MapPage() {
  const { user } = useAuth();
  const mapRef = useRef<L.Map | null>(null);
  const pendingFocusRef = useRef<{ lat: number; lng: number; zoom?: number } | null>(null);
  const hasCenteredRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [odps, setOdps] = useState<ODP[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings>({ coverageDistance: 50 });
  const [prospectiveLoc, setProspectiveLoc] = useState<{lat: number, lng: number} | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [nearestOdp, setNearestOdp] = useState<ODP | null>(null);
  const [recommendedOdp, setRecommendedOdp] = useState<ODP | null>(null);
  const [recommendedRoutePath, setRecommendedRoutePath] = useState<[number, number][]>([]);
  const [recommendedRouteDistance, setRecommendedRouteDistance] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string>('');
  
  const [inputCoords, setInputCoords] = useState('');
  const isTeknisi = user?.role === 'teknisi';
  const [addingMode, setAddingMode] = useState<'odp' | 'customer' | null>(null);
  // Undo history for ODP position edit: stores previous {lat, lng} snapshots
  const [odpEditHistory, setOdpEditHistory] = useState<{ lat: number; lng: number }[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');

  // Form states
  const [newOdpName, setNewOdpName] = useState('');
  const [newOdpCapacity, setNewOdpCapacity] = useState('8');
  const [newOdpShelter, setNewOdpShelter] = useState('');
  const [newOdpPon, setNewOdpPon] = useState('');
  const [newOdpOtb, setNewOdpOtb] = useState('');
  const [editingOdpId, setEditingOdpId] = useState<number | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [selectedOdpId, setSelectedOdpId] = useState('');
  const [odpSearch, setOdpSearch] = useState('');
  const [isOdpInputFocused, setIsOdpInputFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    fetchData();

    const handleDataUpdated = () => {
      fetchData();
    };

    window.addEventListener('dataUpdated', handleDataUpdated);
    return () => {
      window.removeEventListener('dataUpdated', handleDataUpdated);
    };
  }, [user]);

  const fetchData = async () => {
    const odpRes = await fetch('/api/odps', { credentials: 'same-origin' });
    if (odpRes.ok) setOdps(await odpRes.json());

    if (user?.role === 'superadmin' || user?.role === 'vip' || user?.role === 'teknisi') {
      const custRes = await fetch('/api/customers', { credentials: 'same-origin' });
      if (custRes.ok) setCustomers(await custRes.json());
    }

    const setRes = await fetch('/api/settings', { credentials: 'same-origin' });
    if (setRes.ok) setSettings(await setRes.json());
  };

  // Auto-center map to ODP cluster on initial load
  useEffect(() => {
    if (mapReady && mapRef.current && odps.length > 0 && !hasCenteredRef.current) {
      const avgLat = odps.reduce((sum, o) => sum + o.lat, 0) / odps.length;
      const avgLng = odps.reduce((sum, o) => sum + o.lng, 0) / odps.length;
      mapRef.current.setView([avgLat, avgLng], 14);
      hasCenteredRef.current = true;
    }
  }, [mapReady, odps]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        try { mapRef.current?.invalidateSize(); } catch (e) { /* ignore */ }
      }, 150);
    }
  }, [isFullscreen]);

  const focusOnLocation = (lat: number, lng: number, zoom?: number) => {
    pendingFocusRef.current = { lat, lng, zoom };
    setProspectiveLoc({ lat, lng });

    if (mapRef.current) {
      const map = mapRef.current;
      const targetZoom = typeof zoom === 'number' ? zoom : map.getMaxZoom();
      const safeZoom = Math.min(Math.max(targetZoom, map.getMinZoom()), map.getMaxZoom());
      const center: [number, number] = [lat, lng];

      map.invalidateSize();
      map.setView(center, safeZoom, { animate: false });
      window.requestAnimationFrame(() => {
        map.setView(center, safeZoom, { animate: false });
        map.panTo(center);
      });
      window.setTimeout(() => {
        map.setView(center, safeZoom, { animate: false });
        map.panTo(center);
        map.flyTo(center, safeZoom, { duration: 0.8, animate: true });
      }, 120);
    }
  };

  useEffect(() => {
    if (!mapReady || !prospectiveLoc) return;

    const target = pendingFocusRef.current ?? { lat: prospectiveLoc.lat, lng: prospectiveLoc.lng };

    const applyFocus = (map: L.Map) => {
      const requestedZoom = typeof target.zoom === 'number' ? target.zoom : map.getMaxZoom();
      const safeZoom = Math.min(Math.max(requestedZoom, map.getMinZoom()), map.getMaxZoom());
      const center: [number, number] = [target.lat, target.lng];

      map.invalidateSize();
      map.setView(center, safeZoom, { animate: false });
      map.panTo(center);

      window.requestAnimationFrame(() => {
        map.setView(center, safeZoom, { animate: false });
        map.panTo(center);
      });

      window.setTimeout(() => {
        map.setView(center, safeZoom, { animate: false });
        map.panTo(center);
        map.flyTo(center, safeZoom, { duration: 0.8, animate: true });
      }, 180);
    };

    applyFocus(mapRef.current!);
    pendingFocusRef.current = null;
  }, [mapReady, prospectiveLoc]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const desiredZoom = mapRef.current ? Math.min(mapRef.current.getMaxZoom(), 17) : 17;
        focusOnLocation(position.coords.latitude, position.coords.longitude, desiredZoom);
      },
      (error) => {
        alert('Geolocation error: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        return data;
      }
    } catch {
      return null;
    }

    return null;
  };

  const isValidCoordinate = (location: { lat: number; lng: number } | null) => {
    return Boolean(
      location &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng) &&
      location.lat >= -90 &&
      location.lat <= 90 &&
      location.lng >= -180 &&
      location.lng <= 180
    );
  };

  const handleInputCoords = async () => {
    const parsed = await parseCoordinateInput(inputCoords);
    if (parsed) {
      const desiredZoom = mapRef.current ? Math.min(mapRef.current.getMaxZoom(), 17) : 17;
      focusOnLocation(parsed.lat, parsed.lng, desiredZoom);
    } else {
      alert("Format tidak valid. Coba 'lat, lng' atau kirim link Google Maps/share location.");
    }
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getRouteToOdp = async (from: {lat: number, lng: number}, to: {lat: number, lng: number}) => {
    const fallbackPath: [number, number][] = [[from.lat, from.lng], [to.lat, to.lng]];

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(osrmUrl);
      if (!res.ok) throw new Error('OSRM request failed');
      const data = await res.json();
      if (!data?.routes?.length) throw new Error('OSRM returned no route');

      const route = data.routes[0];
      const coords = (route.geometry?.coordinates ?? []).map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
      if (coords.length < 2) throw new Error('Invalid route geometry');

      return { distance: route.distance as number, path: coords };
    } catch {
      return { distance: getDistance(from.lat, from.lng, to.lat, to.lng), path: fallbackPath };
    }
  };

  useEffect(() => {
    let active = true;

    if (!prospectiveLoc || odps.length === 0) {
      setNearestOdp(null);
      setRoutePath([]);
      setRouteDistance(null);
      setRouteError('');
      setRouteLoading(false);
      return;
    }

    const updateRoute = async () => {
      setRouteLoading(true);
      setRouteError('');

      const candidates = [...odps]
        .sort((a, b) => {
          const da = getDistance(prospectiveLoc.lat, prospectiveLoc.lng, a.lat, a.lng);
          const db = getDistance(prospectiveLoc.lat, prospectiveLoc.lng, b.lat, b.lng);
          return da - db;
        })
        .slice(0, 5);

      let inRangeRoutes: Array<{ odp: ODP; distance: number; path: [number, number][] }> = [];
      let bestOdp: ODP | null = null;
      let bestDistance = Infinity;
      let bestPath: [number, number][] = [];
      let recommended: ODP | null = null;
      let recommendedDistance = null as number | null;
      let recommendedPath: [number, number][] = [];

      for (const odp of candidates) {
        const result = await getRouteToOdp(prospectiveLoc, { lat: odp.lat, lng: odp.lng });
        if (!active) return;

        if (result.distance < bestDistance) {
          bestOdp = odp;
          bestDistance = result.distance;
          bestPath = result.path;
        }

        if (result.distance <= settings.coverageDistance) {
          inRangeRoutes.push({ odp, distance: result.distance, path: result.path });
        }
      }

      inRangeRoutes.sort((a, b) => a.distance - b.distance);
      if (inRangeRoutes.length > 1) {
        recommended = inRangeRoutes[1].odp;
        recommendedDistance = inRangeRoutes[1].distance;
        recommendedPath = inRangeRoutes[1].path;
      }

      if (active) {
        setNearestOdp(bestOdp);
        setRouteDistance(Number.isFinite(bestDistance) ? bestDistance : null);
        setRoutePath(bestPath);
        setRecommendedOdp(recommended);
        setRecommendedRouteDistance(recommendedDistance);
        setRecommendedRoutePath(recommendedPath);
        if (!bestOdp) {
          setRouteError('Tidak dapat menemukan rute ke ODP terdekat');
        }
      }

      setRouteLoading(false);
    };

    void updateRoute();

    return () => {
      active = false;
    };
  }, [prospectiveLoc, odps]);

  const AddMarkerOnClick = () => {
    useMapEvents({
      click(e) {
        if (addingMode === 'odp' || addingMode === 'customer') {
          const nextLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
          
          // Record history if editing ODP
          if (editingOdpId && prospectiveLoc) {
            setOdpEditHistory(prev => [...prev, { lat: prospectiveLoc.lat, lng: prospectiveLoc.lng }]);
          }

          setProspectiveLoc(nextLocation);
          setInputCoords(`${nextLocation.lat.toFixed(5)}, ${nextLocation.lng.toFixed(5)}`);
        }
      },
    });
    return null;
  };

  const undoOdpPosition = () => {
    if (odpEditHistory.length === 0) return;
    
    const prevPosition = odpEditHistory[odpEditHistory.length - 1];
    setOdpEditHistory(prev => prev.slice(0, -1));
    setProspectiveLoc(prevPosition);
    setInputCoords(`${prevPosition.lat.toFixed(5)}, ${prevPosition.lng.toFixed(5)}`);
  };

  const resetOdpEditor = () => {
    setAddingMode(null);
    setEditingOdpId(null);
    setProspectiveLoc(null);
    setInputCoords('');
    setNewOdpName('');
    setNewOdpShelter('');
    setNewOdpPon('');
    setNewOdpOtb('');
    setNewOdpCapacity('8');
    setOdpEditHistory([]);
  };

  const saveOdp = async () => {
    if (!newOdpName.trim()) {
      alert('Nama ODP wajib diisi');
      return;
    }

    const parsedLocation = await parseCoordinateInput(inputCoords);
    if (!isValidCoordinate(parsedLocation)) {
      alert('Koordinat tidak valid. Gunakan format latitude, longitude dengan latitude -90 sampai 90 dan longitude -180 sampai 180.');
      return;
    }

    setProspectiveLoc(parsedLocation);

    const payload = {
      name: newOdpName.trim(),
      lat: parsedLocation.lat,
      lng: parsedLocation.lng,
      capacity: parseInt(newOdpCapacity, 10) || 8,
      shelter: newOdpShelter.trim(),
      pon: newOdpPon.trim(),
      otb: newOdpOtb.trim()
    };

    const url = editingOdpId ? `/api/odps/${editingOdpId}` : '/api/odps';
     // use POST for edits in dev to avoid PUT handling issues
     const method = 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    // try to read JSON, fall back to text
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (res.ok) {
      resetOdpEditor();
      fetchData();
    } else {
      const text = data?.error || (await res.text().catch(() => '')) || (editingOdpId ? 'Gagal memperbarui ODP' : 'Gagal menambahkan ODP');
      alert(text);
    }
  };

  const startEditOdp = (odp: ODP) => {
    setEditingOdpId(odp.id);
    setAddingMode('odp');
    setProspectiveLoc({ lat: odp.lat, lng: odp.lng });
    setInputCoords(`${odp.lat.toFixed(5)}, ${odp.lng.toFixed(5)}`);
    setNewOdpName(odp.name);
    setNewOdpCapacity(String(odp.capacity));
    setNewOdpShelter(odp.shelter ?? '');
    setNewOdpPon(odp.pon ?? '');
    setNewOdpOtb(odp.otb ?? '');
    setOdpEditHistory([]);
  };

  const saveCustomer = async () => {
    if (!selectedOdpId) {
      alert('Pilih ODP tujuan terlebih dahulu');
      return;
    }
    if (!newCustomerName.trim()) {
      alert('Nama pelanggan wajib diisi');
      return;
    }

    const parsedLocation = await parseCoordinateInput(inputCoords);
    if (!isValidCoordinate(parsedLocation)) {
      alert('Koordinat tidak valid. Gunakan format latitude, longitude dengan latitude -90 sampai 90 dan longitude -180 sampai 180.');
      return;
    }

    setProspectiveLoc(parsedLocation);

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        address: newCustomerAddress.trim(),
        lat: parsedLocation.lat,
        lng: parsedLocation.lng,
        odpId: parseInt(selectedOdpId, 10)
      })
    });

    if (res.ok) {
      setAddingMode(null);
      setProspectiveLoc(null);
      setInputCoords('');
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerAddress('');
      setSelectedOdpId('');
      fetchData();
    } else {
      const errorText = await res.text();
      alert(errorText || 'Gagal menambahkan pelanggan');
    }
  };

  const deleteOdp = async (id: number) => {
    if (!confirm('Are you sure you want to delete this ODP?')) return;
    const res = await fetch(`/api/odps/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) {
      fetchData();
    } else {
      const text = await res.text().catch(() => 'Gagal menghapus ODP');
      alert(text || 'Gagal menghapus ODP');
    }
  };

  const routeInRange = routeDistance !== null && routeDistance <= settings.coverageDistance;
  const isNearestOdpFull = nearestOdp ? (nearestOdp.connectedCustomers || 0) >= nearestOdp.capacity : false;
  const hasMultipleOdpInRange = routeDistance !== null && recommendedRouteDistance !== null && recommendedRouteDistance <= settings.coverageDistance;

  const filteredOdps = odps.filter((odp) => {
    const search = odpSearch.trim().toLowerCase();
    if (!search) return true;
    return (
      odp.name.toLowerCase().includes(search) ||
      String(odp.id).includes(search)
    );
  });

  const showOdpSuggestions = isOdpInputFocused && (odpSearch.trim().length > 0 || odps.length > 0);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearchQuery
    ? odps
        .map((odp) => {
          const connectedCustomerList = customers.filter((c) => c.odpId === odp.id);
          const details = [
            odp.name,
            String(odp.id),
            odp.shelter ?? '',
            odp.pon ?? '',
            odp.otb ?? '',
            String(odp.capacity),
            String(odp.connectedCustomers ?? connectedCustomerList.length),
            connectedCustomerList.map((c) => `${c.name} ${c.phone ?? ''} ${c.address ?? ''}`).join(' ')
          ].join(' ').toLowerCase();
          const isFull = (odp.connectedCustomers || 0) >= odp.capacity;
          return {
            ...odp,
            connectedCustomerList,
            connectedCustomerCount: odp.connectedCustomers ?? connectedCustomerList.length,
            isFull,
            matches: details.includes(normalizedSearchQuery)
          };
        })
        .filter((odp) => odp.matches)
        .sort((a, b) => {
          if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
          return a.name.localeCompare(b.name);
        })
    : [];

  const showSearchResults = searchFocused && normalizedSearchQuery.length > 0 && searchResults.length > 0;

  const coverageStatus = prospectiveLoc
    ? nearestOdp
      ? routeInRange
        ? isNearestOdpFull ? 'ODP penuh' : 'Terjangkau'
        : 'Tidak terjangkau'
      : 'Tidak terjangkau'
    : null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
      {/* Top Panel (Compact and Collapsible on Mobile) */}
      <div className="p-2 sm:p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 z-10 shadow-sm relative">
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          
          {/* Row 1 (Always Visible): Search bar and toggle button for mobile */}
          {!isTeknisi && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                  placeholder="cari ODP"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-100"
                />
                {searchFocused && normalizedSearchQuery.length > 0 && (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    {searchResults.length > 0 ? (
                      searchResults.slice(0, 6).map((odp) => (
                        <button
                          key={odp.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            focusOnLocation(odp.lat, odp.lng, 17);
                            setSearchQuery(odp.name);
                            setSearchFocused(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">{odp.name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">ID {odp.id} • Kapasitas {odp.capacity}</div>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${odp.isFull ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'}`}>
                              {odp.isFull ? 'Penuh' : 'Tersedia'}
                            </span>
                          </div>
                          {(odp as any).connectedCustomerCount !== undefined && (
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Terhubung {(odp as any).connectedCustomerCount} pelanggan</div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                        Tidak ditemukan ODP sesuai kata kunci.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Mobile Expand Toggle Button */}
              <button
                onClick={() => setIsMobileExpanded(!isMobileExpanded)}
                className="lg:hidden p-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center transition"
                title="Toggle Controls"
              >
                {isMobileExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Row 2: Coordinates Input & Action Buttons (Collapsible) */}
          <div className={`${isTeknisi || isMobileExpanded ? 'flex' : 'hidden lg:flex'} flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 lg:flex-initial w-full lg:w-auto mt-2 lg:mt-0`}>
            
            {/* Coordinate Checker */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                placeholder="-6.2088, 106.8456 atau link Google Maps"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none dark:bg-gray-700 dark:border-gray-600"
                value={inputCoords}
                onChange={e => setInputCoords(e.target.value)}
              />
              <button onClick={() => void handleInputCoords()} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 flex-shrink-0">
                <div className="inline-flex items-center gap-1.5 justify-center">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Check Coord</span>
                  <span className="sm:hidden">Check</span>
                </div>
              </button>
            </div>

            {/* Actions Buttons */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <button onClick={handleLocateMe} className="rounded-xl bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 flex-1 sm:flex-initial">
                <div className="inline-flex items-center gap-1.5 justify-center">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>My Location</span>
                </div>
              </button>
              {(user?.role === 'superadmin' || user?.role === 'vip') && (
                <>
                  <button
                    onClick={() => {
                      const defaultLocation = { lat: -6.2088, lng: 106.8456 };
                      setAddingMode('odp');
                      setProspectiveLoc(defaultLocation);
                      setInputCoords(`${defaultLocation.lat.toFixed(5)}, ${defaultLocation.lng.toFixed(5)}`);
                      setSelectedOdpId('');
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition flex-1 sm:flex-initial ${addingMode === 'odp' ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-indigo-200 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:border-indigo-700 dark:bg-indigo-900 dark:text-indigo-200'}`}
                  >
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add ODP</span>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      const defaultLocation = { lat: -6.2088, lng: 106.8456 };
                      setAddingMode('customer');
                      setProspectiveLoc(defaultLocation);
                      setInputCoords(`${defaultLocation.lat.toFixed(5)}, ${defaultLocation.lng.toFixed(5)}`);
                      setSelectedOdpId('');
                    }}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition flex-1 sm:flex-initial ${addingMode === 'customer' ? 'border-teal-700 bg-teal-700 text-white' : 'border-teal-200 bg-teal-100 text-teal-700 hover:bg-teal-200 dark:border-teal-700 dark:bg-teal-900 dark:text-teal-200'}`}
                  >
                    <div className="inline-flex items-center gap-1.5 justify-center">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Customer</span>
                    </div>
                  </button>
                </>
              )}
            </div>
            
          </div>
          
        </div>
      </div>

          {/* Map Wrapper (Handles Fullscreen styling) */}
      <div className={isFullscreen ? "fixed inset-0 z-[9999] w-screen h-screen flex flex-col bg-white dark:bg-gray-900" : "flex-1 relative z-0 flex flex-col w-full h-full"}>
        
        <div className="flex-1 relative h-full w-full">
          {/* Map Container */}
          <MapContainer
            center={[-6.2088, 106.8456]}
            zoom={15}
            className="w-full h-full"
            ref={(m: any) => {
              if (m) {
                mapRef.current = m as L.Map;
                setMapReady(true);
                try { mapRef.current.invalidateSize(); } catch (e) { /* ignore */ }
              }
            }}
          >
            {mapLayer === 'streets' ? (
              <TileLayer
                key="streets"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
            ) : (
              <>
                <TileLayer
                  key="satellite"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                  maxZoom={19}
                />
                <TileLayer
                  key="satellite-labels"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  attribution=""
                  maxZoom={19}
                />
              </>
            )}
            <AddMarkerOnClick />

            {routePath.length > 1 && (
              <Polyline
                positions={routePath}
                pathOptions={{
                  color: routeInRange ? 'green' : 'red',
                  weight: 4,
                  dashArray: routeInRange ? undefined : '8, 6'
                }}
              />
            )}
            {recommendedOdp && recommendedRoutePath.length > 1 && (
              <Polyline
                positions={recommendedRoutePath}
                pathOptions={{
                  color: 'yellow',
                  weight: 4,
                  opacity: 0.7,
                  dashArray: '4, 8'
                }}
              />
            )}

            {!isTeknisi && odps.map(odp => {
              const connectedCustomerList = customers.filter((c) => c.odpId === odp.id);
              return (
                <React.Fragment key={`odp-${odp.id}`}>
                  <Marker position={[odp.lat, odp.lng]}>
                    <Popup>
                      <div className="text-sm">
                        <strong>{odp.name}</strong><br/>
                        Kapasitas: {odp.capacity}<br/>
                        Terhubung: {odp.connectedCustomers || connectedCustomerList.length}<br/>
                        {connectedCustomerList.length > 0 && (
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                            <div className="font-semibold uppercase tracking-[0.12em]">Pelanggan</div>
                            {connectedCustomerList.slice(0, 5).map((c) => (
                              <div key={c.id} className="truncate">{c.name}{c.phone ? ` • ${c.phone}` : ''}</div>
                            ))}
                            {connectedCustomerList.length > 5 && (
                              <div>+{connectedCustomerList.length - 5} lainnya</div>
                            )}
                          </div>
                        )}
                        {(user?.role === 'superadmin' || user?.role === 'vip') && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button onClick={() => startEditOdp(odp)} className="text-blue-600 mt-2 text-xs flex items-center hover:text-blue-800">
                              <Edit3 className="w-3 h-3 mr-1" /> Edit ODP
                            </button>
                            <button onClick={() => deleteOdp(odp.id)} className="text-red-500 mt-2 text-xs flex items-center hover:text-red-700">
                              <Trash2 className="w-3 h-3 mr-1"/> Hapus ODP
                            </button>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

            {isTeknisi && nearestOdp && prospectiveLoc && (
              <Marker position={[nearestOdp.lat, nearestOdp.lng]}>
                <Popup>
                  <div className="text-sm">
                    <strong>{nearestOdp.name}</strong><br/>
                    Kapasitas: {nearestOdp.capacity}<br/>
                    Terhubung: {nearestOdp.connectedCustomers ?? 0}<br/>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Status: {(nearestOdp.connectedCustomers ?? 0) >= nearestOdp.capacity ? 'ODP penuh' : 'Tersedia'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
            {isTeknisi && recommendedOdp && recommendedRoutePath.length > 1 && (
              <Marker position={[recommendedOdp.lat, recommendedOdp.lng]}>
                <Popup>
                  <div className="text-sm">
                    <strong>{recommendedOdp.name}</strong><br/>
                    Kapasitas: {recommendedOdp.capacity}<br/>
                    Terhubung: {recommendedOdp.connectedCustomers ?? 0}<br/>
                    <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                      Rekomendasi dalam jangkauan
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {prospectiveLoc && (
              <Marker 
                position={[prospectiveLoc.lat, prospectiveLoc.lng]} 
                icon={redIcon}
                draggable={addingMode === 'odp'}
                eventHandlers={{
                  dragstart: () => {
                    // Record position before drag starts
                    if (addingMode === 'odp') {
                      setOdpEditHistory(prev => [...prev, { lat: prospectiveLoc.lat, lng: prospectiveLoc.lng }]);
                    }
                  },
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    setProspectiveLoc({ lat: position.lat, lng: position.lng });
                    setInputCoords(`${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`);
                  },
                }}
              >
                <Popup>
                  {addingMode === null ? (
                    <div className="text-sm">
                      <strong>Prospective Location</strong><br/>
                      <span className={coverageStatus === 'Terjangkau' ? 'text-green-600' : coverageStatus === 'ODP penuh' ? 'text-amber-600' : 'text-red-500'}>
                        {coverageStatus}
                      </span>
                      {routeLoading && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Memuat rute...</div>
                      )}
                      {!routeLoading && nearestOdp && routeDistance !== null && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Rute ke {nearestOdp.name}: {Math.round(routeDistance)} m
                        </div>
                      )}
                      {!routeLoading && routeError && (
                        <div className="text-xs text-red-500 mt-1">{routeError}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm">
                      Selected Location for new {addingMode}
                    </div>
                  )}
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Repeating Watermark Overlay (Above map tiles & canvas, below UI buttons) */}
          <div
            className="absolute inset-0 z-[500] pointer-events-none select-none"
            style={{
              backgroundImage: buildWatermarkUrl(user?.name || user?.username || 'guest', mapLayer === 'satellite'),
              backgroundRepeat: 'repeat'
            }}
          />

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-[1000] p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Map Layer Toggle Button (Streets / Satellite) */}
          <button
            type="button"
            onClick={() => setMapLayer(mapLayer === 'streets' ? 'satellite' : 'streets')}
            className={`absolute top-16 right-4 z-[1000] p-2 border rounded-xl shadow-lg transition ${
              mapLayer === 'satellite'
                ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title={mapLayer === 'streets' ? "Switch to Satellite view" : "Switch to Streets view"}
          >
            <div className="inline-flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span className="text-[10px] font-semibold">{mapLayer === 'streets' ? 'Satelit' : 'Jalan'}</span>
            </div>
          </button>

          {/* Floating Action Form for Adding */}
          {(addingMode && prospectiveLoc) && (
            <div className="absolute top-4 right-14 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border dark:border-gray-700 z-[1000] w-72 max-h-[75vh] overflow-y-auto">
              <h3 className="font-bold text-base mb-3">New {addingMode === 'odp' ? 'ODP' : 'Customer'}</h3>
              <p className="text-xs text-gray-500 mb-3">Lat: {prospectiveLoc.lat.toFixed(5)}, Lng: {prospectiveLoc.lng.toFixed(5)}</p>
              
              {addingMode === 'odp' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium">Koordinat</label>
                    <input type="text" value={inputCoords} onChange={e => setInputCoords(e.target.value)} placeholder="Latitude, longitude" className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium">Name</label>
                    <input type="text" value={newOdpName} onChange={e => setNewOdpName(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium">Shelter</label>
                      <input type="text" value={newOdpShelter} onChange={e => setNewOdpShelter(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium">(OLT/Card)-PON</label>
                      <input type="text" value={newOdpPon} onChange={e => setNewOdpPon(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium">No OTB</label>
                      <input type="text" value={newOdpOtb} onChange={e => setNewOdpOtb(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium">Kapasitas</label>
                    <input type="number" value={newOdpCapacity} onChange={e => setNewOdpCapacity(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    {addingMode === 'odp' && (
                      <button 
                        onClick={undoOdpPosition}
                        disabled={odpEditHistory.length === 0}
                        className={`px-3 py-1 text-xs rounded ${odpEditHistory.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-amber-600 hover:bg-amber-50'}`}
                      >
                        Undo
                      </button>
                    )}
                    <button onClick={() => setAddingMode(null)} className="px-3 py-1 text-xs text-gray-600">Cancel</button>
                    <button onClick={saveOdp} className="px-3 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium">Koordinat</label>
                    <input type="text" value={inputCoords} onChange={e => setInputCoords(e.target.value)} placeholder="Latitude, longitude" className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium">Customer Name</label>
                    <input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium">Phone</label>
                    <input type="text" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium">Address</label>
                    <textarea value={newCustomerAddress} onChange={e => setNewCustomerAddress(e.target.value)} className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600" rows={2}></textarea>
                  </div>
                  <div>
                    <label className="block text-xs font-medium">Connect to ODP</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={odpSearch}
                        onChange={(e) => setOdpSearch(e.target.value)}
                        onFocus={() => setIsOdpInputFocused(true)}
                        onBlur={() => window.setTimeout(() => setIsOdpInputFocused(false), 120)}
                        placeholder="Ketik nama ODP..."
                        className="w-full border rounded px-2 py-1 text-xs dark:bg-gray-700 dark:border-gray-600"
                      />
                      {showOdpSuggestions && (
                        <div className="absolute z-10 w-full mt-1 max-h-40 overflow-y-auto border rounded bg-white shadow-lg dark:bg-gray-700 dark:border-gray-600">
                          {filteredOdps.map((o) => {
                            const dist = getDistance(prospectiveLoc.lat, prospectiveLoc.lng, o.lat, o.lng);
                            const isFull = (o.connectedCustomers || 0) >= o.capacity;
                            return (
                              <div
                                key={o.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (!isFull) {
                                    setSelectedOdpId(String(o.id));
                                    setOdpSearch(o.name);
                                    setIsOdpInputFocused(false);
                                  }
                                }}
                                className={`px-2 py-1.5 text-xs border-b last:border-b-0 dark:border-gray-600 ${isFull ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                              >
                                <div className="font-medium">{o.name}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                  {dist.toFixed(0)}m {isFull ? '• FULL' : ''}
                                </div>
                              </div>
                            );
                          })}
                          {filteredOdps.length === 0 && (
                            <div className="px-2 py-2 text-xs text-gray-500">Tidak ada ODP yang cocok</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setAddingMode(null)} className="px-3 py-1 text-xs text-gray-600">Cancel</button>
                    <button onClick={saveCustomer} className="px-3 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Floating card for prospective location info (Google Maps style) */}
          {prospectiveLoc && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 p-3.5 rounded-2xl shadow-2xl border border-gray-150 dark:border-gray-700 z-[1000] space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${coverageStatus === 'Terjangkau' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' : coverageStatus === 'ODP penuh' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200'}`}>
                  {coverageStatus || 'Menunggu lokasi'}
                </span>
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                  {prospectiveLoc.lat.toFixed(5)}, {prospectiveLoc.lng.toFixed(5)}
                </span>
              </div>
              <div className="text-xs text-gray-750 dark:text-gray-200 leading-relaxed">
                {routeLoading && 'Memuat jalur ke ODP terdekat...'}
                {!routeLoading && nearestOdp && routeDistance !== null && (
                  <div>Rute ke <strong>{nearestOdp.name}</strong>: {Math.round(routeDistance)} m</div>
                )}
                {!routeLoading && recommendedOdp && recommendedRouteDistance !== null && (
                  <div className="text-amber-600 dark:text-amber-400 mt-1 text-[10px]">
                    Rekomendasi tambahan: <strong>{recommendedOdp.name}</strong> ({Math.round(recommendedRouteDistance)} m)
                  </div>
                )}
                {!routeLoading && !nearestOdp && (
                  <div className="text-gray-500">Tidak ada ODP tersedia untuk dijadikan rute.</div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
