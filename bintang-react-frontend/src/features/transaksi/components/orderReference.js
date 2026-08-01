const CATEGORY_CODES = {
  'butuh-diproses': 'OPN',
  proses: 'OPN',
  review: 'OPN',
  draft: 'OPN',
  quotation: 'OPN',
  desain: 'OPN',
  ready: 'OPN',
  selesai: 'CMP',
  pengembalian: 'RTN',
  retur: 'RTN',
  dibatalkan: 'CNL',
  batal: 'CNL',
};

function rawOrderId(orderOrId) {
  const id = typeof orderOrId === 'object' ? orderOrId?.id : orderOrId;
  return String(id ?? '').replace(/^ORD-/i, '');
}

export function formatOrderReference(orderOrId, category) {
  const raw = rawOrderId(orderOrId);
  if (!raw) return '';
  const code = CATEGORY_CODES[category] || 'ORDER';
  return `ORD-${code}-${raw}`;
}

export function normalizeOrderSearch(value) {
  const query = String(value ?? '').trim();
  // Terima alias lama agar pencarian bookmark/nomor yang sudah terlanjur
  // tersalin tetap menemukan order yang sama setelah format profesional aktif.
  const match = query.match(/^ORD-(?:OPN|CMP|RTN|CNL|ORDER|PROSES|SELESAI|RETUR|BATAL)-(.+)$/i);
  return match ? match[1] : query;
}
