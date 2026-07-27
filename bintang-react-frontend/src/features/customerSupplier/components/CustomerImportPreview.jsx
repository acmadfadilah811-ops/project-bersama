// Urutan 4 kolom pertama mengikuti Olsera; sisanya menyusul (tabel bisa digeser
// ke kanan). Kuncinya = header pelanggan-template.csv, yang juga dibaca backend.
const PREVIEW_COLUMNS = [
  { key: 'name', label: 'Nama Pelanggan' },
  { key: 'address', label: 'Alamat' },
  { key: 'phone', label: 'Telpon' },
  { key: 'email', label: 'Email' },
  { key: 'code', label: 'Kode' },
  { key: 'customer_type', label: 'Tipe' },
  { key: 'gender', label: 'Gender' },
  { key: 'dob', label: 'Tgl Lahir' },
  { key: 'expiry_date', label: 'Tgl Berakhir' },
  { key: 'city', label: 'Kota' },
  { key: 'subdistrict', label: 'Kecamatan' },
  { key: 'postal_code', label: 'Kode Pos' },
  { key: 'company', label: 'Perusahaan' },
  { key: 'credit_limit', label: 'Batas Kredit' },
  { key: 'loyalty_points', label: 'Loyalty' },
  { key: 'notes', label: 'Catatan' },
  { key: 'is_frozen', label: 'Bekukan' },
  { key: 'accept_newsletter', label: 'Buletin' },
];

/** Tabel pratinjau isi CSV pelanggan + daftar masalahnya. Murni tampilan. */
export default function CustomerImportPreview({ rows = [], issues = [] }) {
  if (rows.length === 0 && issues.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-700">
          Pratinjau data ({rows.length} baris)
        </span>
        <span className={`text-xs font-bold ${issues.length ? 'text-rose-600' : 'text-emerald-600'}`}>
          {issues.length ? `${issues.length} masalah — perbaiki dulu` : 'Siap diimpor'}
        </span>
      </div>

      {rows.length > 0 && (
        <div className="max-h-56 overflow-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky top-0 bg-slate-50 px-3 py-2 text-left font-bold text-slate-500">#</th>
                {PREVIEW_COLUMNS.map((col) => (
                  <th key={col.key} className="sticky top-0 bg-slate-50 px-3 py-2 text-left font-bold text-slate-500 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                  {PREVIEW_COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                      {row[col.key] || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {issues.map((msg, i) => (
            <div key={i} className="text-xs text-rose-700 leading-5">• {msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}
