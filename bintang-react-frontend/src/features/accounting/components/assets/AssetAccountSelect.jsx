export default function AssetAccountSelect({ label, value, onChange, accounts, filter, required = true }) {
  const options = accounts.filter(filter);
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-600">{label}{required && ' *'}</span>
      <select value={value || ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" required={required}>
        <option value="">Pilih akun</option>
        {options.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
        {options.length === 0 && <option disabled value="">Belum ada akun yang sesuai di COA</option>}
      </select>
    </label>
  );
}
