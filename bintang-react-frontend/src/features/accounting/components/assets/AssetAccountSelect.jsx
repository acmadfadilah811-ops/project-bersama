export default function AssetAccountSelect({ label, value, onChange, accounts, filter, required = true }) {
  const options = accounts.filter(filter);
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}{required && ' *'}</span>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold cursor-pointer shadow-3xs text-slate-650"
        required={required}
      >
        <option value="">Pilih akun</option>
        {options.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
        {options.length === 0 && <option disabled value="">Belum ada akun yang sesuai di COA</option>}
      </select>
    </label>
  );
}
