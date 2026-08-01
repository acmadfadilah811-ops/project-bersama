import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

export default function useAccountingReturnList(endpoint) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(endpoint);
      const data = response.data;
      setRows(data?.results || data || []);
    } catch (error) {
      setRows([]);
      notifyApiError(error, 'Gagal memuat data return.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, reload };
}
