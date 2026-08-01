import { useState } from 'react';
import { Settings } from 'lucide-react';
import PengaturanDiskonModal from './PengaturanDiskonModal';
import PengaturanPembayaranModal from './PengaturanPembayaranModal';

const rp = (n) => `IDR ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

const metodeLabel = { tunai: 'Tunai', transfer: 'Bank Transfer', qris: 'QRIS / E-Wallet' };

const formatTanggal = (isoString) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Satu baris ringkasan: label di kolom Diskon, nilai di kolom Total Harga, aksi di kolom Aksi. */
function RingkasanRow({ label, value, action, bold, colorClass, showAksiCol }) {
  return (
    <tr>
      <td colSpan={5} />
      <td className={`py-1.5 text-right whitespace-nowrap ${bold ? 'font-bold text-slate-700' : 'font-medium text-slate-400'}`}>{label}</td>
      <td className={`py-1.5 text-right font-mono whitespace-nowrap ${bold ? 'font-bold text-slate-800' : colorClass || 'text-slate-700'}`}>{value}</td>
      {showAksiCol && <td className="py-1.5 text-right">{action}</td>}
    </tr>
  );
}

/**
 * Baris ringkasan (Total Pesanan/Subtotal/Diskon/Biaya Layanan/Pajak/dkk/Total
 * Ditagihkan/Pembayaran) — dirender sebagai <tr> lanjutan dari tabel Produk
 * Pesanan yang sama (kolom No/Deskripsi/Seri/Qty dikosongkan lewat colSpan),
 * supaya label & nilai sejajar dengan kolom Diskon/Total Harga/Aksi — bukan
 * kartu terpisah. `showAksiCol` harus sama dengan prop `canEdit` tabel induk
 * supaya jumlah kolom <td> konsisten dengan <thead>.
 *
 * Biaya Layanan/Pajak/Pembulatan/Biaya Pengiriman/Tambahan Pembayaran
 * ditampilkan statis "IDR 0" — tidak ada field/endpoint untuk itu di backend
 * saat ini (bukan disembunyikan, tapi juga belum ada "Pengaturan"-nya).
 */
export default function RingkasanPesananCard({ order, items, canEdit, onOrderChanged }) {
  const [showDiskon, setShowDiskon] = useState(false);
  const [showBayar, setShowBayar] = useState(false);

  const subtotal = items.reduce((sum, it) => sum + (it.qty ?? 1) * (it.harga_jual ?? 0), 0);
  const totalHarga = order.total_harga ?? subtotal;
  const dpDibayar = order.dp_dibayar ?? 0;
  const sisaTagihan = order.sisa_tagihan ?? Math.max(0, totalHarga - dpDibayar);
  const diskonPersen = order.diskon_persen ?? 0;
  const totalPotongan = Math.max(0, subtotal - totalHarga);
  const lastPayment = (order.activity_logs || []).find((log) => log.tindakan === 'PAYMENT');

  return (
    <>
      <RingkasanRow label="Total Pesanan" value={items.length} bold showAksiCol={canEdit} />
      <RingkasanRow label="Subtotal" value={rp(subtotal)} showAksiCol={canEdit} />
      <RingkasanRow
        label={`Diskon (${diskonPersen.toFixed ? diskonPersen.toFixed(2) : diskonPersen}%)`}
        value={rp(totalPotongan)}
        showAksiCol={canEdit}
        action={canEdit && (
          <button type="button" onClick={() => setShowDiskon(true)} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer ml-auto">
            <Settings size={11} /> Pengaturan Diskon
          </button>
        )}
      />
      <RingkasanRow label="Biaya Layanan" value={rp(0)} showAksiCol={canEdit} />
      <RingkasanRow label="Pajak" value={rp(0)} showAksiCol={canEdit} />
      <RingkasanRow label="Pembulatan" value={rp(0)} showAksiCol={canEdit} />
      <RingkasanRow label="Biaya Pengiriman" value={rp(0)} showAksiCol={canEdit} />
      <RingkasanRow label="Tambahan Pembayaran" value={rp(0)} showAksiCol={canEdit} />
      <RingkasanRow label="Total Ditagihkan" value={rp(totalHarga)} bold showAksiCol={canEdit} />
      <RingkasanRow
        label="Pembayaran"
        value={rp(dpDibayar)}
        showAksiCol={canEdit}
        action={canEdit && sisaTagihan > 0 && (
          <button type="button" onClick={() => setShowBayar(true)} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer ml-auto">
            <Settings size={11} /> Pengaturan Pembayaran
          </button>
        )}
      />
      <RingkasanRow label="Sisa Tagihan" value={rp(sisaTagihan)} colorClass={sisaTagihan > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'} showAksiCol={canEdit} />

      <tr>
        <td colSpan={canEdit ? 8 : 7} className="pt-3">
          <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400 font-medium">Cara Pembayaran</span>
              <span className="text-slate-700 font-semibold">{dpDibayar > 0 ? (metodeLabel[order.metode_pembayaran] || order.metode_pembayaran) : '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400 font-medium">Referensi Pembayaran</span>
              <span className="text-slate-700 font-semibold">{order.referensi_pembayaran || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400 font-medium">Tanggal Pembayaran</span>
              <span className="text-slate-700 font-semibold">{lastPayment ? formatTanggal(lastPayment.waktu) : '-'}</span>
            </div>
          </div>
        </td>
      </tr>

      {showDiskon && (
        <PengaturanDiskonModal
          orderId={order.id}
          subtotal={subtotal}
          currentPersen={diskonPersen}
          onClose={() => setShowDiskon(false)}
          onSaved={() => { setShowDiskon(false); onOrderChanged?.(); }}
        />
      )}

      {showBayar && (
        <PengaturanPembayaranModal
          orderId={order.id}
          sisaTagihan={sisaTagihan}
          onClose={() => setShowBayar(false)}
          onSaved={() => { setShowBayar(false); onOrderChanged?.(); }}
        />
      )}
    </>
  );
}
