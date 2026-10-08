import { useState } from 'react';
import { Ticket } from 'lucide-react';
import apiClient from '../../../api/apiClient';

// Tombol "Kirim ID Pesanan WA" (2026-10-08): kirim ID lacak pesanan saja ke
// WhatsApp pelanggan, tanpa faktur. Bisa dipakai ulang (kirim ulang).
export default function KirimIdPesananButton({ orderId, className = '', iconSize = 14 }) {
  const [mengirim, setMengirim] = useState(false);

  const kirim = async () => {
    if (!orderId || mengirim) return;
    setMengirim(true);
    try {
      const { data } = await apiClient.post(`/orders/${orderId}/kirim-id-whatsapp/`);
      alert(`ID pesanan terkirim ke WhatsApp ${data.number}.`);
    } catch (err) {
      const alasan = err?.response?.data?.reason;
      alert(
        alasan === 'invalid_number'
          ? 'ID pesanan tidak dikirim karena nomor WhatsApp pelanggan tidak valid.'
          : alasan === 'batal'
            ? 'Pesanan ini sudah dibatalkan.'
            : 'ID pesanan gagal dikirim. Periksa koneksi gateway WhatsApp lalu coba lagi.',
      );
    } finally {
      setMengirim(false);
    }
  };

  return (
    <button
      type="button"
      onClick={kirim}
      disabled={mengirim}
      title="Kirim ID pesanan untuk lacak status, tanpa faktur"
      className={`flex items-center justify-center gap-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-black disabled:opacity-50 cursor-pointer ${className}`}
    >
      <Ticket size={iconSize} /> {mengirim ? 'Mengirim...' : 'Kirim ID Pesanan WA'}
    </button>
  );
}
