import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, MessageSquare, Plus, Send, Trash2, User, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../../../api/apiClient';

// Riwayat percakapan disimpan lokal per-browser (localStorage), BUKAN di
// server -- jadi belum sinkron lintas perangkat. Jawaban AI-nya sendiri
// sudah dari backend sungguhan (KoboiLLM, lihat AiBusinessAnalystChatView),
// cuma histori percakapannya yang masih client-only.
const STORAGE_KEY = 'bintang_ai_chat_conversations_v1';

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage penuh/diblokir browser -- percakapan tetap jalan di sesi ini, cuma tidak tersimpan
  }
}

function buatPercakapanBaru() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Percakapan baru',
    messages: [],
    updatedAt: Date.now(),
  };
}

const SARAN_PERTANYAAN = [
  'Gimana ringkasan penjualan bulan ini?',
  'Produk apa yang paling lemah tapi masih laku?',
  'Ada karyawan yang sering telat minggu ini?',
  'Bagaimana tren pipeline penjualan CRM?',
];

// react-markdown tidak menerapkan gaya apa pun ke elemen HTML yang dihasilkan --
// project ini tidak pakai plugin @tailwindcss/typography, jadi tiap elemen
// markdown perlu class Tailwind eksplisit di sini.
const MARKDOWN_COMPONENTS = {
  p: (props) => <p className="my-1.5 leading-relaxed" {...props} />,
  h1: (props) => <h1 className="text-base font-black mt-3 mb-1.5" {...props} />,
  h2: (props) => <h2 className="text-sm font-black mt-3 mb-1.5" {...props} />,
  h3: (props) => <h3 className="text-sm font-bold mt-2 mb-1" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...props} />,
  li: (props) => <li {...props} />,
  strong: (props) => <strong className="font-bold" {...props} />,
  a: (props) => <a className="text-blue-600 underline" target="_blank" rel="noreferrer" {...props} />,
  code: (props) => <code className="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono" {...props} />,
  table: (props) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border-collapse" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-slate-50" {...props} />,
  th: (props) => <th className="text-left font-bold px-2 py-1 border border-slate-200" {...props} />,
  td: (props) => <td className="px-2 py-1 border border-slate-200" {...props} />,
};

function GelembungPesan({ pesan }) {
  const isUser = pesan.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{pesan.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
            {pesan.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function KonfirmasiHapus({ konfirmasi, onKonfirmasi, onBatal }) {
  if (!konfirmasi) return null;
  const semua = konfirmasi.type === 'semua';
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 flex flex-col items-center text-center">
        <div className="p-3 rounded-full mb-3 bg-rose-50 text-rose-500">
          <Trash2 size={22} />
        </div>
        <h3 className="text-sm font-extrabold text-slate-900 mb-1.5">
          {semua ? 'Hapus semua riwayat?' : 'Hapus percakapan ini?'}
        </h3>
        <p className="text-xs text-slate-500 mb-5">
          {semua
            ? 'Semua riwayat percakapan akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.'
            : 'Percakapan ini akan dihapus permanen.'}
        </p>
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={onBatal}
            className="flex-1 py-2.5 rounded-xl font-bold text-xs text-slate-600 border border-slate-200 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onKonfirmasi}
            className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

function IndikatorMengetik() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-slate-200 text-slate-600">
        <Bot size={14} />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" />
      </div>
    </div>
  );
}

function pesanErrorAI(error) {
  const detail = error?.response?.data?.error;
  if (detail) return `Maaf, AI gagal menjawab: ${detail}`;
  if (error?.code === 'ECONNABORTED') return 'Maaf, AI butuh waktu terlalu lama menjawab. Coba lagi.';
  return 'Maaf, terjadi kesalahan saat menghubungi AI. Coba lagi sebentar lagi.';
}

/** Panel tanya-jawab AI -- ditanam sebagai salah satu tab di halaman AI Business Analyst. */
export default function AiChatPanel() {
  const [conversations, setConversations] = useState(() => {
    const stored = loadConversations();
    return stored.length ? stored : [buatPercakapanBaru()];
  });
  const [activeId, setActiveId] = useState(() => conversations[0]?.id);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const [konfirmasi, setKonfirmasi] = useState(null);

  const active = conversations.find((c) => c.id === activeId) || conversations[0];

  useEffect(() => { saveConversations(conversations); }, [conversations]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active?.messages, isThinking]);

  const percakapanBaru = useCallback(() => {
    const baru = buatPercakapanBaru();
    setConversations((prev) => [baru, ...prev]);
    setActiveId(baru.id);
    setDraft('');
  }, []);

  const mintaHapusPercakapan = useCallback((id, e) => {
    e.stopPropagation();
    setKonfirmasi({ type: 'satu', id });
  }, []);

  const mintaHapusSemua = useCallback(() => {
    setKonfirmasi({ type: 'semua' });
  }, []);

  const eksekusiKonfirmasi = useCallback(() => {
    if (konfirmasi?.type === 'semua') {
      const baru = buatPercakapanBaru();
      setConversations([baru]);
      setActiveId(baru.id);
      setDraft('');
    } else if (konfirmasi?.type === 'satu') {
      setConversations((prev) => {
        const sisa = prev.filter((c) => c.id !== konfirmasi.id);
        const hasil = sisa.length ? sisa : [buatPercakapanBaru()];
        if (konfirmasi.id === activeId) setActiveId(hasil[0].id);
        return hasil;
      });
    }
    setKonfirmasi(null);
  }, [konfirmasi, activeId]);

  const kirimPesan = useCallback((teks) => {
    const isi = teks.trim();
    if (!isi || isThinking) return;

    const pesanUser = { role: 'user', content: isi, ts: Date.now() };
    const riwayatUntukAI = [...active.messages, pesanUser].map(({ role, content }) => ({ role, content }));

    setConversations((prev) => prev.map((c) => {
      if (c.id !== active.id) return c;
      const isPercakapanBaru = c.messages.length === 0;
      return {
        ...c,
        title: isPercakapanBaru ? isi.slice(0, 48) : c.title,
        messages: [...c.messages, pesanUser],
        updatedAt: Date.now(),
      };
    }));
    setDraft('');
    setIsThinking(true);

    const activeId = active.id;
    apiClient
      .post('/ai-business-analyst/chat/', { messages: riwayatUntukAI })
      .then((res) => {
        const pesanAssistant = { role: 'assistant', content: res.data.reply, ts: Date.now() };
        setConversations((prev) => prev.map((c) => (
          c.id === activeId ? { ...c, messages: [...c.messages, pesanAssistant], updatedAt: Date.now() } : c
        )));
      })
      .catch((error) => {
        const pesanAssistant = { role: 'assistant', content: pesanErrorAI(error), ts: Date.now() };
        setConversations((prev) => prev.map((c) => (
          c.id === activeId ? { ...c, messages: [...c.messages, pesanAssistant], updatedAt: Date.now() } : c
        )));
      })
      .finally(() => setIsThinking(false));
  }, [active, isThinking]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      kirimPesan(draft);
    }
  };

  const urutkanTerbaru = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex gap-4 h-full min-h-[420px]">
      {/* Sidebar riwayat percakapan */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
          <button
            type="button"
            onClick={percakapanBaru}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} /> Percakapan Baru
          </button>
          <button
            type="button"
            onClick={mintaHapusSemua}
            title="Hapus semua riwayat"
            className="shrink-0 w-8 h-8 inline-flex items-center justify-center text-slate-400 border border-slate-200 rounded-lg hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {urutkanTerbaru.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveId(c.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') setActiveId(c.id); }}
              className={`group w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                c.id === active?.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MessageSquare size={13} className="shrink-0 opacity-60" />
              <span className="flex-1 truncate">{c.title}</span>
              <button
                type="button"
                onClick={(e) => mintaHapusPercakapan(c.id, e)}
                className="shrink-0 text-slate-300 group-hover:text-slate-400 hover:!text-rose-500 p-0.5"
                title="Hapus percakapan"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Area chat utama */}
      <section className="flex-1 min-w-0 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <header className="px-5 py-3 border-b border-slate-100">
          <h1 className="text-sm font-black text-slate-900">Tanya AI</h1>
          <p className="text-[11px] text-slate-500">Tanya jawab seputar data Bintang, HR, dan CRM -- jawaban dirender markdown</p>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {active?.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bot size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Tanya apapun soal data bisnis kamu</p>
                <p className="text-xs text-slate-500 mt-1">Backend AI masih dalam pengembangan -- ini baru tampilannya</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
                {SARAN_PERTANYAAN.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => kirimPesan(s)}
                    className="text-left text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 hover:bg-slate-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            active.messages.map((m) => <GelembungPesan key={m.ts} pesan={m} />)
          )}
          {isThinking && <IndikatorMengetik />}
        </div>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tulis pertanyaan... (Enter kirim, Shift+Enter baris baru)"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none max-h-32"
            />
            <button
              type="button"
              onClick={() => kirimPesan(draft)}
              disabled={!draft.trim() || isThinking}
              className="shrink-0 w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </section>

      <KonfirmasiHapus
        konfirmasi={konfirmasi}
        onKonfirmasi={eksekusiKonfirmasi}
        onBatal={() => setKonfirmasi(null)}
      />
    </div>
  );
}
