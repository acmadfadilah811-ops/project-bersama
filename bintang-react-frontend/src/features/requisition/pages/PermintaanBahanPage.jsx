import { useState } from 'react';
import { ClipboardList, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import FormPermintaanBahan from '../components/FormPermintaanBahan';
import KartuPermintaanBahan from '../components/KartuPermintaanBahan';
import { TAB, usePermintaanBahan } from '../hooks/usePermintaanBahan';

const BOLEH_MENGAJUKAN = ['kordiv', 'spv', 'manager', 'owner'];

export default function PermintaanBahanPage() {
  const { user } = useAuth();
  const { tampil, jumlahPerTab, tab, setTab, memuat, sedangProses, kirim, aksi, muat } = usePermintaanBahan();
  const [formTerbuka, setFormTerbuka] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-12 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardList size={22} className="text-indigo-600" />
            Permintaan Bahan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Ajukan bahan baku, setujui, siapkan, dan terima. Dokumen ini tidak mengubah stok atau jurnal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={muat} className="p-2 text-slate-400 hover:text-slate-700" title="Segarkan">
            <RefreshCw size={16} />
          </button>
          {BOLEH_MENGAJUKAN.includes(user?.role) && (
            <button
              type="button"
              onClick={() => setFormTerbuka(true)}
              className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <Plus size={14} /> Ajukan
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {Object.entries(TAB).map(([kunci, { label }]) => (
          <button
            key={kunci}
            type="button"
            onClick={() => setTab(kunci)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${
              tab === kunci ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label} ({jumlahPerTab[kunci]})
          </button>
        ))}
      </div>

      {memuat ? (
        <p className="text-sm text-slate-400 text-center py-10">Memuat...</p>
      ) : tampil.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Tidak ada permintaan di tab ini.</p>
      ) : (
        <div className="space-y-3">
          {tampil.map((p) => (
            <KartuPermintaanBahan key={p.id} permintaan={p} sibuk={sedangProses === p.id} onAksi={aksi} />
          ))}
        </div>
      )}

      {formTerbuka && <FormPermintaanBahan onKirim={kirim} onTutup={() => setFormTerbuka(false)} />}
    </div>
  );
}
