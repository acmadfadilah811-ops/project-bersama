export const getReturnInfo = (rowOrNotes) => {
  if (!rowOrNotes) return null;
  if (typeof rowOrNotes === 'object') {
    if (rowOrNotes.pengembalian_aktif) {
      return {
        id: rowOrNotes.pengembalian_aktif.id,
        tanggal: rowOrNotes.pengembalian_aktif.tanggal_pengembalian,
        status: rowOrNotes.pengembalian_aktif.status || 'Tunda',
        catatan: rowOrNotes.pengembalian_aktif.catatan,
        nominal_refund: rowOrNotes.pengembalian_aktif.nominal_refund,
      };
    }
    return getReturnInfo(rowOrNotes.catatan_pelanggan);
  }

  const value = String(rowOrNotes);
  const match = value.match(
    /\[PENGEMBALIAN - Tanggal:\s*([^\s,]*),\s*Status:\s*([^,]*),\s*Catatan:\s*([^\]]*)\]/
  ) || value.match(
    /\[PENGEMBALIAN - Tanggal:\s*([^\s,]+),\s*Catatan:\s*([^\]]*)\]/
  );

  if (!match) return null;
  if (match.length === 4) {
    return { tanggal: match[1], status: match[2] || 'Tunda', catatan: match[3] };
  }
  return { tanggal: match[1], status: 'Tunda', catatan: match[2] };
};

export const hasActiveReturn = (row) => !!getReturnInfo(row);

export const statusMap = {
  review: { label: 'Tunda', cls: 'bg-orange-50 text-orange-600 border-orange-100' },
  desain: { label: 'Dikonfirmasi', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
  proses: { label: 'Dikirim', cls: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  ready: { label: 'Terkirim', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  selesai: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  batal: { label: 'Batal', cls: 'bg-rose-50 text-rose-600 border-rose-100' },
};
