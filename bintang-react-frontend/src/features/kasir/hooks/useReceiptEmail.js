import { useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifyError, notifySuccess } from '../../../utils/notify';

export default function useReceiptEmail({ saleId, initialEmail }) {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setEmail(initialEmail || '');
  }, [initialEmail, saleId]);

  const sendReceipt = async () => {
    if (!saleId) {
      notifyError('Resi belum siap', 'Transaksi belum memiliki ID untuk pengiriman resi.');
      return;
    }
    if (!email.trim()) {
      notifyError('Email diperlukan', 'Masukkan alamat email penerima resi.');
      return;
    }

    setIsSending(true);
    try {
      const response = await apiClient.post(`/pos/sales/${saleId}/email-resi/`, { email: email.trim() });
      notifySuccess('Resi terkirim', response.data?.message || `Resi dikirim ke ${email.trim()}.`);
    } catch (error) {
      notifyApiError(error, 'Gagal mengirim resi ke email.');
    } finally {
      setIsSending(false);
    }
  };

  return { email, setEmail, isSending, sendReceipt };
}
