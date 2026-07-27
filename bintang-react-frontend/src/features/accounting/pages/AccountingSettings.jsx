import { useState } from 'react';
import { Square, Loader2 } from 'lucide-react';
import useAccountingSettings from '../hooks/useAccountingSettings';
import AccountingLifecycleLogModal from '../components/AccountingLifecycleLogModal';
import HentikanAkuntansiModal from '../components/HentikanAkuntansiModal';
import EmptyAccountingSetupState from '../components/EmptyAccountingSetupState';
import MasukanSaldoAwalModal from '../components/MasukanSaldoAwalModal';
import PengaturanAwalWizard from '../components/wizard/PengaturanAwalWizard';
import JournalSettingsColumn from '../components/settings/JournalSettingsColumn';
import ProductSettingsColumn from '../components/settings/ProductSettingsColumn';

export default function AccountingSettings({ accountingSettingsProps }) {
  const defaultSettings = useAccountingSettings();
  const {
    settings,
    loading,
    saving,
    fetchSettings,
    handleChange,
    handleToggle,
    handleFieldBlur,
    stopAccounting,
    startAccounting,
  } = accountingSettingsProps || defaultSettings;

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saldoAwalOpen, setSaldoAwalOpen] = useState(false);

  const needsSetup = !loading && (!settings.initial_setup_completed_at || !settings.is_active);

  const handleSetupComplete = async () => {
    setWizardOpen(false);
    await fetchSettings();
    setSaldoAwalOpen(true);
  };

  const handleToggleClick = () => {
    if (settings.is_active) {
      setIsStopModalOpen(true);
    } else {
      startAccounting();
    }
  };

  const handleConfirmStop = async ({ deleteData }) => {
    const ok = await stopAccounting({ deleteData });
    if (ok) {
      setIsStopModalOpen(false);
    }
  };

  return (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
          <Loader2 size={32} className="animate-spin mb-3 text-[#0088E8]" />
          <p className="text-xs font-semibold">Memuat Pengaturan Akuntansi...</p>
        </div>
      ) : needsSetup ? (
        <EmptyAccountingSetupState onStart={() => setWizardOpen(true)} />
      ) : (
        <div className="space-y-4 animate-fade-in pb-12">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Pengaturan Akuntansi</h2>
            <button
              type="button"
              onClick={handleToggleClick}
              disabled={saving}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-2xs transition-all cursor-pointer ${
                settings.is_active
                  ? 'bg-[#FF4D4F] hover:bg-rose-600 border border-rose-600/20'
                  : 'bg-emerald-500 hover:bg-emerald-600 border border-emerald-600/20'
              }`}
            >
              <Square size={13} className="fill-current" />
              <span>{settings.is_active ? 'Hentikan Sekarang' : 'Mulai Sekarang'}</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              <JournalSettingsColumn
                settings={settings}
                onChange={handleChange}
                onBlur={handleFieldBlur}
                onToggle={handleToggle}
                onOpenLogModal={() => setIsLogModalOpen(true)}
              />
              <ProductSettingsColumn settings={settings} onToggle={handleToggle} />
            </div>
          </div>

          <AccountingLifecycleLogModal isOpen={isLogModalOpen} onClose={() => setIsLogModalOpen(false)} />
          <HentikanAkuntansiModal
            isOpen={isStopModalOpen}
            onClose={() => setIsStopModalOpen(false)}
            onConfirm={handleConfirmStop}
            loading={saving}
          />
        </div>
      )}

      {wizardOpen && (
        <PengaturanAwalWizard
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onSetupComplete={handleSetupComplete}
        />
      )}
      <MasukanSaldoAwalModal isOpen={saldoAwalOpen} onClose={() => setSaldoAwalOpen(false)} />
    </>
  );
}
