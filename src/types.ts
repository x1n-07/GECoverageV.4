export interface User {
  id: number;
  name: string;
  username: string;
  password?: string;
  role: 'admin' | 'superadmin' | 'vip' | 'teknisi';
  contact?: string;
}

export interface ODP {
  id: number;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  connectedCustomers?: number;
  shelter?: string;
  pon?: string;
  otb?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  lat: number;
  lng: number;
  odpId: number;
}

export interface Settings {
  coverageDistance: number;
  logo?: string;
}
