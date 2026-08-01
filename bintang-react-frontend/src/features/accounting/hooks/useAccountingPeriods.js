import { useCallback, useEffect, useState } from 'react';
import { notifyApiError } from '../../../utils/notify';
import { fetchAccountingPeriods } from '../services/periods';

export default function useAccountingPeriods(fiscalYear) {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPeriods(await fetchAccountingPeriods(fiscalYear));
    } catch (error) {
      setPeriods([]);
      notifyApiError(error, 'Gagal memuat daftar periode tutup buku');
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => { reload(); }, [reload]);
  return { periods, loading, reload };
}
