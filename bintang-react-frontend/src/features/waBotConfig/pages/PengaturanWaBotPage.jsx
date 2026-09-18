import { useState } from 'react';
import { BarChart3, Bot, HelpCircle, MessageSquare, Tag, Wrench } from 'lucide-react';
import WaBotStatsPanel from '../components/WaBotStatsPanel';
import WhatsAppGatewayPanel from '../components/WhatsAppGatewayPanel';
import WaBotPromptPanel from '../components/WaBotPromptPanel';
import WaBotToolsPanel from '../components/WaBotToolsPanel';
import WaBotFaqPanel from '../components/WaBotFaqPanel';
import PricelistWaBotPanel from '../components/PricelistWaBotPanel';

const TABS = [
  { id: 'statistik', label: 'Statistik', icon: BarChart3 },
  { id: 'gateway', label: 'WhatsApp Gateway', icon: MessageSquare },
  { id: 'prompt', label: 'Prompt AI', icon: Bot },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'pricelist', label: 'Pricelist', icon: Tag },
];

/**
 * Halaman tersendiri (BUKAN di dalam Settings atau Kasir) utk semua
 * konfigurasi bot WhatsApp: koneksi (WhatsApp Gateway, dipindah dari
 * Settings.jsx), prompt AI, tools, FAQ, pricelist. Awalnya sempat
 * ditaruh di dalam Kasir, tapi owner/manager MEMANG DIKUNCI tidak boleh
 * masuk area Kasir sama sekali (lihat permissions.js hasMenuAccess,
 * instruksi user 2026-08-14) -- jadi dipindah jadi menu utama sendiri
 * (instruksi user 2026-09-18) supaya owner/manager bisa mengaksesnya.
 * Route `/pengaturan-wa-bot`, terdaftar di Sidebar.jsx & permissions.js
 * (featureId 'wa-bot-config').
 */
export default function PengaturanWaBotPage() {
  const [activeTab, setActiveTab] = useState('statistik');

  return (
    <div className="max-w-5xl mx-auto px-4 pt-2 pb-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Bot size={22} className="text-indigo-600" /> Pengaturan WA Bot
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Koneksi WhatsApp, prompt AI, tools, FAQ, dan pricelist yang dipakai bot membalas pelanggan.
        </p>
      </div>

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
          {activeTab === 'statistik' && <WaBotStatsPanel />}
          {activeTab === 'gateway' && <WhatsAppGatewayPanel />}
          {activeTab === 'prompt' && <WaBotPromptPanel />}
          {activeTab === 'tools' && <WaBotToolsPanel />}
          {activeTab === 'faq' && <WaBotFaqPanel />}
          {activeTab === 'pricelist' && <PricelistWaBotPanel />}
        </div>
      </div>
    </div>
  );
}
