import { useRef, useState } from 'react';
import { FileText, Trash2, Plus, History, ChevronRight, AlertCircle } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import CustomerCombobox from './CustomerCombobox';
import TagMultiSelect from './TagMultiSelect';

const inputCls = 'w-full h-11 rounded-xl border border-slate-200 px-3.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 shadow-sm transition-all duration-150';
const labelCls = 'text-xs font-bold text-slate-700 mb-1.5 block';

const MAX_DOCS = 5;
const MAX_DOC_SIZE = 5 * 1024 * 1024;

const isAllowedFile = (file) => file.type.startsWith('image/') || file.type === 'application/pdf';

export default function CustomerNoteModal({ note, customers = [], allTags = [], defaultCustomerId, onClose, onSaved }) {
  const isEdit = !!note;
  const fileRef = useRef(null);

  const [judul, setJudul] = useState(note?.judul || '');
  const [customerId, setCustomerId] = useState(
    note?.customer 
      ? String(note.customer) 
      : (defaultCustomerId ? String(defaultCustomerId) : '')
  );
  const [tanggal, setTanggal] = useState(note?.tanggal || new Date().toISOString().slice(0, 10));
  const [jam, setJam] = useState(note?.jam ? note.jam.slice(0, 5) : new Date().toTimeString().slice(0, 5));
  const [tags, setTags] = useState(note?.tags || []);
  const [existingDocuments, setExistingDocuments] = useState(note?.documents || []);
  const [draftDocuments, setDraftDocuments] = useState([]);
  const [existingEntries, setExistingEntries] = useState(note?.entries || []);
  const [draftEntries, setDraftEntries] = useState([]);
  const [entryLabel, setEntryLabel] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const totalDocCount = existingDocuments.length + draftDocuments.length;

  const addFiles = (list) => {
    if (!list?.length) return;
    const room = MAX_DOCS - totalDocCount;
    if (room <= 0) {
      setError(`Maksimal ${MAX_DOCS} dokumen per catatan.`);
      return;
    }
    const accepted = [];
    for (const f of Array.from(list).slice(0, room)) {
      if (!isAllowedFile(f)) { setError('File harus berupa gambar atau PDF.'); continue; }
      if (f.size > MAX_DOC_SIZE) { setError(`"${f.name}" melebihi 5MB.`); continue; }
      accepted.push(f);
    }
    if (accepted.length) setDraftDocuments((prev) => [...prev, ...accepted]);
  };

  const removeDraftDocument = (idx) => setDraftDocuments((prev) => prev.filter((_, i) => i !== idx));

  const deleteExistingDocument = async (doc) => {
    if (!window.confirm('Hapus dokumen ini?')) return;
    try {
      await apiClient.delete(`/customer-note-documents/${doc.id}/`);
      setExistingDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      console.error('[CustomerNoteModal] delete document error:', err);
    }
  };

  const addDraftEntry = () => {
    if (!entryContent.trim()) return;
    setDraftEntries((prev) => [...prev, { label: entryLabel.trim(), content: entryContent.trim() }]);
    setEntryLabel('');
    setEntryContent('');
  };

  const removeDraftEntry = (idx) => setDraftEntries((prev) => prev.filter((_, i) => i !== idx));

  const deleteExistingEntry = async (entry) => {
    if (!window.confirm('Hapus entri catatan ini?')) return;
    try {
      await apiClient.delete(`/customer-note-entries/${entry.id}/`);
      setExistingEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      console.error('[CustomerNoteModal] delete entry error:', err);
    }
  };

  const handleSave = async () => {
    if (!judul.trim()) {
      setError('Judul catatan wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        customer: customerId || null,
        judul: judul.trim(),
        tanggal: tanggal || null,
        jam: jam || null,
        tag_names: tags,
      };
      let noteId = note?.id;
      if (isEdit) {
        await apiClient.patch(`/customer-notes/${noteId}/`, payload);
      } else {
        const res = await apiClient.post('/customer-notes/', payload);
        noteId = res.data.id;
      }

      for (const file of draftDocuments) {
        const formData = new FormData();
        formData.append('note', noteId);
        formData.append('file', file);
        await apiClient.post('/customer-note-documents/', formData, { headers: { 'Content-Type': undefined } });
      }

      for (const entry of draftEntries) {
        await apiClient.post('/customer-note-entries/', { note: noteId, label: entry.label, content: entry.content });
      }

      onSaved?.();
    } catch (err) {
      console.error('[CustomerNoteModal] save error:', err);
      const data = err.response?.data;
      const msg = data && typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
        : 'Gagal menyimpan catatan.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!window.confirm('Hapus catatan ini beserta seluruh entri dan dokumen?')) return;
    try {
      await apiClient.delete(`/customer-notes/${note.id}/`);
      onSaved?.();
    } catch (err) {
      console.error('[CustomerNoteModal] delete note error:', err);
      setError('Gagal menghapus catatan.');
    }
  };

  const formatHistoryDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const pad = (num) => String(num).padStart(2, '0');
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50 flex flex-col overflow-y-auto animate-fade-in">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <h3 className="font-bold text-slate-800 text-base md:text-lg mx-auto">Catatan Pelanggan</h3>
        <div className="flex items-center gap-3 absolute right-6">
          <button 
            type="button" 
            onClick={onClose} 
            className="text-xs md:text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl px-4 py-2 cursor-pointer shadow-sm transition-all duration-150"
          >
            Batal
          </button>
          <button 
            type="button" 
            disabled={saving} 
            onClick={handleSave} 
            className="text-xs md:text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl px-4 py-2 cursor-pointer shadow-md shadow-green-100 transition-all duration-150 disabled:opacity-60 disabled:shadow-none"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs md:text-sm text-red-700 flex items-start gap-2.5 shadow-sm">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Kolom Kiri */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className={labelCls}>Judul catatan</label>
              <input 
                value={judul} 
                onChange={(e) => setJudul(e.target.value)} 
                className={inputCls} 
                placeholder="Masukkan judul catatan"
              />
            </div>
            <div>
              <label className={labelCls}>Pembeli</label>
              <CustomerCombobox 
                value={customerId} 
                onChange={setCustomerId} 
                customers={customers} 
                placeholder="Pilih Pembeli" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tanggal</label>
                <input 
                  type="date" 
                  value={tanggal} 
                  onChange={(e) => setTanggal(e.target.value)} 
                  className={inputCls} 
                />
              </div>
              <div>
                <label className={labelCls}>
                  Jam <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded ml-1">Jam</span>
                </label>
                <input 
                  type="time" 
                  value={jam} 
                  onChange={(e) => setJam(e.target.value)} 
                  className={inputCls} 
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tag</label>
              <TagMultiSelect 
                value={tags} 
                onChange={setTags} 
                options={allTags} 
              />
            </div>
            <div>
              <label className={labelCls}>Dokumen (Maks. {MAX_DOCS} Dokumen)</label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => totalDocCount < MAX_DOCS && fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                className={`w-full border-2 border-dashed rounded-2xl py-8 px-4 flex flex-col items-center justify-center gap-2 text-center transition-all duration-200 ${
                  totalDocCount < MAX_DOCS 
                    ? 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer' 
                    : 'border-slate-100 opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="text-sm font-semibold text-slate-700">Seret file Anda ke sini</span>
                <span className="text-xs text-slate-400">atau</span>
                <button
                  type="button"
                  className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all duration-150 mt-1 cursor-pointer"
                >
                  <FileText size={14} /> Pilih file
                </button>
              </div>
              <input 
                ref={fileRef} 
                type="file" 
                accept="image/*,application/pdf" 
                multiple 
                className="hidden" 
                onChange={(e) => addFiles(e.target.files)} 
              />
              <p className="text-[11px] text-slate-400 mt-1.5">Gambar atau PDF maks. 5 MB</p>

              {(existingDocuments.length > 0 || draftDocuments.length > 0) && (
                <ul className="mt-4 space-y-2">
                  {existingDocuments.map((doc) => (
                    <li key={`existing-${doc.id}`} className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 hover:bg-slate-100 transition-colors">
                      <a href={doc.file} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline truncate font-semibold">
                        <FileText size={14} className="shrink-0" /> {doc.original_name || 'Dokumen'}
                      </a>
                      <button type="button" onClick={() => deleteExistingDocument(doc)} className="text-slate-400 hover:text-red-600 cursor-pointer shrink-0 ml-2 p-1 rounded-lg hover:bg-slate-200/50 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                  {draftDocuments.map((file, idx) => (
                    <li key={`draft-${idx}`} className="flex items-center justify-between text-xs text-slate-600 bg-blue-50/30 rounded-xl px-3 py-2 border border-blue-50 hover:bg-blue-50/50 transition-colors">
                      <span className="flex items-center gap-2 truncate font-semibold text-slate-700">
                        <FileText size={14} className="text-blue-500 shrink-0" /> {file.name}
                      </span>
                      <button type="button" onClick={() => removeDraftDocument(idx)} className="text-slate-400 hover:text-red-600 cursor-pointer shrink-0 ml-2 p-1 rounded-lg hover:bg-blue-100/50 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isEdit && (
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2 flex-wrap">
                    <History size={16} className="text-slate-400 shrink-0" />
                    <span>Diubah oleh <span className="font-semibold text-slate-800">{note.dibuat_oleh_nama || 'Staf'}</span> pada {formatHistoryDate(note.created_at)}</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                </div>

                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 text-rose-600 font-bold py-3 rounded-xl transition-all duration-150 cursor-pointer"
                >
                  <Trash2 size={16} />
                  Hapus catatan
                </button>
              </div>
            )}
          </div>

          {/* Kolom Kanan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Catatan</h4>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white focus-within:ring-1 focus-within:ring-blue-400 focus-within:border-blue-400">
              <input 
                value={entryLabel} 
                onChange={(e) => setEntryLabel(e.target.value)} 
                placeholder="Label (Opsional)" 
                className="w-full h-11 px-3.5 text-xs text-slate-800 outline-none border-b border-slate-100 bg-white"
              />
              <textarea 
                value={entryContent} 
                onChange={(e) => setEntryContent(e.target.value)} 
                placeholder="Catatan" 
                rows={4} 
                className="w-full p-3.5 text-xs text-slate-800 outline-none resize-none bg-white"
              />
            </div>

            <button
              type="button"
              onClick={addDraftEntry}
              disabled={!entryContent.trim()}
              className={`w-full flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg py-2.5 mt-3 transition-colors ${
                entryContent.trim() 
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 cursor-pointer shadow-sm' 
                  : 'bg-slate-50 text-slate-400 border border-slate-100 cursor-not-allowed'
              }`}
            >
              <Plus size={14} /> Tambah Catatan
            </button>

            {(existingEntries.length > 0 || draftEntries.length > 0) && (
              <div className="mt-6 space-y-3">
                {existingEntries.map((entry) => (
                  <div key={`existing-${entry.id}`} className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative hover:bg-slate-100/50 transition-colors">
                    {entry.label && <p className="text-xs font-bold text-slate-700 mb-1">{entry.label}</p>}
                    <p className="text-xs text-slate-600 whitespace-pre-wrap pr-6 leading-relaxed">{entry.content}</p>
                    <button type="button" onClick={() => deleteExistingEntry(entry)} className="absolute top-3.5 right-3.5 text-slate-400 hover:text-red-600 cursor-pointer transition-colors p-1 rounded hover:bg-slate-200/50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {draftEntries.map((entry, idx) => (
                  <div key={`draft-${idx}`} className="bg-blue-50/20 border border-blue-100/50 rounded-xl p-4 relative hover:bg-blue-50/40 transition-colors">
                    {entry.label && <p className="text-xs font-bold text-blue-800 mb-1">{entry.label}</p>}
                    <p className="text-xs text-slate-600 whitespace-pre-wrap pr-6 leading-relaxed">{entry.content}</p>
                    <button type="button" onClick={() => removeDraftEntry(idx)} className="absolute top-3.5 right-3.5 text-slate-400 hover:text-red-600 cursor-pointer transition-colors p-1 rounded hover:bg-blue-100/50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
