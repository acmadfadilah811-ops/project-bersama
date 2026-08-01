import { ChevronLeft, ChevronDown } from 'lucide-react';

export default function RincianMutasiAkunHeader({
  activeUserLabel,
  outletRef, showOutletDropdown, setShowOutletDropdown,
  accountRef, showAccountDropdown, setShowAccountDropdown,
  account, accounts, accountId, setViewingAccountId,
  onBack,
}) {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-between pb-1">
      <div className="flex items-center gap-3">
        {/* Outlet Selection Dropdown */}
        <div ref={outletRef} className="relative">
          <button
            type="button"
            onClick={() => setShowOutletDropdown(!showOutletDropdown)}
            className="flex items-center gap-1.5 px-4 py-1.5 border border-slate-205 bg-white text-xs font-bold text-slate-700 rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            <span>{activeUserLabel}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {showOutletDropdown && (
            <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left text-xs font-bold animate-fade-in">
              <button
                type="button"
                onClick={() => setShowOutletDropdown(false)}
                className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                {activeUserLabel}
              </button>
            </div>
          )}
        </div>

        {/* Account Selector Dropdown (lists up to 81000 - Penyesuaian barang) */}
        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            className="flex items-center gap-1.5 px-4 py-1.5 border border-slate-205 bg-white text-xs font-bold text-slate-808 rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            <span>{account ? `${account.code} ${account.name}` : 'Pilih Akun'}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {showAccountDropdown && (
            <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-64 max-h-[300px] overflow-y-auto text-left text-xs font-bold animate-fade-in">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => {
                    setViewingAccountId(acc.id);
                    setShowAccountDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left transition-colors cursor-pointer block border-b border-slate-50 last:border-b-0 ${
                    String(accountId) === String(acc.id)
                      ? 'bg-blue-50 text-[#0088E8]'
                      : 'text-slate-705 hover:bg-slate-50'
                  }`}
                >
                  {acc.code} {acc.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Back green border button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 px-4 py-1.5 border border-[#73C240] bg-white hover:bg-slate-50 text-[#73C240] font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
      >
        <ChevronLeft size={13} />
        <span>Kembali</span>
      </button>
    </div>
  );
}
