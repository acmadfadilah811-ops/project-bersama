import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

const DEFAULT_SETTINGS = {
  id: null,
  accounting_start_date: new Date().toISOString().split('T')[0],
  default_payment_due_days: 0,
  reminder_days_before_due: 0,
  send_ar_due_email: false,
  enable_transfer_between_stores_as_sale: false,
  calculate_coa_from_this_year: false,
  enable_product_account_group: false,
  is_ppn_active: false,
  ppn_rate_percent: '0.00',
  enable_ojek_online_fee: true,
  show_inventory_in_profit_loss: true,
  is_active: true,
  initial_setup_completed_at: null,
};

export default function useAccountingSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/accounting/settings/');
      if (res.data) setSettings(res.data);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat pengaturan akuntansi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Olsera tidak punya tombol "Simpan Pengaturan" — tiap field tersimpan sendiri
  // (toggle langsung saat diklik, field teks/angka/tanggal saat blur), jadi
  // patchSettings selalu menerima payload spesifik, bukan seluruh objek settings.
  const patchSettings = async (payload) => {
    setSaving(true);
    try {
      const res = await apiClient.patch('/accounting/settings/', payload);
      if (res.data) setSettings(res.data);
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan perubahan pengaturan');
      fetchSettings(); // balikkan ke nilai server kalau optimistic update gagal
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key) => {
    const nextValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: nextValue }));
    patchSettings({ [key]: nextValue });
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleFieldBlur = (key) => {
    patchSettings({ [key]: settings[key] });
  };

  const stopAccounting = async ({ deleteData = false } = {}) => {
    setSaving(true);
    try {
      const res = await apiClient.patch('/accounting/settings/', {
        is_active: false,
        delete_data: deleteData,
      });
      if (res.data) setSettings(res.data);
      return true;
    } catch (err) {
      notifyApiError(err, 'Gagal menghentikan modul akuntansi');
      fetchSettings();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startAccounting = async () => {
    setSaving(true);
    try {
      const res = await apiClient.patch('/accounting/settings/', {
        is_active: true,
      });
      if (res.data) setSettings(res.data);
      return true;
    } catch (err) {
      notifyApiError(err, 'Gagal mengaktifkan modul akuntansi');
      fetchSettings();
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActiveState = () => {
    const nextState = !settings.is_active;
    const confirmMsg = nextState
      ? 'Apakah Anda yakin ingin MENGAKTIFKAN kembali modul Akuntansi Internal?'
      : 'Apakah Anda yakin ingin MENGHENTIKAN modul Akuntansi Internal?';

    if (window.confirm(confirmMsg)) {
      setSettings((prev) => ({ ...prev, is_active: nextState }));
      patchSettings({ is_active: nextState });
    }
  };

  return {
    settings,
    loading,
    saving,
    fetchSettings,
    handleChange,
    handleToggle,
    handleFieldBlur,
    handleToggleActiveState,
    stopAccounting,
    startAccounting,
  };
}

