import { useEffect, useMemo, useState } from 'react';
import { Factory, Loader2, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { getApiErrorMessage } from '../../../utils/apiError';

/**
 * Modal penerbitan SPK produksi — dipakai bersama oleh alur order (Kasir >
 * Buat Order) dan terminal POS.
 *
 * Komponen ini hanya mengurus PEMILIHAN target (divisi/staff/tahap). Pemanggil
 * yang menentukan endpoint mana yang dipakai, karena keduanya berbeda:
 *   - order    : POST /orders/{id}/assign/
 *   - transaksi: POST /pos/sales/{id}/terbitkan-spk/
 * Bentuk payload-nya sengaja sama supaya keduanya tidak menyimpang.
 *
 * Akun kasir hanya boleh menujukan SPK ke antrean divisi; penunjukan staff
 * tertentu adalah wewenang kepala divisi/manager. Pembatasan ini juga
 * ditegakkan backend di api/spk.py — UI hanya menyembunyikan opsinya.
 *
 * `modeStarfoto` (kasir StarFoto, 2026-10-15): tujuan dipilih lewat tombol
 * Staff Fotografer / Editor / Operator Cetak (divisi unit StarFoto) seperti
 * pilihan divisi Star Advertising, langsung ke tahap pertama divisi tersebut.
 */
const ALUR_STARFOTO = [
  { cocok: /foto/i, label: 'Staff Fotografer', ket: 'Difoto dulu oleh fotografer' },
  { cocok: /edit/i, label: 'Editor', ket: 'File diedit dulu sebelum dicetak' },
  { cocok: /operator|cetak/i, label: 'Operator Cetak', ket: 'Langsung dicetak' },
];

function tujuanStarfoto(divisiList, tahapList) {
  const milikStarfoto = divisiList.filter((d) => /starfoto/i.test(d.unit_bisnis_nama || ''));
  return ALUR_STARFOTO.map((a) => {
    const divisi = milikStarfoto.find((d) => a.cocok.test(d.nama));
    if (!divisi) return null;
    // Tahap pertama divisi (urutan, lalu id) -- Fotografer punya Sesi & Asisten berurutan sama.
    const tahap = tahapList
      .filter((t) => String(t.divisi) === String(divisi.id))
      .sort((x, y) => (x.urutan - y.urutan) || (x.id - y.id))[0];
    return { ...a, divisi, tahapId: tahap ? String(tahap.id) : '' };
  }).filter(Boolean);
}

export default function SpkPublishModal({
  judul, keterangan, onTerbitkan, onClose, wajib = false, labelBatal = 'Nanti saja', modeStarfoto = false,
}) {
  const { user } = useAuth();
  const bolehPilihStaff = (user?.role || '').toLowerCase() !== 'kasir';

  const [divisiList, setDivisiList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [tahapList, setTahapList] = useState([]);

  const [tipe, setTipe] = useState('divisi'); // 'divisi' | 'staff'
  const [divisiId, setDivisiId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [tahapId, setTahapId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [deadlineJam, setDeadlineJam] = useState('');

  const [memuat, setMemuat] = useState(true);
  const [mengirim, setMengirim] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        // Kasir tidak boleh menunjuk staff, jadi daftar staff tidak diambil
        // sama sekali — endpoint /users/ juga tertutup untuk peran ini.
        const [resDivisi, resStaff, resTahap] = await Promise.allSettled([
          apiClient.get('/divisi/'),
          bolehPilihStaff
            ? apiClient.get('/users/', { params: { role: 'staff' } })
            : Promise.resolve({ data: [] }),
          apiClient.get('/tahap-proses/'),
        ]);
        if (batal) return;

        const divisi = resDivisi.status === 'fulfilled' ? (resDivisi.value.data || []) : [];
        const staff = resStaff.status === 'fulfilled' ? (resStaff.value.data || []) : [];
        const tahap = resTahap.status === 'fulfilled' ? (resTahap.value.data || []) : [];

        setDivisiList(divisi);
        setStaffList(staff);
        setTahapList(tahap);
        if (divisi.length) setDivisiId(String(divisi[0].id));
      } catch {
        if (!batal) setError('Gagal memuat daftar divisi.');
      } finally {
        if (!batal) setMemuat(false);
      }
    })();
    return () => { batal = true; };
  }, [bolehPilihStaff]);

  // `tipe` efektif — kasir selalu dikunci ke divisi, apa pun isi state-nya.
  const tipeEfektif = bolehPilihStaff ? tipe : 'divisi';

  // Tahap dibatasi pada divisi terpilih; kalau kosong, backend memakai tahap
  // pertama divisi tersebut.
  const tahapTersedia = useMemo(() => {
    if (tipeEfektif !== 'divisi' || !divisiId) return [];
    return tahapList.filter((t) => String(t.divisi) === String(divisiId));
  }, [tahapList, tipeEfektif, divisiId]);

  useEffect(() => { setTahapId(''); }, [divisiId, tipeEfektif]);

  const pilihanStarfoto = useMemo(
    () => (modeStarfoto ? tujuanStarfoto(divisiList, tahapList) : []),
    [modeStarfoto, divisiList, tahapList],
  );
  const pakaiPilihanStarfoto = modeStarfoto && tipeEfektif === 'divisi' && pilihanStarfoto.length > 0;
  const [tujuanStarfotoId, setTujuanStarfotoId] = useState('');
  const tujuanStarfotoAktif = pilihanStarfoto.find((p) => String(p.divisi.id) === tujuanStarfotoId);

  const bisaKirim = (pakaiPilihanStarfoto ? !!tujuanStarfotoAktif : tipeEfektif === 'divisi' ? !!divisiId : !!staffId) && !!deadline;

  const kirim = async () => {
    if (!bisaKirim || mengirim) return;
    setMengirim(true); setError('');
    const payload = pakaiPilihanStarfoto
      ? { divisi_id: String(tujuanStarfotoAktif.divisi.id), deadline }
      : tipeEfektif === 'staff'
        ? { staff_id: staffId, deadline }
        : { divisi_id: divisiId, deadline };
    if (deadlineJam) payload.deadline_jam = deadlineJam;
    if (pakaiPilihanStarfoto) {
      if (tujuanStarfotoAktif.tahapId) payload.tahap_id = tujuanStarfotoAktif.tahapId;
    } else if (tahapId) payload.tahap_id = tahapId;
    try {
      await onTerbitkan(payload);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Gagal menerbitkan SPK.'));
      setMengirim(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={wajib ? undefined : onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Factory size={18} style={{ color: '#2783de' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{judul || 'Terbitkan SPK Produksi'}</h3>
          </div>
          {!wajib && (
            <button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: '18px 22px' }}>
          {keterangan && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#64748b', lineHeight: 1.55 }}>{keterangan}</p>}

          {memuat ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              {bolehPilihStaff ? 'Memuat divisi dan staff…' : 'Memuat daftar divisi…'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 13 }}>
              {bolehPilihStaff ? (
                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Tujukan SPK ke</span>
                  <select value={tipe} onChange={(e) => setTipe(e.target.value)}
                    style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}>
                    <option value="divisi">Divisi (antrean bersama)</option>
                    <option value="staff">Staff tertentu</option>
                  </select>
                </label>
              ) : (
                <p style={{ margin: 0, padding: '9px 11px', borderRadius: 8, background: '#f1f5f9', color: '#475569', fontSize: 12, lineHeight: 1.5 }}>
                  SPK diterbitkan ke <strong>antrean divisi</strong>. Pembagian tugas ke staff
                  dilakukan oleh kepala divisi pada papan kerja produksi.
                </p>
              )}

              {pakaiPilihanStarfoto ? (
                <div>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Arahkan ke</span>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {pilihanStarfoto.map((p) => {
                      const aktif = String(p.divisi.id) === tujuanStarfotoId;
                      return (
                        <button
                          key={p.divisi.id}
                          type="button"
                          onClick={() => setTujuanStarfotoId(String(p.divisi.id))}
                          style={{
                            textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                            border: `1px solid ${aktif ? '#0088FF' : '#cbd5e1'}`,
                            background: aktif ? '#eff6ff' : '#fff',
                          }}
                        >
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: aktif ? '#0088FF' : '#1e293b' }}>{p.label}</span>
                          <span style={{ display: 'block', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{p.ket} · divisi {p.divisi.nama}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : tipeEfektif === 'divisi' ? (
                <>
                  <label style={{ display: 'block' }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Divisi</span>
                    <select value={divisiId} onChange={(e) => setDivisiId(e.target.value)}
                      style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}>
                      {divisiList.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
                      {!divisiList.length && <option value="">Belum ada divisi</option>}
                    </select>
                  </label>
                  <label style={{ display: 'block' }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                      Tahap <span style={{ fontWeight: 500, color: '#94a3b8' }}>(opsional)</span>
                    </span>
                    <select value={tahapId} onChange={(e) => setTahapId(e.target.value)}
                      style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}>
                      <option value="">Tahap pertama divisi ini</option>
                      {tahapTersedia.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
                    </select>
                  </label>
                </>
              ) : (
                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Staff</span>
                  <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
                    style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}>
                    <option value="">Pilih staff…</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.username} ({s.divisi_nama || 'tanpa divisi'})</option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  Deadline pengerjaan <span style={{ color: '#dc2626' }}>(wajib)</span>
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    required
                    style={{ flex: 1, minWidth: 0, padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                  <input
                    type="time"
                    value={deadlineJam}
                    onChange={(event) => setDeadlineJam(event.target.value)}
                    title="Jam deadline (opsional)"
                    style={{ width: 120, padding: 9, border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                </div>
                <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  Jam opsional. Kosong = sampai akhir hari.
                </span>
              </label>
            </div>
          )}

          {error && <div style={{ marginTop: 13, padding: 10, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12.5 }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, padding: '14px 22px', borderTop: '1px solid #f1f5f9' }}>
          {!wajib && (
            <button type="button" onClick={onClose}
              style={{ padding: '9px 15px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {labelBatal}
            </button>
          )}
          <button type="button" onClick={kirim} disabled={!bisaKirim || mengirim || memuat}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', border: 0, borderRadius: 8, background: bisaKirim && !mengirim ? '#2783de' : '#cbd5e1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: bisaKirim && !mengirim ? 'pointer' : 'default' }}>
            {mengirim && <Loader2 size={14} className="animate-spin" />}
            {mengirim ? 'Menerbitkan…' : 'Terbitkan SPK'}
          </button>
        </div>
      </div>
    </div>
  );
}
