# CoverageKu — ODP Coverage Map Application

[![Version](https://img.shields.io/badge/version-3.3.9-blue.svg)](#versi-aplikasi)
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18.x-brightgreen.svg)]()
[![React](https://img.shields.io/badge/react-19.x-61DAFB.svg?logo=react)]()
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6.svg?logo=typescript)]()

---

## 📖 Gambaran Umum

**CoverageKu** adalah aplikasi web berbasis peta untuk manajemen dan pemetaan **Optical Distribution Point (ODP)** serta pelanggannya. Dirancang untuk tim operasional jaringan fiber optik (ISP / Telco) guna memantau jangkauan cakupan ODP, manajemen data pelanggan, dan analisis rute koneksi — semua dalam satu antarmuka interaktif berbasis **Leaflet + OpenStreetMap / ESRI Satellite**.

> **Nama Internal:** `ODP Coverage App`  
> **Versi Build:** `v3.3.9` 
> **Kode Basis:** React 19 + TypeScript + Vite + Express (SSR-ready)  
> **Author:** Azis A.I.

---

## 🚀 Kemampuan Utama (Core Capabilities)

| Modul | Deskripsi |
|-------|-----------|
| **🗺️ Peta Interaktif ODP** | Tampilkan ODP & pelanggan di peta Leaflet dengan dukungan layer **Jalan (OSM)** dan **Satelit (ESRI World Imagery + Labels)**. |
| **📍 Cek Cakupan (Coverage Check)** | Masukkan koordinat / link Google Maps → sistem menghitung jarak ke ODP terdekat, menampilkan rute (OSRM), status *Terjangkau / ODP Penuh / Tidak Terjangkau*, serta rekomendasi ODP alternatif. |
| **✏️ Manajemen ODP (CRUD)** | Tambah, edit (termasuk **drag-and-drop marker** di peta), hapus ODP. Form lengkap: Nama, Koordinat, Kapasitas, Kabel, Tube, Core. |
| **👥 Manajemen Pelanggan** | Tambah pelanggan, hubungkan ke ODP, hapus. Data: Nama, Telepon, Alamat, Koordinat, ODP Tujuan. |
| **🔄 Import / Export Data CSV** | Export seluruh data ODP + Pelanggan ke CSV standar. Import dengan **dua mode**:<br>• **Ganti Semua (Replace)** — timpa data lama<br>• **Tambah Saja (Append)** — gabungkan data baru tanpa hapus data existing (dedup berdasarkan nama ODP). |
| **👤 Autentikasi & RBAC** | Login JWT + cookie httpOnly. 4 Role: `admin`, `superadmin`, `vip`, `teknisi`. Hak akses per fitur dikontrol ketat. |
| **🔐 Watermark Keamanan Dinamis** | Overlay teks diagonal `CoverageKu | <username>` di atas peta.<br>• **Mode Jalan** → teks abu-abu gelap<br>• **Mode Satelit** → teks putih + outline gelap (terlihat jelas di citra gelap)<br>• **Non-intrusive**: `pointer-events: none`, tidak mengganggu interaksi peta. |
| **📱 Responsive & Fullscreen** | UI mobile-friendly, panel kolapsibel, toggle fullscreen peta. |

---

## 🎯 Keunggulan Fitur (Feature Highlights)

### 1. **Edit ODP dengan Drag-Drop + Undo**
- Klik **Edit ODP** → marker merah muncul di peta.
- **Geser marker** langsung di peta → koordinat form & input teks terupdate *real-time*.
- Tombol **Undo** di form edit → kembalikan posisi sebelumnya (riwayat pergeseran disimpan per sesi edit).
- Klik di peta saat mode edit → pindahkan marker ke lokasi klik (juga terekam ke history undo).

### 2. **Layer Peta Ganda (Streets + Satellite Hybrid)**
- Toggle **Satelit / Jalan** dengan satu klik (ikon `Layers` di kanan atas peta).
- Mode Satelit menampilkan **citra ESRI World Imagery** + **overlay label jalan & batas wilayah** (hybrid) agar navigasi tetap mudah.
- Persist state layer per sesi.

### 3. **Watermark Adaptif per Layer**
- Secara otomatis berganti warna saat user toggle layer:
  - **Streets**: `#475569` (slate-600), opacity 35%
  - **Satellite**: `#ffffff` (putih) + `stroke="#1e293b"` (slate-800), opacity 60%, `paint-order="stroke"`
- Menampilkan **`CoverageKu | <username>`** → identifikasi sumber screenshot / tangkapan layar untuk audit keamanan.
- Diterapkan di **halaman Peta Utama** & **Halaman Cek Cakupan Publik**.

### 4. **Import Data Fleksibel (Replace vs Append)**
- **Replace**: Hapus semua data lama, ganti dengan CSV (perilaku legacy).
- **Append (Merge)**:
  - ODP dengan **nama sama** → **tidak duplikat**, pelanggan CSV terhubung ke ODP existing.
  - ODP baru → ditambahkan dengan ID unik anti-tabrakan.
  - Pelanggan baru → ditambahkan & di-*remap* ke ID ODP yang benar.
- Validasi CSV ketat (header case-insensitive, parsing koordinat Google Maps URL / lat,lng).

### 5. **Cek Cakupan Cerdas (Coverage Analysis)**
- Input: Koordinat manual, Link Google Maps / Share Location, GPS Browser.
- Engine rute: **OSRM (Open Source Routing Machine)** → jalur jalan sebenarnya, bukan garis lurus.
- Output: Jarak (meter), Status (`Terjangkau` / `ODP Penuh` / `Tidak Terjangkau`), Rute visual di peta (hijau = terjangkau, merah = tidak), Rekomendasi ODP cadangan (kuning).
- Radius cakupan default **250 m** (konfigurasi via Settings).

### 6. **Role-Based Access Control (RBAC) Ketat**

| Fitur                   | admin | superadmin | vip | teknisi |
|-------------------------|-------|------------|-----|---------|
| Lihat Peta & Cek Cakupan|   ✅  |     ✅    |  ✅ |    ✅   |
| Tambah/Edit/Hapus ODP   |   ❌  |     ✅    |  ✅ |   ❌    |
| Import / Export Data    |   ❌  |     ❌    |  ✅ |   ❌    |
| Kelola User & Settings  |   ❌  |     ❌    |  ✅ |   ❌    |
| Watermark Username      |   ✅  |     ✅    |  ✅ |   ✅    |

---

## 🛠️ Stack Teknologi

| Kategori | Teknologi |
|----------|-----------|
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 8 |
| **Peta** | Leaflet 1.9.4, React-Leaflet 5 |
| **Backend (API)** | Express.js (TypeScript), tsx (dev), esbuild (prod bundle) |
| **Auth** | JWT (jsonwebtoken), bcryptjs, cookie-parser |
| **Data & Export** | PapaParse (CSV), File API |
| **Routing Engine** | OSRM (public instance `router.project-osrm.org`) |
| **Icons** | Lucide React |
| **Animasi** | Motion (Framer Motion) |
| **Utilities** | clsx, tailwind-merge, date-fns (jika dipakai) |

---

## 📦 Instalasi & Menjalankan

### Prasyarat
- **Node.js ≥ 18** (disarankan LTS terbaru)
- **npm / pnpm / yarn**

### Clone & Install
```bash
git clone <repository-url>
cd "coverage v3.3 internal"
npm install
```

### Development (Hot Reload)
```bash
npm run dev
```
→ Frontend (Vite) + Backend (tsx) berjalan di **http://localhost:3000**

### Production Build
```bash
npm run build
```
Output:
- `dist/` → static assets (Vite build)
- `dist/server.cjs` → bundled Express server (esbuild)

### Jalankan Production
```bash
npm start
```
→ Server Express menyajikan static files + API di port 3000.

---

## 📁 Struktur Proyek

```
coverage v3.3internal/
├── src/
│   ├── components/       # Shared UI components (Layout, etc.)
│   ├── contexts/         # React Context (AuthContext)
│   ├── pages/            # Halaman utama
│   │   ├── MapPage.tsx       # Peta ODP utama (fitur lengkap)
│   │   ├── PublicCoverage.tsx # Halaman cek cakupan publik
│   │   ├── Dashboard.tsx     # Ringkasan statistik
│   │   ├── ExportImport.tsx  # Import/Export CSV
│   │   ├── Settings.tsx      # Pengaturan radius, logo
│   │   ├── Users.tsx         # Manajemen user (VIP only)
│   │   └── Login.tsx
│   ├── types.ts          # TypeScript interfaces
│   ├── App.tsx           # Routing + global context menu handler
│   └── main.tsx          # Entry point
├── server.ts             # Express API server (dev & prod)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── metadata.json         # Metadata aplikasi
├── settings.json         # Persisted settings (radius, logo)
└── README.md             # Dokumentasi ini
```

---

## 🔧 Konfigurasi Penting

### Radius Cakupan Default
File: `settings.json`
```json
{ "coverageDistance": 250 }  // meter
```
Dapat diubah via halaman **Settings** (role VIP).

### Logo Aplikasi
- Default: `/logo.png` (letakkan di folder `public/`)
- Dapat diupload/ganti via halaman **Settings** (role VIP).

### Akun Default (Seed Data)
| Username | Password | Role | Catatan |
|----------|----------|------|---------|
| `admin` | `admin` | `admin` | Akses dasar peta |
| `superadmin` | `superadmin` | `superadmin` | Kelola ODP & Pelanggan |
| `vip` | `vip` | `vip` | Full access (Import, Settings, Users) |
| `teknisi` | `teknisi` | `teknisi` | Cek cakupan & lihat peta |

> ⚠️ **Ganti password default segera setelah deploy production!**

---

## 📝 Format CSV Import

Header wajib (case-insensitive, spasi diabaikan):
```csv
SHELTER,(OLT/CARD)-PON,NO OTB,NAMA ODP,KOORDINAT ODP,KAPASITAS,NAMA PELANGGAN,KOORDINAT PELANGGAN
```

**Contoh Baris ODP Saja (tanpa pelanggan):**
```csv
SHELTER-01,OLT1-PON1,ODP-A01,"https://maps.app.goo.gl/?q=-6.2088,106.8456",16,-,-
```

**Contoh Baris ODP + Pelanggan:**
```csv
SHELTER-01,OLT1-PON1,ODP-A01,"https://maps.app.goo.gl/?q=-6.2088,106.8456",16,Budi Santoso,"https://maps.app.goo.gl/?q=-6.2089,106.8457"
```

> Koordinat ODP & Pelanggan mendukung: `lat, lng`, `lat lng`, atau **Google Maps Short URL** (`maps.app.goo.gl`, `goo.gl/maps`, `google.com/maps`).

---

## 🔒 Keamanan & Audit Trail

1. **Watermark Dinamis** → Setiap screenshot mengandung `CoverageKu | <username>` + timestamp build.
2. **Context Menu Blokir** → Mencegah "Save Image As" / "Inspect" casual di area peta.
3. **JWT HttpOnly Cookie** → Token tidak aksesible via JavaScript (mitigasi XSS).
4. **Role Middleware** → Setiap endpoint API divalidasi role di server-side.
5. **Input Sanitization** → Parsing CSV & koordinat dengan validasi ketat.

---

## 📄 Lisensi

MIT License © 2026 **Azis A.I.** — CoverageKu

> Aplikasi ini dikembangkan untuk kebutuhan internal manajemen jaringan fiber optik. Penggunaan, modifikasi, dan distribusi bebas dengan menyertakan atribusi.

---

## 🤝 Kontribusi & Dukungan

- **Issue / Bug Report**: Buka issue di repository
- **Feature Request**: Diskusikan via issue / PR
- **Author**: Azis A.I. (`azis.a.i`)

---

**Build Info:**
- **App Name:** CoverageKu (ODP Coverage App)
- **Version:** 3.3.9
- **Build Date:** 2026-08-23
- **Node:** ≥18.x
- **Package Manager:** npm / pnpm