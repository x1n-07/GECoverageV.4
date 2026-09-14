import 'dotenv/config';
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET tidak diatur. Tambahkan JWT_SECRET=<string acak kuat> pada file .env sebelum menjalankan aplikasi.");
  process.exit(1);
}

// Storage setup
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const usersFile = path.join(DATA_DIR, 'users.json');
const odpsFile = path.join(DATA_DIR, 'odps.json');
const customersFile = path.join(DATA_DIR, 'customers.json');
const settingsFile = path.join(process.cwd(), 'settings.json');

// Helper to save data safely
const saveData = (file: string, data: any) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Failed to save data to ${file}`, e);
  }
};

// Initial mock data fallback
const defaultUsers = [
  { id: 1, name: "Admin Utama", username: "admin", password: bcrypt.hashSync("admin", 10), plainPassword: "admin", role: "admin", contact: "0812-1111-1111" },
  { id: 2, name: "Super Admin", username: "superadmin", password: bcrypt.hashSync("superadmin", 10), plainPassword: "superadmin", role: "superadmin", contact: "0812-2222-2222" },
  { id: 3, name: "VIP User", username: "vip", password: bcrypt.hashSync("vip", 10), plainPassword: "vip", role: "vip", contact: "0812-3333-3333" },
  { id: 4, name: "Teknisi", username: "teknisi", password: bcrypt.hashSync("teknisi", 10), plainPassword: "teknisi", role: "teknisi", contact: "0812-4444-4444" }
];

type OdpRecord = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  shelter?: string;
  pon?: string;
  otb?: string;
};

const defaultOdps: OdpRecord[] = [
  { id: 1, name: "ODP-A01", lat: -6.2088, lng: 106.8456, capacity: 8 },
  { id: 2, name: "ODP-A02", lat: -6.2090, lng: 106.8460, capacity: 16 }
];

const defaultCustomers = [
  { id: 1, name: "Budi", lat: -6.2089, lng: 106.8457, odpId: 1 },
  { id: 2, name: "Ani", lat: -6.2091, lng: 106.8462, odpId: 2 }
];

// Load persisted data
let users = defaultUsers;
if (fs.existsSync(usersFile)) {
  try { users = JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch (e) { console.error('Failed to load users', e); }
} else {
  saveData(usersFile, users);
}

let odps: OdpRecord[] = defaultOdps;
if (fs.existsSync(odpsFile)) {
  try { odps = JSON.parse(fs.readFileSync(odpsFile, 'utf8')); } catch (e) { console.error('Failed to load ODPs', e); }
} else {
  saveData(odpsFile, odps);
}

let customers: any[] = defaultCustomers;
if (fs.existsSync(customersFile)) {
  try { customers = JSON.parse(fs.readFileSync(customersFile, 'utf8')); } catch (e) { console.error('Failed to load customers', e); }
} else {
  saveData(customersFile, customers);
}

let settings: { coverageDistance: number; logo?: string } = {
  coverageDistance: 50 // meters
};

// Load persisted settings if available
try {
  if (fs.existsSync(settingsFile)) {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    const parsed = JSON.parse(raw);
    settings = { ...settings, ...parsed };
  }
} catch (e) {
  console.warn('Failed to load settings.json, using defaults');
}

const app = express();
const PORT = 3006;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(helmet({
  contentSecurityPolicy: false, // Vite and React Router sometimes require broader CSP or custom tuning, better disable default to avoid breaking UI 
  crossOriginEmbedderPolicy: false // Prevent breaking leaflet tile loading
}));

// Middleware for checking auth
const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const roleMiddleware = (roles: string[]) => (req: any, res: any, next: any) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

// API: Auth
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  
  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: user.id, username: user.username, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }).json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }).json({ success: true });
});

app.get("/api/me", authMiddleware, (req, res) => {
  res.json({ user: (req as any).user });
});

// API: ODPs (admin, superadmin, vip)
const isValidCoordinate = (lat: unknown, lng: unknown) => (
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180
);

app.get("/api/odps", authMiddleware, (req, res) => {
  res.json(odps.map(odp => {
    const connectedCustomers = customers.filter(c => c.odpId === odp.id).length;
    return { ...odp, connectedCustomers };
  }));
});

app.post("/api/odps", authMiddleware, roleMiddleware(["superadmin", "vip"]), (req, res) => {
  const { name, lat, lng, capacity, shelter, pon, otb } = req.body;
  if (!isValidCoordinate(lat, lng)) {
    return res.status(400).json({ error: "Latitude dan longitude tidak valid." });
  }
  const newOdp = { id: Date.now(), name, lat, lng, capacity, shelter, pon, otb };
  odps.push(newOdp);
  saveData(odpsFile, odps);
  res.json(newOdp);
});

// Support POST-based update (some dev setups may not forward PUT correctly)
app.post("/api/odps/:id", authMiddleware, roleMiddleware(["superadmin", "vip"]), (req, res) => {
  const id = parseInt(req.params.id);
  const odp = odps.find(o => o.id === id);
  if (!odp) return res.status(404).json({ error: "ODP not found" });

  const { name, lat, lng, capacity, shelter, pon, otb } = req.body;
  if ((lat !== undefined || lng !== undefined) && !isValidCoordinate(lat, lng)) {
    return res.status(400).json({ error: "Latitude dan longitude tidak valid." });
  }
  if (typeof name === 'string') odp.name = name;
  if (typeof lat === 'number') odp.lat = lat;
  if (typeof lng === 'number') odp.lng = lng;
  if (typeof capacity === 'number') odp.capacity = capacity;
  if (typeof shelter === 'string') odp.shelter = shelter;
  if (typeof pon === 'string') odp.pon = pon;
  if (typeof otb === 'string') odp.otb = otb;

  saveData(odpsFile, odps);
  res.json(odp);
});

// Alternative update endpoint that accepts id in body
app.post('/api/update-odp', authMiddleware, roleMiddleware(['superadmin', 'vip']), (req, res) => {
  const { id, name, lat, lng, capacity, shelter, pon, otb } = req.body ?? {};
  const parsedId = parseInt(id);
  if (!parsedId) return res.status(400).json({ error: 'Invalid id' });
  const odp = odps.find(o => o.id === parsedId);
  if (!odp) return res.status(404).json({ error: 'ODP not found' });

  if ((lat !== undefined || lng !== undefined) && !isValidCoordinate(lat, lng)) {
    return res.status(400).json({ error: 'Latitude dan longitude tidak valid.' });
  }
  if (typeof name === 'string') odp.name = name;
  if (typeof lat === 'number') odp.lat = lat;
  if (typeof lng === 'number') odp.lng = lng;
  if (typeof capacity === 'number') odp.capacity = capacity;
  if (typeof shelter === 'string') odp.shelter = shelter;
  if (typeof pon === 'string') odp.pon = pon;
  if (typeof otb === 'string') odp.otb = otb;

  saveData(odpsFile, odps);
  res.json(odp);
});

app.put("/api/odps/:id", authMiddleware, roleMiddleware(["superadmin", "vip"]), (req, res) => {
  const id = parseInt(req.params.id);
  const odp = odps.find(o => o.id === id);
  if (!odp) return res.status(404).json({ error: "ODP not found" });

  const { name, lat, lng, capacity, shelter, pon, otb } = req.body;
  if ((lat !== undefined || lng !== undefined) && !isValidCoordinate(lat, lng)) {
    return res.status(400).json({ error: "Latitude dan longitude tidak valid." });
  }
  if (typeof name === 'string') odp.name = name;
  if (typeof lat === 'number') odp.lat = lat;
  if (typeof lng === 'number') odp.lng = lng;
  if (typeof capacity === 'number') odp.capacity = capacity;
  if (typeof shelter === 'string') odp.shelter = shelter;
  if (typeof pon === 'string') odp.pon = pon;
  if (typeof otb === 'string') odp.otb = otb;

  saveData(odpsFile, odps);
  res.json(odp);
});

app.post("/api/check-coverage", (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Latitude dan longitude wajib berupa angka.' });
  }

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const coverageDistance = settings.coverageDistance ?? 50;
  let anyInRange = false;
  let anyFull = false;

  for (const odp of odps) {
    const distance = getDistance(lat, lng, odp.lat, odp.lng);
    const inRange = distance <= coverageDistance;
    const isFull = (customers.filter(c => c.odpId === odp.id).length) >= odp.capacity;

    if (inRange) {
      anyInRange = true;
      if (isFull) {
        anyFull = true;
        break;
      }
    }
  }

  if (anyFull) {
    return res.json({ status: 'ODP penuh' });
  }
  if (anyInRange) {
    return res.json({ status: 'Terjangkau' });
  }
  return res.json({ status: 'Tidak terjangkau' });
});

app.delete("/api/odps/:id", authMiddleware, roleMiddleware(["superadmin", "vip"]), (req, res) => {
  const id = parseInt(req.params.id);
  odps = odps.filter(o => o.id !== id);
  customers = customers.filter(c => c.odpId !== id);
  saveData(odpsFile, odps);
  saveData(customersFile, customers);
  res.json({ success: true });
});

// API: Customers (admin: read basic? superadmin/vip: read detailed, add, delete)
app.get("/api/customers", authMiddleware, roleMiddleware(["superadmin", "vip", "teknisi"]), (req, res) => {
  res.json(customers);
});

app.post("/api/customers", authMiddleware, roleMiddleware(["superadmin", "vip"]), (req, res) => {
  const { name, phone, address, lat, lng, odpId } = req.body;
  const newCustomer = { id: Date.now(), name, phone, address, lat, lng, odpId: parseInt(odpId) };
  customers.push(newCustomer);
  saveData(customersFile, customers);
  res.json(newCustomer);
});

app.delete("/api/customers/:id", authMiddleware, roleMiddleware(["superadmin", "vip"]), (req, res) => {
  const id = parseInt(req.params.id);
  customers = customers.filter(c => c.id !== id);
  saveData(customersFile, customers);
  res.json({ success: true });
});

// API: Users (vip)
app.get("/api/users", authMiddleware, roleMiddleware(["vip"]), (req, res) => {
  res.json(users.map(u => ({ id: u.id, name: u.name, username: u.username, password: (u as any).plainPassword || "••••••", role: u.role, contact: u.contact ?? "" })));
});

app.post("/api/users", authMiddleware, roleMiddleware(["vip"]), (req, res) => {
  const { name, username, password, role, contact } = req.body;
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already exists" });
  }
  const newUser = { id: Date.now(), name, username, password: bcrypt.hashSync(password, 10), plainPassword: password, role, contact };
  users.push(newUser);
  saveData(usersFile, users);
  res.json({ id: newUser.id, name: newUser.name, username: newUser.username, password: newUser.plainPassword, role: newUser.role, contact: newUser.contact ?? "" });
});

app.put("/api/users/:id", authMiddleware, roleMiddleware(["vip"]), (req, res) => {
  const id = parseInt(req.params.id);
  const { name, username, password, role, contact } = req.body;
  const existing = users.find(u => u.id === id);
  if (!existing) return res.status(404).json({ error: "User not found" });

  const duplicate = users.find(u => u.username === username && u.id !== id);
  if (duplicate) return res.status(400).json({ error: "Username already exists" });

  existing.name = name ?? existing.name;
  existing.username = username ?? existing.username;
  existing.role = role ?? existing.role;
  existing.contact = contact ?? existing.contact;
  if (password) {
    existing.password = bcrypt.hashSync(password, 10);
    (existing as any).plainPassword = password;
  }

  saveData(usersFile, users);
  res.json({ id: existing.id, name: existing.name, username: existing.username, password: (existing as any).plainPassword || "••••••", role: existing.role, contact: existing.contact ?? "" });
});

app.delete("/api/users/:id", authMiddleware, roleMiddleware(["vip"]), (req, res) => {
  const id = parseInt(req.params.id);
  users = users.filter(u => u.id !== id);
  saveData(usersFile, users);
  res.json({ success: true });
});

// API: Settings (vip)
app.get("/api/settings", authMiddleware, (req, res) => {
  res.json(settings);
});

const parseCoordinateValue = (value: string) => {
  const normalize = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
    return null;
  };

  const tryParseNumericPair = (input: string) => {
    const directMatch = input.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
    if (!directMatch) return null;
    return normalize(parseFloat(directMatch[1]), parseFloat(directMatch[2]));
  };

  const tryParseUrlValue = (input: string) => {
    try {
      const url = new URL(input);
      const candidates = [
        url.searchParams.get('ll'),
        url.searchParams.get('center'),
        url.searchParams.get('q'),
        url.searchParams.get('destination'),
        url.searchParams.get('saddr'),
        url.searchParams.get('daddr'),
        url.searchParams.get('origin')
      ];

      for (const candidate of candidates) {
        if (!candidate) continue;
        const parsed = tryParseNumericPair(decodeURIComponent(candidate));
        if (parsed) return parsed;
      }

      const pathMatch = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[,/]|$)/);
      if (pathMatch) {
        return normalize(parseFloat(pathMatch[1]), parseFloat(pathMatch[2]));
      }
    } catch {
      // ignore
    }
    return null;
  };

  const trimmed = value.trim();
  const direct = tryParseNumericPair(trimmed);
  if (direct) return direct;

  const googleMatch = trimmed.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (googleMatch) {
    return normalize(parseFloat(googleMatch[1]), parseFloat(googleMatch[2]));
  }

  const queryMatch = trimmed.match(/(?:[?&](?:ll|q|center|destination|saddr|daddr|origin)=)([^&]+)/i);
  if (queryMatch) {
    const parsed = tryParseNumericPair(decodeURIComponent(queryMatch[1]));
    if (parsed) return parsed;
  }

  const pathMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[,/]|$)/);
  if (pathMatch) {
    return normalize(parseFloat(pathMatch[1]), parseFloat(pathMatch[2]));
  }

  const urlParsed = tryParseUrlValue(trimmed);
  if (urlParsed) return urlParsed;

  // try to parse DMS formats like 7°52'17.6"S 110°37'17.6"E or URL-encoded variants
  try {
    const decoded = decodeURIComponent(trimmed);
    const dmsRegex = /([0-9]{1,3})[°\u00B0]\s*([0-9]{1,2})['’]\s*([0-9]{1,2}(?:\.\d+)?)["”]?\s*([NS])[^0-9A-Za-z\-\+\.]*(?:[,;\s])?\s*([0-9]{1,3})[°\u00B0]\s*([0-9]{1,2})['’]\s*([0-9]{1,2}(?:\.\d+)?)["”]?\s*([EW])/i;
    const m = decoded.match(dmsRegex);
    if (m) {
      const deg1 = parseFloat(m[1]);
      const min1 = parseFloat(m[2]);
      const sec1 = parseFloat(m[3]);
      const dir1 = (m[4] || '').toUpperCase();
      const deg2 = parseFloat(m[5]);
      const min2 = parseFloat(m[6]);
      const sec2 = parseFloat(m[7]);
      const dir2 = (m[8] || '').toUpperCase();

      const dmsToDec = (deg: number, min: number, sec: number, dir: string) => {
        let dec = deg + (min / 60) + (sec / 3600);
        if (dir === 'S' || dir === 'W') dec = -Math.abs(dec);
        return dec;
      };

      const lat = dmsToDec(deg1, min1, sec1, dir1);
      const lng = dmsToDec(deg2, min2, sec2, dir2);
      return normalize(lat, lng);
    }
  } catch (e) {
    // ignore
  }

  // fallback: try to find any lat,lng pair in the text (useful when coordinates are embedded in JS/JSON)
  try {
    const coordRegex = /(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = coordRegex.exec(trimmed)) !== null) {
      const parsed = normalize(parseFloat(m[1]), parseFloat(m[2]));
      if (parsed) return parsed;
    }
  } catch (e) {
    // ignore
  }

  return null;
};

app.post("/api/resolve-location", async (req, res) => {
  const { value } = req.body ?? {};
  if (typeof value !== "string" || !value.trim()) {
    return res.status(400).json({ error: "No value provided" });
  }

  const trimmed = value.trim();
  const direct = parseCoordinateValue(trimmed);
  if (direct) {
    return res.json(direct);
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return res.status(400).json({ error: "Invalid format" });
  }

  try {
    const response = await fetch(trimmed, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const finalUrl = response.url;
    const fromUrl = parseCoordinateValue(finalUrl);
    if (fromUrl) {
      return res.json(fromUrl);
    }

    const html = await response.text();
    const fromHtml = parseCoordinateValue(html);
    if (fromHtml) {
      return res.json(fromHtml);
    }

    return res.status(400).json({ error: "Unable to parse Google Maps link" });
  } catch (error) {
    return res.status(400).json({ error: "Unable to resolve Google Maps link" });
  }
});

app.post("/api/settings", authMiddleware, roleMiddleware(["vip"]), (req, res) => {
  const { coverageDistance, logo } = req.body;
  if (coverageDistance !== undefined) settings.coverageDistance = coverageDistance;
  // handle logo storage/removal
  try {
    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const removeExistingLogoFile = () => {
      if (settings.logo && typeof settings.logo === 'string' && settings.logo.startsWith('/')) {
        const existingName = path.basename(settings.logo);
        const existingPath = path.join(publicDir, existingName);
        if (fs.existsSync(existingPath)) {
          try { fs.unlinkSync(existingPath); } catch (e) { /* ignore */ }
        }
      }
    };

    if (logo === undefined || logo === null) {
      // user cleared logo -> remove file and clear setting
      removeExistingLogoFile();
      delete settings.logo;
    } else if (typeof logo === 'string' && logo.startsWith('data:')) {
      // data URL upload -> save into public folder as logo.png (or appropriate ext)
      // detect mime and extension
      const match = logo.match(/^data:(image\/[a-zA-Z0-9+.-]+)(;base64)?,(.*)$/);
      if (match) {
        const mime = match[1];
        const isBase64 = !!match[2];
        const dataPart = match[3] || '';
        let ext = '.png';
        if (mime.includes('svg')) ext = '.svg';
        else if (mime.includes('jpeg')) ext = '.jpg';
        else if (mime.includes('webp')) ext = '.webp';

        // remove previous file if any
        removeExistingLogoFile();

        const fileName = `logo${ext}`;
        const filePath = path.join(publicDir, fileName);
        try {
          if (isBase64) {
            const buffer = Buffer.from(dataPart, 'base64');
            fs.writeFileSync(filePath, buffer);
          } else {
            // percent-encoded data
            const decoded = decodeURIComponent(dataPart);
            fs.writeFileSync(filePath, decoded, 'utf8');
          }
          settings.logo = '/' + fileName;
        } catch (e) {
          console.warn('Failed to write logo file', e);
        }
      } else {
        // unknown data, just store as-is
        settings.logo = logo;
      }
    } else if (typeof logo === 'string') {
      // probably a path like '/CASH.png' or external URL
      // if it's a root path to public, try to keep it and remove previous if different
      if (settings.logo && settings.logo !== logo) removeExistingLogoFile();
      settings.logo = logo;
    }
  } catch (e) {
    console.warn('Error handling logo in settings update', e);
  }
  // persist settings to disk
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write settings.json', e);
  }
  res.json(settings);
});

// API: Export/Import (vip)
app.get("/api/export", authMiddleware, roleMiddleware(["vip"]), (req, res) => {
  res.json({ odps, customers, users: users.map(u => ({ id: u.id, name: u.name, username: u.username, password: "••••••", role: u.role, contact: u.contact ?? "" })) });
});

app.post("/api/import", authMiddleware, roleMiddleware(["vip"]), (req, res) => {
  const { importedOdps, importedCustomers, importMode = 'replace' } = req.body;

  if ((!Array.isArray(importedOdps) || importedOdps.length === 0) && (!Array.isArray(importedCustomers) || importedCustomers.length === 0)) {
    return res.status(400).json({ error: "No valid ODP or customer data found in the uploaded file." });
  }

  if (importMode === 'append') {
    // Append / Merge mode: Keep existing data, add new entries
    const odpIdMap = new Map<number, number>();

    if (Array.isArray(importedOdps)) {
      importedOdps.forEach((impOdp: any) => {
        const existingOdp = odps.find(o => o.name.toLowerCase() === (impOdp.name || '').toLowerCase());
        if (existingOdp) {
          // Map imported ODP id to existing ODP id so imported customers link properly
          odpIdMap.set(Number(impOdp.id), existingOdp.id);
        } else {
          // Assign unique ID if there is a collision with existing IDs
          let newId = Number(impOdp.id ?? Date.now());
          if (odps.some(o => o.id === newId)) {
            newId = Date.now() + Math.floor(Math.random() * 10000);
          }
          odpIdMap.set(Number(impOdp.id), newId);
          odps.push({
            ...impOdp,
            id: newId,
            lat: Number(impOdp.lat ?? 0),
            lng: Number(impOdp.lng ?? 0),
            capacity: Number(impOdp.capacity ?? 8)
          });
        }
      });
    }

    if (Array.isArray(importedCustomers)) {
      importedCustomers.forEach((cust: any) => {
        const targetOdpId = odpIdMap.get(Number(cust.odpId)) ?? Number(cust.odpId);
        let newCustId = Number(cust.id ?? Date.now());
        if (customers.some(c => c.id === newCustId)) {
          newCustId = Date.now() + Math.floor(Math.random() * 10000);
        }
        customers.push({
          ...cust,
          id: newCustId,
          lat: Number(cust.lat ?? 0),
          lng: Number(cust.lng ?? 0),
          odpId: targetOdpId
        });
      });
    }
  } else {
    // Replace mode: Overwrite existing data
    if (Array.isArray(importedOdps) && importedOdps.length > 0) {
      odps = importedOdps.map((odp: any) => ({
        ...odp,
        id: Number(odp.id ?? Date.now()),
        lat: Number(odp.lat ?? 0),
        lng: Number(odp.lng ?? 0),
        capacity: Number(odp.capacity ?? 8)
      }));
    }

    if (Array.isArray(importedCustomers) && importedCustomers.length > 0) {
      customers = importedCustomers.map((customer: any) => ({
        ...customer,
        id: Number(customer.id ?? Date.now()),
        lat: Number(customer.lat ?? 0),
        lng: Number(customer.lng ?? 0),
        odpId: Number(customer.odpId ?? 0)
      }));
    }
  }

  saveData(odpsFile, odps);
  saveData(customersFile, customers);

  const modeLabel = importMode === 'append' ? 'ditambahkan ke data yang ada' : 'mengganti seluruh data';
  res.json({ success: true, message: `Import berhasil! Data ${modeLabel}.` });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
