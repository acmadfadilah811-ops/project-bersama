export const customerTabs = [
  { id: 'customers', label: 'Daftar Pelanggan' },
  { id: 'customer-groups', label: 'Grup Pelanggan' },
  { id: 'membership', label: 'Membership & Poin' },
];

export const supplierTabs = [
  { id: 'suppliers', label: 'Daftar Supplier' },
  { id: 'supplier-groups', label: 'Grup Supplier' },
];

export const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
    Number(value) || 0,
  );

export const customerGroupOptions = ['Reguler', 'Member', 'Korporat'];

export const customerSeed = [
  { id: 'CUST-001', name: 'Budi Santoso', phone: '0812-1111-2222', email: 'budi@mail.com', group: 'Reguler', deposit: 150000, active: true },
  { id: 'CUST-002', name: 'PT Maju Jaya', phone: '021-555-7788', email: 'po@majujaya.co.id', group: 'Korporat', deposit: 2500000, active: true },
  { id: 'CUST-003', name: 'Siti Aminah', phone: '0813-3333-4444', email: 'siti@mail.com', group: 'Member', deposit: 0, active: true },
];

export const customerGroupSeed = [
  { id: 'CG-01', name: 'Reguler', discount: 0, members: 120 },
  { id: 'CG-02', name: 'Member', discount: 5, members: 45 },
  { id: 'CG-03', name: 'Korporat', discount: 10, members: 12 },
];

export const membershipSeed = [
  { id: 'MB-001', name: 'Siti Aminah', tier: 'Silver', points: 320, joined: '12-Jan-2026' },
  { id: 'MB-002', name: 'Andi Wijaya', tier: 'Gold', points: 1450, joined: '03-Mar-2026' },
  { id: 'MB-003', name: 'Budi Santoso', tier: 'Bronze', points: 80, joined: '20-Mei-2026' },
];

export const supplierSeed = [
  { id: 'SUP-001', name: 'CV Tinta Prima', contact: 'Rudi', phone: '0815-9999-0000', address: 'Jl. Industri No. 5, Bandung', active: true },
  { id: 'SUP-002', name: 'PT Kertas Nusantara', contact: 'Lina', phone: '022-888-1234', address: 'Kawasan Industri, Cimahi', active: true },
];

export const supplierGroupSeed = [
  { id: 'SG-01', name: 'Bahan Baku', members: 8 },
  { id: 'SG-02', name: 'Jasa', members: 3 },
];
