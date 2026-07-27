import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

export default function useCaraPembayaranStep() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [cashBankAccounts, setCashBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [aturAkunOpen, setAturAkunOpen] = useState(false);
  const [aturAkunAccountId, setAturAkunAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [tambahAkunOpen, setTambahAkunOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [methodsRes, accountsRes] = await Promise.all([
        apiClient.get('/accounting/payment-methods/'),
        apiClient.get('/accounting/cash-bank-accounts/'),
      ]);
      setPaymentMethods(methodsRes.data || []);
      setCashBankAccounts(accountsRes.data || []);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat daftar Cara Pembayaran');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleSelected = (id, isLocked) => {
    if (isLocked) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const selectableIds = paymentMethods.filter((m) => !m.is_locked).map((m) => m.id);
    setSelectedIds((prev) => (prev.length === selectableIds.length ? [] : selectableIds));
  };

  const openAturAkun = () => {
    setAturAkunAccountId(cashBankAccounts[0]?.account ? String(cashBankAccounts[0].account) : '');
    setAturAkunOpen(true);
  };

  const cancelAturAkun = () => {
    setAturAkunOpen(false);
    setAturAkunAccountId('');
  };

  // Preview akun pembayaran baris tercentang, sebelum "Perbarui" benar-benar ditekan.
  const previewAccountFor = (paymentMethod) => {
    if (aturAkunOpen && selectedIds.includes(paymentMethod.id) && aturAkunAccountId) {
      const picked = cashBankAccounts.find((a) => String(a.account) === String(aturAkunAccountId));
      if (picked) return { code: picked.account_code, name: picked.account_name };
    }
    return { code: paymentMethod.account_code, name: paymentMethod.account_name };
  };

  const submitAturAkun = async () => {
    if (!aturAkunAccountId || selectedIds.length === 0) return;
    setSaving(true);
    try {
      await apiClient.post('/accounting/payment-methods/bulk-update-account/', {
        payment_method_ids: selectedIds,
        account: Number(aturAkunAccountId),
      });
      await fetchAll();
      setSelectedIds([]);
      cancelAturAkun();
    } catch (err) {
      notifyApiError(err, 'Gagal memperbarui Akun Pembayaran');
    } finally {
      setSaving(false);
    }
  };

  return {
    paymentMethods,
    cashBankAccounts,
    loading,
    selectedIds,
    toggleSelected,
    toggleSelectAll,
    aturAkunOpen,
    aturAkunAccountId,
    setAturAkunAccountId,
    openAturAkun,
    cancelAturAkun,
    submitAturAkun,
    saving,
    previewAccountFor,
    tambahAkunOpen,
    setTambahAkunOpen,
    refetch: fetchAll,
  };
}
