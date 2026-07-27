import ToggleSwitchRow from './ToggleSwitchRow';

export default function ProductSettingsColumn({ settings, onToggle }) {
  return (
    <div className="space-y-5 lg:pl-4">
      <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
        Pengaturan Transaksi Produk
      </h3>

      <div className="space-y-4 text-xs">
        <div className="space-y-2">
          <ToggleSwitchRow
            label="Aktifkan produk akun grup"
            value={settings.enable_product_account_group}
            onChange={() => onToggle('enable_product_account_group')}
          />
          <div className="pt-1">
            <button
              type="button"
              disabled={!settings.enable_product_account_group}
              className={`w-full py-2 rounded-lg border text-center font-semibold text-xs transition-all ${
                settings.enable_product_account_group
                  ? 'border-sky-300 bg-sky-50 text-[#0088E8] hover:bg-sky-100 cursor-pointer'
                  : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Atur Produk Group
            </button>
          </div>
        </div>

        <ToggleSwitchRow
          label="Pemungutan pajak PPN"
          value={settings.is_ppn_active}
          onChange={() => onToggle('is_ppn_active')}
          bordered
        />
        <ToggleSwitchRow
          label="Manual fee ojek online"
          value={settings.enable_ojek_online_fee}
          onChange={() => onToggle('enable_ojek_online_fee')}
          bordered
        />
        <ToggleSwitchRow
          label="Tampilkan inventory di laba rugi"
          value={settings.show_inventory_in_profit_loss}
          onChange={() => onToggle('show_inventory_in_profit_loss')}
          bordered
        />
      </div>
    </div>
  );
}
