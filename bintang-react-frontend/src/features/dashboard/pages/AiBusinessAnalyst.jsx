import ExecutiveNav from '../components/ExecutiveNav';
import AiChatPanel from '../components/AiChatPanel';

// Data mentah (penjualan, stok, HR, CRM, dst.) sudah tersedia di tab
// Ringkasan & Operasional -- halaman ini khusus tempat menganalisisnya
// lewat tanya-jawab AI, bukan menampilkan ulang chart/tabel statis.
export default function AiBusinessAnalyst() {
  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto px-4 pb-4 flex flex-col h-[calc(100vh-2rem)]">
      <ExecutiveNav />

      <header>
        <h1 className="text-xl font-black text-slate-900">AI Business Analyst</h1>
        <p className="text-xs text-slate-500 mt-1">Tanya jawab seputar data Bintang, HR, dan CRM</p>
      </header>

      <div className="flex-1 min-h-0">
        <AiChatPanel />
      </div>
    </div>
  );
}
