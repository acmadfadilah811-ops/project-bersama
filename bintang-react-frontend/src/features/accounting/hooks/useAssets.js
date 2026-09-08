import { useCallback, useEffect, useState } from 'react';
import { notifyApiError } from '../../../utils/notify';
import { createAsset, disposeAsset, fetchAssetAccounts, fetchAssets, postMonthlyDepreciation, updateAsset } from '../services/assets';

export default function useAssets() {
  const [assets, setAssets] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({ from: null, to: null, label: 'Semua Data', allDates: true });

  const reload = useCallback(async () => {
    setLoading(true);
    const assetParams = dateFilter.allDates
      ? { all_dates: true, page_size: 200 }
      : { date_from: dateFilter.from, date_to: dateFilter.to, page_size: 200 };
    const [assetResult, accountResult] = await Promise.allSettled([
      fetchAssets(assetParams),
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
  }, [dateFilter]);
  useEffect(() => { reload(); }, [reload]);

  const save = async (payload) => {
    const asset = await createAsset(payload);
    await reload();
    return asset;
  };
  const update = async (id, payload) => {
    const asset = await updateAsset(id, payload);
    await reload();
    return asset;
  };
  const postDepreciation = async (period) => {
    const result = await postMonthlyDepreciation(period);
    await reload();
    return result;
  };
  const dispose = async (id, payload) => {
    const asset = await disposeAsset(id, payload);
    await reload();
    return asset;
  };
  return { assets, accounts, loading, reload, save, update, postDepreciation, dispose, dateFilter, setDateFilter };
}
