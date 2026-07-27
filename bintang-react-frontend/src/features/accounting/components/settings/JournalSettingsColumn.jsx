import { FileText } from 'lucide-react';
import ToggleSwitchRow from './ToggleSwitchRow';

export default function JournalSettingsColumn({ settings, onChange, onBlur, onToggle, onOpenLogModal }) {
  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">
        Pengaturan Transaksi Jurnal
      </h3>

      <div className="space-y-4 text-xs">
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-500">Mulai Akuntansi</label>
          <input
            type="date"
            value={settings.accounting_start_date || ''}
            onChange={(e) => onChange('accounting_start_date', e.target.value)}
            onBlur={() => onBlur('accounting_start_date')}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-semibold focus:bg-white focus:border-[#0088E8] focus:ring-1 focus:ring-[#0088E8] transition-all outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-500">Jatuh Tempo Pembayaran</label>
          <div className="flex">
            <input
              type="number"
              min="0"
              value={settings.default_payment_due_days}
              onChange={(e) => onChange('default_payment_due_days', parseInt(e.target.value) || 0)}
              onBlur={() => onBlur('default_payment_due_days')}
              className="flex-1 px-3 py-2 rounded-l-lg border border-slate-200 bg-slate-50 text-slate-800 font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
            />
            <span className="bg-slate-100 border border-l-0 border-slate-200 text-slate-500 text-xs px-3.5 py-2 rounded-r-lg font-medium flex items-center">
              Hari
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-500">
            Pilih hari pengiriman sebelum jatuh tempo
          </label>
          <div className="flex">
            <input
              type="number"
              min="0"
              value={settings.reminder_days_before_due}
              onChange={(e) => onChange('reminder_days_before_due', parseInt(e.target.value) || 0)}
              onBlur={() => onBlur('reminder_days_before_due')}
              className="flex-1 px-3 py-2 rounded-l-lg border border-slate-200 bg-slate-50 text-slate-800 font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
            />
            <span className="bg-slate-100 border border-l-0 border-slate-200 text-slate-500 text-xs px-3.5 py-2 rounded-r-lg font-medium flex items-center">
              Hari
            </span>
          </div>
        </div>

        <ToggleSwitchRow
          label="Email piutang jatuh tempo"
          value={settings.send_ar_due_email}
          onChange={() => onToggle('send_ar_due_email')}
        />
        <ToggleSwitchRow
          label="Transfer antar toko sebagai penjualan"
          value={settings.enable_transfer_between_stores_as_sale}
          onChange={() => onToggle('enable_transfer_between_stores_as_sale')}
        />
        <ToggleSwitchRow
          label="Hitung chart akun dari tahun ini"
          value={settings.calculate_coa_from_this_year}
          onChange={() => onToggle('calculate_coa_from_this_year')}
        />

        <div className="pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onOpenLogModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer shadow-2xs"
          >
            <FileText size={14} className="text-slate-500" />
            <span>Log Start/Stop Akuntansi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
