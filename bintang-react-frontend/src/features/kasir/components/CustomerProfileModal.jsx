import React, { useState } from 'react';
import { User, X } from 'lucide-react';

export default function CustomerProfileModal({ isOpen, contact, onClose }) {
  const [activeTab, setActiveTab] = useState('profil');

  if (!isOpen) return null;

  const data = {
    ...(contact || {}),
    poin: contact?.member_poin != null ? contact.member_poin : 0,
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        {/* Header Bar SS 2 */}
        <div className="bg-[#0088FF] px-4 pt-3 pb-0 flex items-center justify-between text-white relative">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('profil')}
              className={`px-4 py-2 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                activeTab === 'profil' ? 'border-white text-white' : 'border-transparent text-blue-100 hover:text-white'
              }`}
            >
              Profil
            </button>
            <button
              onClick={() => setActiveTab('riwayat')}
              className={`px-4 py-2 font-bold text-xs border-b-2 transition-all cursor-pointer ${
                activeTab === 'riwayat' ? 'border-white text-white' : 'border-transparent text-blue-100 hover:text-white'
              }`}
            >
              Riwayat Pesanan
            </button>
          </div>

          <div className="flex items-center gap-4 pb-2">
            <span className="flex items-center gap-1 text-xs font-semibold bg-blue-700/50 px-2 py-0.5 rounded">
              <User size={12} /> {data.poin || 0} pts
            </span>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {activeTab === 'profil' ? (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-h-[80vh] overflow-y-auto bg-white text-xs">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Tipe Pelanggan</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.customer_group_nama || 'Guest'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Nama</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.nama || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">No. Keanggotaan</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.no_keanggotaan || data.kode_pelanggan || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Email</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.email || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Telepon</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.telepon || data.nomor_wa || '-'}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border-b border-slate-200 pb-1">
                  <label className="text-[10px] font-medium text-slate-400 block">Tanggal Lahir</label>
                  <div className="font-semibold text-slate-800 mt-0.5">{data.tanggal_lahir || '-'}</div>
                </div>
                <div className="border-b border-slate-200 pb-1">
                  <label className="text-[10px] font-medium text-slate-400 block">Gender</label>
                  <div className="font-semibold text-slate-800 mt-0.5">{data.gender || '-'}</div>
                </div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Habis Berlaku</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.habis_berlaku || '-'}</div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Alamat</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.alamat || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Kode Pos</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.kode_pos || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Negara</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.negara || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Negara Bagian/Provinsi</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.provinsi || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Kota</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.kota || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Kecamatan</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.kecamatan || '-'}</div>
              </div>

              <div className="border-b border-slate-200 pb-1">
                <label className="text-[10px] font-medium text-slate-400 block">Catatan</label>
                <div className="font-semibold text-slate-800 mt-0.5">{data.catatan || '-'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-semibold">
            Belum ada riwayat pesanan untuk pelanggan ini.
          </div>
        )}
      </div>
    </div>
  );
}
