import { useMemo, useState } from 'react';
import apiClient from '../../../../api/apiClient';
import { notify, notifyApiError } from '../../../../utils/notify';

// Post/Batal Post dokumen stok (Stok Masuk/Keluar/Opname): hanya dokumen draft
// yang bisa diproses — post-document mengubah draft->selesai (stok+jurnal
// nyata), cancel mengubah draft->batal. Dipakai bersama oleh 3 halaman supaya
// tidak triplikasi logic bulk-select yang sama.
export default function useAccountingStockBulkActions(endpoint, documents, reload) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const visibleIds = useMemo(() => documents.map((doc) => doc.id), [documents]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleRow = (id) => setSelectedIds((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]);

  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleIds.includes(id))
    : [...new Set([...current, ...visibleIds])]);

  const runBulk = async (action, actionName) => {
    const eligible = documents.filter((doc) => selectedIds.includes(doc.id) && doc.status === 'draft');
    const skipped = selectedIds.length - eligible.length;
    if (!eligible.length) {
      notify({ type: 'info', title: 'Tidak ada data yang dapat diproses', message: 'Pilih dokumen berstatus Belum Terposting.' });
      return;
    }
    if (action === 'cancel' && !window.confirm(`Batalkan ${eligible.length} dokumen terpilih?`)) return;

    setActionLoading(true);
    const results = await Promise.allSettled(eligible.map((doc) => apiClient.post(`${endpoint}${doc.id}/${action}/`)));
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.find((result) => result.status === 'rejected');
    if (successCount) {
      notify({
        type: 'success', title: `${actionName} berhasil`,
        message: `${successCount} dokumen berhasil diproses.${skipped ? ` ${skipped} dilewati karena bukan status Belum Terposting.` : ''}`,
      });
    }
    if (failed) notifyApiError(failed.reason, `Gagal menjalankan ${actionName.toLowerCase()} untuk sebagian dokumen.`);
    setSelectedIds([]);
    await reload();
    setActionLoading(false);
  };

  return {
    selectedIds, toggleRow, toggleAllVisible, allVisibleSelected, actionLoading,
    handlePost: () => runBulk('post-document', 'Post'),
    handleBatalPost: () => runBulk('cancel', 'Batal Post'),
  };
}
