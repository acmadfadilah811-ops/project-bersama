import { useState } from 'react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import useCaraPembayaranStep from './useCaraPembayaranStep';

const STEPS = [
  { id: 1, label: '1. Cara Pembayaran' },
  { id: 2, label: '2. Pengaturan Akuntansi' },
  { id: 3, label: '3. Ringkasan' },
];

export default function usePengaturanAwalWizard({ onSetupComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);

  const caraPembayaran = useCaraPembayaranStep();

  // Step 2
  const [dueDays, setDueDays] = useState('');
  const [useStockAsCapital, setUseStockAsCapital] = useState(false);

  // Step 3
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const goToStep = (stepId) => {
    if (stepId <= furthestStep) setCurrentStep(stepId);
  };

  const advanceTo = (stepId) => {
    setCurrentStep(stepId);
    setFurthestStep((prev) => Math.max(prev, stepId));
  };

  const canProceedStep2 = dueDays !== '' && dueDays !== null && Number(dueDays) >= 0;

  const completeSetup = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/accounting/settings/complete-setup/', {
        accounting_start_date: startDate,
        default_payment_due_days: Number(dueDays) || 0,
      });
      onSetupComplete?.();
    } catch (err) {
      notifyApiError(err, 'Gagal menyelesaikan Pengaturan Awal');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    STEPS,
    currentStep,
    furthestStep,
    goToStep,
    advanceTo,
    caraPembayaran,
    dueDays,
    setDueDays,
    useStockAsCapital,
    setUseStockAsCapital,
    canProceedStep2,
    startDate,
    setStartDate,
    submitting,
    completeSetup,
  };
}
