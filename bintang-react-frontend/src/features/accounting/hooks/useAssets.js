import { useCallback, useEffect, useState } from 'react';
import { notifyApiError } from '../../../utils/notify';
import { createAsset, fetchAssetAccounts, fetchAssets } from '../services/assets';

export default function useAssets() {
  const [assets, setAssets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const [assetResult, accountResult] = await Promise.allSettled([
      fetchAssets({ all_dates: true, page_size: 200 }),
      fetchAssetAccounts(),
    ]);
    if (assetResult.status === 'fulfilled') {
      setAssets(assetResult.value);
    } else {
      notifyApiError(assetResult.reason, 'Gagal memuat daftar aset');
    }
    if (accountResult.status === 'fulfilled') {
      setAccounts(accountResult.value);
    } else {
      notifyApiError(accountResult.reason, 'Gagal memuat daftar akun untuk aset');
    }
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const save = async (payload) => {
    const asset = await createAsset(payload);
    await reload();
    return asset;
  };
  return { assets, accounts, loading, reload, save };
}
