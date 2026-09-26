import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import apiClient from '../api/apiClient';
import { useDynamicIsland } from '../context/DynamicIslandContext';

// Lonceng notifikasi gabungan:
// - keuangan dari HR (gaji, reimbursement): Owner, Manager, SPV Finance -> /accounting/notifikasi/
// - stok minimum produk & bahan baku (2026-09-26, UAT INV-06): peran yang mengurus
//   inventori/pengadaan -> /notifikasi-stok/
const SUMBER = {
  keuangan: { url: '/accounting/notifikasi/', peran: ['owner', 'manager', 'spv_finance'] },
  stok: { url: '/notifikasi-stok/', peran: ['owner', 'manager', 'admin', 'spv_finance', 'admin_finance'] },
};
const INTERVAL_MS = 60000;

function waktuRelatif(iso) {
  const detik = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotifikasiKeuanganBell({ role }) {
  const navigate = useNavigate();
  const { triggerNotification } = useDynamicIsland() || {};
  const [buka, setBuka] = useState(false);
  const [data, setData] = useState({ belum_dibaca: 0, hasil: [] });
  const sudahDilihat = useRef(null);
  const wadah = useRef(null);
  const peran = (role || '').toLowerCase();
  const sumberAktif = Object.keys(SUMBER).filter((k) => SUMBER[k].peran.includes(peran));
  const boleh = sumberAktif.length > 0;
  const kunciSumber = sumberAktif.join(',');

  const muat = useCallback(async () => {
    try {
      const daftar = kunciSumber ? kunciSumber.split(',') : [];
      const hasilPerSumber = await Promise.all(daftar.map(async (sumber) => {
        try {
          const res = await apiClient.get(SUMBER[sumber].url);
          const d = res.data || { belum_dibaca: 0, hasil: [] };
          return { belum: d.belum_dibaca || 0, hasil: (d.hasil || []).map((n) => ({ ...n, sumber, kunci: `${sumber}-${n.id}` })) };
        } catch {
          return { belum: 0, hasil: [] };
        }
      }));
      const baru = {
        belum_dibaca: hasilPerSumber.reduce((a, x) => a + x.belum, 0),
        hasil: hasilPerSumber.flatMap((x) => x.hasil).sort((a, b) => new Date(b.dibuat) - new Date(a.dibuat)).slice(0, 40),
      };
      const idBelum = (baru.hasil || []).filter((n) => !n.dibaca).map((n) => n.kunci);
      // Pop-up hanya untuk notifikasi yang muncul SETELAH halaman dibuka.
      if (sudahDilihat.current && triggerNotification) {
        const muncul = (baru.hasil || []).find((n) => !n.dibaca && !sudahDilihat.current.has(n.kunci));
        if (muncul) triggerNotification({ type: 'announcement', title: muncul.judul, message: muncul.pesan });
      }
      sudahDilihat.current = new Set([...(sudahDilihat.current || []), ...idBelum, ...(baru.hasil || []).map((n) => n.kunci)]);
      setData(baru);
    } catch {
      // diam: lonceng tidak boleh mengganggu halaman bila API sedang gagal
    }
  }, [triggerNotification, kunciSumber]);

  useEffect(() => {
    if (!boleh) return undefined;
    muat();
    const t = setInterval(muat, INTERVAL_MS);
    return () => clearInterval(t);
  }, [boleh, muat]);

  useEffect(() => {
    if (!buka) return undefined;
    const tutup = (e) => { if (wadah.current && !wadah.current.contains(e.target)) setBuka(false); };
    document.addEventListener('mousedown', tutup);
    return () => document.removeEventListener('mousedown', tutup);
  }, [buka]);

  if (!boleh) return null;

  const tandai = async (sumber, body) => {
    try {
      const tujuan = sumber ? [sumber] : sumberAktif;
      await Promise.all(tujuan.map((k) => apiClient.post(`${SUMBER[k].url}baca/`, body)));
      await muat();
    } catch {
      /* abaikan */
    }
  };

  const bukaItem = async (n) => {
    if (!n.dibaca) await tandai(n.sumber, { ids: [n.id] });
    setBuka(false);
    if (n.tautan) navigate(n.tautan);
  };

  return (
    <div className="relative" ref={wadah}>
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        className="relative p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        title="Notifikasi"
        aria-label="Notifikasi"
      >
        <Bell size={18} />
        {data.belum_dibaca > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {data.belum_dibaca > 99 ? '99+' : data.belum_dibaca}
          </span>
        )}
      </button>
      {buka && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Notifikasi</span>
            {data.belum_dibaca > 0 && (
              <button type="button" onClick={() => tandai(null, { semua: true })} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1">
                <CheckCheck size={14} /> Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(data.hasil || []).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Belum ada notifikasi.</div>
            ) : (
              data.hasil.map((n) => (
                <button
                  type="button"
                  key={n.kunci}
                  onClick={() => bukaItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${n.dibaca ? '' : 'bg-slate-50'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.dibaca && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                    <div className="min-w-0">
                      <div className={`text-sm ${n.dibaca ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>{n.judul}</div>
                      {n.pesan && <div className="text-xs text-slate-500 mt-0.5 line-clamp-3">{n.pesan}</div>}
                      <div className="text-[11px] text-slate-400 mt-1">{waktuRelatif(n.dibuat)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
