import { useState } from 'react';
import apiClient from '../../../../api/apiClient';
import { notify, notifyApiError } from '../../../../utils/notify';

export default function usePosAutoPostSetting(settings, setSettings) {
  const [isAutoPostSaving, setIsAutoPostSaving] = useState(false);

  const toggleAutoPost = async () => {
    const nextValue = !settings.pos_auto_post_enabled;
    setIsAutoPostSaving(true);
    try {
      const response = await apiClient.patch('/accounting/settings/', {
        pos_auto_post_enabled: nextValue,
      });
      setSettings(response.data);
      notify({
        type: 'success',
        title: nextValue ? 'Memposting Otomatis Diaktifkan' : 'Memposting Otomatis Dinonaktifkan',
        message: 'Perubahan sudah disimpan dan tercatat pada Log.',
      });
    } catch (error) {
      notifyApiError(error, 'Gagal mengubah memposting otomatis POS');
    } finally {
      setIsAutoPostSaving(false);
    }
  };

  return { isAutoPostSaving, toggleAutoPost };
}
