import { useState } from 'react';
import { Bot, HelpCircle, Tag, Wrench } from 'lucide-react';
import PosHeaderBar from '../components/PosHeaderBar';
import WaBotPromptPanel from '../components/WaBotPromptPanel';
import WaBotToolsPanel from '../components/WaBotToolsPanel';
import WaBotFaqPanel from '../components/WaBotFaqPanel';
import PricelistWaBotPanel from '../components/PricelistWaBotPanel';

const TABS = [
  { id: 'prompt', label: 'Prompt AI', icon: Bot },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'pricelist', label: 'Pricelist', icon: Tag },
];

/**
 * Kasir > Pengaturan WA Bot -- konfigurasi "otak" AI WhatsApp (prompt,
 * tools aktif/nonaktif, FAQ, pricelist), owner/manager only (lihat
 * KasirSidebar.jsx & KasirApp.jsx). Kredensial/koneksi WA (QR pairing)
 * TETAP di Settings > WhatsApp Gateway, tidak dipindah ke sini.
 */
export default function PengaturanWaBotPage({ onToggleSidebar }) {
  const [activeTab, setActiveTab] = useState('prompt');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden w-full select-none">
      <PosHeaderBar onToggleSidebar={onToggleSidebar} />

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-200 overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-4 py-3 text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-all
                      ${isActive
                        ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Icon size={14} /> {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {activeTab === 'prompt' && <WaBotPromptPanel />}
              {activeTab === 'tools' && <WaBotToolsPanel />}
              {activeTab === 'faq' && <WaBotFaqPanel />}
              {activeTab === 'pricelist' && <PricelistWaBotPanel />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
