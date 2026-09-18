import { useEffect, useState } from 'react';
import { AlertCircle, MessageCircle, MessagesSquare, RefreshCw, ShoppingCart, UserCheck, Users } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const formatAngka = (n) => (typeof n === 'number' ? n.toLocaleString('id-ID') : '–');

function KartuStat({ icon: Icon, label, value, accent, catatan }) {
  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon size={16} />
        </div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-extrabold text-slate-800">{formatAngka(value)}</p>
      {catatan && <p className="text-[10px] text-slate-400 mt-1">{catatan}</p>}
    </div>
  );
}

/**
 * Tab "Statistik" di Pengaturan WA Bot -- SNAPSHOT kondisi sekarang
 * (bukan riwayat/grafik dari waktu ke waktu). Bintang belum menyimpan
 * log pesan per-baris (mana yg dibalas bot vs staff manual), cuma
 * Evolution API yang simpan histori chat mentah -- keputusan sadar
 * 2026-09-18: mulai dari statistik yang benar-benar bisa dipercaya
 * datanya, bukan pura-pura ada riwayat yang sebenarnya tidak tercatat.
 */
export default function WaBotStatsPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiClient.get('/wa-bot-config/stats/');
      setStats(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-slate-800 text-base">Statistik Chat</h4>
          <p className="text-xs text-slate-400">
            Kondisi SEKARANG (snapshot), bukan grafik riwayat -- Bintang belum mencatat log pesan
            per-baris, jadi tidak bisa memisahkan jumlah balasan bot vs staff manual dari waktu ke waktu.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition-all disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-slate-400">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Gagal memuat statistik.</p>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KartuStat
            icon={Users}
            label="Total Kontak"
            value={stats.total_kontak}
            accent="bg-indigo-100 text-indigo-600"
          />
          <KartuStat
            icon={MessagesSquare}
            label="Chat Tersimpan"
            value={stats.chat_tersimpan}
            accent="bg-emerald-100 text-emerald-600"
            catatan="Dari Evolution API"
          />
          <KartuStat
            icon={MessageCircle}
            label="Pesan Tersimpan"
            value={stats.pesan_tersimpan}
            accent="bg-emerald-100 text-emerald-600"
            catatan="Dari Evolution API"
          />
          <KartuStat
            icon={UserCheck}
            label="Handover Permanen"
            value={stats.handover_permanen}
            accent="bg-amber-100 text-amber-600"
            catatan="Bot dimatikan manual (Ambil Alih Chat)"
          />
          <KartuStat
            icon={UserCheck}
            label="Handover Sementara"
            value={stats.handover_sementara}
            accent="bg-amber-100 text-amber-600"
            catatan={stats.handover_sementara === null ? 'Tidak tersedia di environment ini' : 'Auto-pause 15 menit, sedang aktif'}
          />
          <KartuStat
            icon={ShoppingCart}
            label="Order dari Bot WA"
            value={stats.order_dari_bot_wa}
            accent="bg-sky-100 text-sky-600"
            catatan="Total sepanjang waktu"
          />
        </div>
      ) : null}
    </div>
  );
}
