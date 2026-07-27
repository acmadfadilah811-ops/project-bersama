import { X } from 'lucide-react';
import usePengaturanAwalWizard from '../../hooks/usePengaturanAwalWizard';
import WizardStepHeader from './WizardStepHeader';
import CaraPembayaranStep from './CaraPembayaranStep';
import PengaturanAkuntansiStep from './PengaturanAkuntansiStep';
import RingkasanStep from './RingkasanStep';

export default function PengaturanAwalWizard({ isOpen, onClose, onSetupComplete }) {
  const wizard = usePengaturanAwalWizard({ onSetupComplete });

  if (!isOpen) return null;

  const {
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
  } = wizard;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-4xl w-full flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-bold text-slate-900">Pengaturan Awal</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6">
          <WizardStepHeader
            steps={STEPS}
            currentStep={currentStep}
            furthestStep={furthestStep}
            onSelectStep={goToStep}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentStep === 1 && (
            <CaraPembayaranStep caraPembayaran={caraPembayaran} onNext={() => advanceTo(2)} />
          )}
          {currentStep === 2 && (
            <PengaturanAkuntansiStep
              dueDays={dueDays}
              setDueDays={setDueDays}
              useStockAsCapital={useStockAsCapital}
              setUseStockAsCapital={setUseStockAsCapital}
              canProceed={canProceedStep2}
              onNext={() => advanceTo(3)}
            />
          )}
          {currentStep === 3 && (
            <RingkasanStep
              startDate={startDate}
              setStartDate={setStartDate}
              useStockAsCapital={useStockAsCapital}
              submitting={submitting}
              onMulai={completeSetup}
            />
          )}
        </div>
      </div>
    </div>
  );
}
