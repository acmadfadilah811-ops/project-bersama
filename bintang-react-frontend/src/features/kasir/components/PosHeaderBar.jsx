import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, MoreVertical, Eye, Edit, Trash2, Bell, PackageCheck, PackageSearch } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useKasir } from '../context/KasirContext';

/** Waktu relatif ringkas untuk daftar notifikasi ("5 mnt lalu"). */
const waktuRelatif = (ts) => {
  const detik = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (detik < 60) return 'baru saja';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.floor(jam / 24)} hr lalu`;
};

const jenisIkon = { siap: PackageCheck, masuk: PackageSearch };

export default function PosHeaderBar({
  storeName,
  accountName,
  selectedCustomer,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onToggleSidebar,
}) {
  const navigate = useNavigate();
  const { user, businessSettings } = useAuth();
  const { riwayatNotifikasi, jumlahBelumDibaca, tandaSemuaDibaca } = useKasir();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifikasi, setShowNotifikasi] = useState(false);
  const dropdownRef = useRef(null);
  const notifikasiRef = useRef(null);

  // Label di atas layar Kasir sebelumnya menampilkan nama akun kasir yang
  // login (accountName/user), bukan nama bisnis — sama di semua layar Kasir
  // yang pakai komponen ini (instruksi user 2026-09-05: tampilkan nama
  // bisnis "StarPhoto & Advertising", bukan nama akun).
  const displayName = businessSettings?.nama_bisnis || storeName || accountName || user?.nama_lengkap || user?.first_name || user?.username || '-';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (notifikasiRef.current && !notifikasiRef.current.contains(e.target)) {
        setShowNotifikasi(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Buka lonceng -> tandai semua sudah dibaca (badge hilang), riwayatnya
  // tetap tampil sampai polling berikutnya menambah yang baru.
  const bukaNotifikasi = () => {
    setShowNotifikasi((v) => {
      const next = !v;
      if (next) tandaSemuaDibaca();
      return next;
    });
  };

  return (
    <div className="bg-white text-slate-800 h-12 px-4 flex items-center justify-between border-b border-slate-200 shadow-xs relative z-40 shrink-0 select-none">
      {/* Left: Hamburger Icon (Setrip 3) */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
        title="Toggle Menu"
      >
        <Menu size={20} />
      </button>

      {/* Center: Account Name */}
      <h1 className="font-extrabold text-base tracking-wide text-slate-800 text-center">
        {displayName}
      </h1>

      {/* Right: Lonceng Notifikasi + 3 Vertical Dots Menu */}
      <div className="flex items-center gap-1">
        {/* Lonceng Notifikasi (2026-09-29): pesanan siap diambil + pesanan
            baru masuk antrean (lihat hooks/useNotifikasiSiapDiambil.js).
            Sebelumnya kasir tidak punya tempat membuka kembali notifikasi
            yang lewat sebagai toast/pill -- ini menu satu-satunya header
            yang dipakai di semua halaman Kasir, jadi lonceng dipasang di
            sini (bukan di KasirTopbar.jsx/KasirHeader.jsx, yang tidak
            dirender di mana pun). */}
        <div className="relative" ref={notifikasiRef}>
          <button
            onClick={bukaNotifikasi}
            className="relative p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
            title="Notifikasi"
          >
            <Bell size={19} />
            {jumlahBelumDibaca > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black leading-none border border-white">
                {jumlahBelumDibaca > 9 ? '9+' : jumlahBelumDibaca}
              </span>
            )}
          </button>

          {showNotifikasi && (
            <div className="absolute right-0 top-full mt-1 w-80 max-w-[85vw] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden text-slate-700 animate-fade-in">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
                <p className="text-xs font-extrabold text-slate-700">Notifikasi</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {riwayatNotifikasi.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[11px] font-semibold text-slate-400">
                    Belum ada notifikasi.
                  </p>
                ) : (
                  riwayatNotifikasi.map((n) => {
                    const Ikon = jenisIkon[n.jenis] || Bell;
                    const warna = n.jenis === 'siap' ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50';
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setShowNotifikasi(false);
                          navigate(n.tautan);
                        }}
                        className="w-full flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer border-b border-slate-50 last:border-b-0"
                      >
                        <span className={`shrink-0 p-1.5 rounded-lg ${warna}`}>
                          <Ikon size={13} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-bold text-slate-800">{n.judul}</span>
                          <span className="block text-[11px] text-slate-500 truncate">{n.pesan}</span>
                          <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">
                            {waktuRelatif(n.waktu)}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
            title="Opsi Pelanggan / Akun"
          >
            <MoreVertical size={20} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-700 animate-fade-in">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onViewCustomer();
                }}
                className="w-full px-4 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
              >
                <Eye size={14} className="text-blue-500" /> Lihat
              </button>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onEditCustomer();
                }}
                className="w-full px-4 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
              >
                <Edit size={14} className="text-amber-500" /> Ubah
              </button>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onDeleteCustomer();
                }}
                className="w-full px-4 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-rose-600 cursor-pointer border-t border-slate-100"
              >
                <Trash2 size={14} /> Hapus
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
