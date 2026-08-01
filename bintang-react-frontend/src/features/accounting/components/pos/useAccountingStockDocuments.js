import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllPages } from '../../../../utils/paginatedApi';

const statusLabel = {
  draft: 'Belum Terposting',
  selesai: 'Terposting',
  batal: 'Batal',
};

const toLocalIsoDate = (date) => {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
};

export const getAccountingStockToday = () => toLocalIsoDate(new Date());

export const getAccountingStockDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalIsoDate(date);
};

export const formatAccountingStockDate = (value) => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
};

export const getAccountingStockStatus = (value) => statusLabel[value] || value || '-';

export function useAccountingStockDocuments(endpoint, { search, dateFrom, dateTo, filterStatus }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDocuments(await fetchAllPages(endpoint));
    } catch (requestError) {
      setDocuments([]);
      setError(requestError.response?.data?.detail || requestError.message || 'Data dokumen stok tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { reload(); }, [reload]);

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (dateFrom && document.tanggal < dateFrom) return false;
      if (dateTo && document.tanggal > dateTo) return false;
      if (filterStatus === 'Terposting' && document.status !== 'selesai') return false;
      if (filterStatus === 'Belum Terposting' && document.status !== 'draft') return false;
      if (!keyword) return true;
      return `${document.nomor || ''} ${document.catatan || ''} ${document.supplier || ''} ${document.transfer_ke || ''}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [dateFrom, dateTo, documents, filterStatus, search]);

  return { documents: filteredDocuments, error, loading, reload };
}
