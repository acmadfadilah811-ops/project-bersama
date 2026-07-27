import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, User, Loader, RefreshCw, Phone, MessageSquare, Clock, Paperclip, FileText, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { playMessage } from '../../../utils/notificationSounds';
import { useDynamicIsland } from '../../../context/DynamicIslandContext';

export default function WhatsAppChat() {
  const [searchParams] = useSearchParams();
  const targetNumber = searchParams.get('number');
  const { triggerNotification } = useDynamicIsland();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Attachment states
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [fileCaption, setFileCaption] = useState('');

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const prevMessageCountRef = useRef(null); // track incoming message count for sound trigger
  // FE-15: auto-pilih chat dari ?number= hanya SEKALI. Tanpa guard ini,
  // fetchChats yang dipanggil tiap 5 detik akan terus memanggil setActiveChat +
  // fetchMessages(loader), memicu flicker loading dan me-reset interval polling.
  const autoSelectedRef = useRef(false);

  // Fetch chats on mount
  useEffect(() => {
    fetchChats(true);
  }, []);

  // Poll for messages in active chat & refresh chat list periodically
  useEffect(() => {
    if (!activeChat) return;

    const interval = setInterval(() => {
      fetchMessages(activeChat.id, false);
      fetchChats(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeChat]);

  const fetchChats = async (showLoader = false) => {
    if (showLoader) setLoadingChats(true);
    try {
      const response = await apiClient.get('/whatsapp/chats/');
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.chats || response.data?.records || [];

      // Sort chats by date (newest first) if available
      const sortedChats = data.filter(Boolean).map(chat => {
        const timestamp = chat.messageTimestamp || chat.updatedAt || chat.createdAt;
        const jid = chat.remoteJid || chat.id || '';
        return { 
          ...chat, 
          id: jid,
          resolvedTimestamp: timestamp ? new Date(timestamp * 1000).getTime() : 0 
        };
      }).sort((a, b) => b.resolvedTimestamp - a.resolvedTimestamp);

      setChats(sortedChats);

      if (targetNumber && !autoSelectedRef.current) {
        const matchingChat = sortedChats.find(chat => chat.id.split('@')[0] === targetNumber);
        if (matchingChat) {
          autoSelectedRef.current = true;
          setActiveChat(matchingChat);
          fetchMessages(matchingChat.id, true);
        }
      }
    } catch (error) {
      console.error('Error fetching WhatsApp chats:', error);
    } finally {
      setLoadingChats(false);
      setRefreshing(false);
    }
  };

  const fetchMessages = async (chatId, showLoader = true) => {
    if (showLoader) setLoadingMessages(true);
    try {
      const response = await apiClient.get(`/whatsapp/messages/?number=${encodeURIComponent(chatId)}&limit=50`);
      const data = Array.isArray(response.data) ? response.data : [];
      
      // Sort messages by timestamp ascending
      const sortedMessages = data.sort((a, b) => {
        const timeA = a.messageTimestamp || 0;
        const timeB = b.messageTimestamp || 0;
        return timeA - timeB;
      });

      // Detect new INCOMING messages since last fetch
      const incomingCount = sortedMessages.filter(m => !m.key?.fromMe && !m.fromMe).length;
      if (prevMessageCountRef.current !== null && incomingCount > prevMessageCountRef.current) {
        playMessage();
        
        // Trigger Dynamic Island notification
        const incomingMessages = sortedMessages.filter(m => !m.key?.fromMe && !m.fromMe);
        const latestMsg = incomingMessages[incomingMessages.length - 1];
        if (latestMsg) {
          const senderName = activeChat ? (activeChat.name || activeChat.pushName || activeChat.id.split('@')[0]) : 'Pelanggan';
          const msgText = getMessageText(latestMsg);
          triggerNotification({
            type: 'whatsapp',
            title: `Pesan WA: ${senderName}`,
            message: msgText || 'Mengirimkan media',
          });
        }
      }
      prevMessageCountRef.current = incomingCount;

      setMessages(sortedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Scroll to bottom of message box
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    fetchMessages(chat.id, true);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || sending) return;

    setSending(true);
    const targetJid = activeChat.id;
    const textToSend = newMessage;
    setNewMessage(''); // Clear input immediately for responsiveness

    // Optimistically add to message list
    const tempMsg = {
      key: { fromMe: true, id: `temp-${Date.now()}` },
      message: { conversation: textToSend },
      messageTimestamp: Math.floor(Date.now() / 1000)
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await apiClient.post('/whatsapp/send/', {
        number: targetJid,
        text: textToSend
      });
      fetchMessages(activeChat.id, false);
      fetchChats(false);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Gagal mengirim pesan WhatsApp. Pastikan API Gateway aktif.');
    } finally {
      setSending(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setFileModalOpen(true);
    e.target.value = ''; // reset file input
  };

  const handleSendFileSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !activeChat || sending) return;

    setSending(true);
    const targetJid = activeChat.id;
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('number', targetJid);
    formData.append('caption', fileCaption);

    // Optimistically add placeholder
    const isImage = selectedFile.type.startsWith('image/');
    const tempMsg = {
      key: { fromMe: true, id: `temp-${Date.now()}` },
      message: isImage 
        ? { imageMessage: { caption: fileCaption || `📷 Gambar: ${selectedFile.name}` } }
        : { conversation: `📄 Dokumen: ${selectedFile.name}${fileCaption ? ` - ${fileCaption}` : ''}` },
      messageTimestamp: Math.floor(Date.now() / 1000)
    };
    setMessages(prev => [...prev, tempMsg]);
    
    setFileModalOpen(false);
    setFileCaption('');
    setSelectedFile(null);

    try {
      await apiClient.post('/whatsapp/send-media/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchMessages(activeChat.id, false);
      fetchChats(false);
    } catch (error) {
      console.error('Error sending media:', error);
      alert('Gagal mengirim file. Pastikan server media Anda aktif.');
    } finally {
      setSending(false);
    }
  };

  // Helpers to safely render message content
  const getMessageText = (msg) => {
    if (!msg) return '';
    if (typeof msg === 'string') return msg;
    if (msg.message) {
      const m = msg.message;
      if (m.conversation) return m.conversation;
      if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
      if (m.imageMessage?.caption) return m.imageMessage.caption;
      if (m.videoMessage?.caption) return m.videoMessage.caption;
      if (m.documentWithCaptionMessage?.message?.documentMessage?.caption) {
        return m.documentWithCaptionMessage.message.documentMessage.caption;
      }
    }
    if (msg.content) return msg.content;
    return '[Tipe Pesan Tidak Didukung / Media]';
  };

  const getMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getChatName = (chat) => {
    return chat.name || chat.pushName || chat.id.split('@')[0];
  };

  const getChatNumber = (chat) => {
    return chat.id.split('@')[0];
  };

  // Filter chats by search
  const filteredChats = chats.filter(chat => {
    const name = getChatName(chat).toLowerCase();
    const number = getChatNumber(chat);
    return name.includes(searchQuery.toLowerCase()) || number.includes(searchQuery);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-50 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      {/* Top action bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
            <MessageSquare size={22} className="stroke-[2.5px]" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800">WhatsApp Live Chat</h2>
            <p className="text-xs text-slate-400 font-medium">Manajemen pesan & interaksi pelanggan real-time</p>
          </div>
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchChats(true);
          }}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Sinkronisasi...' : 'Segarkan'}
        </button>
      </div>

      {/* Main interface area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar: Conversations List */}
        <div className="w-80 border-r border-slate-200 flex flex-col bg-white">
          {/* Search bar */}
          <div className="p-4 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Cari kontak atau nomor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Conversations container */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingChats ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader className="animate-spin text-indigo-500" size={24} />
                <span className="text-xs font-bold">Memuat daftar pesan...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 px-6 text-center">
                <span className="text-xs font-bold">Tidak ada obrolan ditemukan</span>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isActive = activeChat?.id === chat.id;
                return (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full flex items-center gap-3 p-4 text-left transition-all cursor-pointer ${
                      isActive ? 'bg-indigo-50/50 border-l-4 border-indigo-600' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="bg-slate-100 text-slate-600 p-2.5 rounded-full shrink-0 flex items-center justify-center">
                      <User size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className="text-xs font-extrabold text-slate-800 truncate">
                          {getChatName(chat)}
                        </h4>
                        {chat.messageTimestamp && (
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">
                            {getMessageTime(chat.messageTimestamp)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium truncate">
                        {chat.id.split('@')[0]}
                      </p>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 min-w-4 text-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Room */}
        <div className="flex-1 flex flex-col bg-slate-50/30">
          {activeChat ? (
            <>
              {/* Active Chat Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-full">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800">{getChatName(activeChat)}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone size={10} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400">{getChatNumber(activeChat)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Message History list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <Loader className="animate-spin text-indigo-500" size={24} />
                    <span className="text-xs font-semibold">Memuat riwayat pesan...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Clock size={36} className="mb-2 opacity-50" />
                    <span className="text-xs font-bold">Belum ada riwayat pesan</span>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const fromMe = msg.key?.fromMe || msg.fromMe || false;
                    const text = getMessageText(msg);

                    if (!text) return null;

                    return (
                      <div
                        key={msg.key?.id || index}
                        className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-xs relative ${
                            fromMe
                              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-tr-none'
                              : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                          }`}
                        >
                          <p className="font-semibold leading-relaxed break-words whitespace-pre-wrap">{text}</p>
                          <span
                            className={`block text-[9px] mt-1 text-right font-bold ${
                              fromMe ? 'text-indigo-200' : 'text-slate-400'
                            }`}
                          >
                            {getMessageTime(msg.messageTimestamp)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Send Form */}
              <div className="bg-white border-t border-slate-200 p-4 shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    disabled={sending}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-500 hover:text-slate-700 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
                    title="Kirim File / Resi / Invoice / Gambar"
                  >
                    <Paperclip size={18} />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tulis pesan WhatsApp..."
                    disabled={sending}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none transition-all text-slate-800"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    {sending ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex flex-col items-center text-center max-w-sm">
                <div className="bg-indigo-50 text-indigo-500 p-4 rounded-full mb-4">
                  <MessageSquare size={36} className="stroke-[2.5px]" />
                </div>
                <h3 className="text-slate-800 text-sm font-extrabold mb-1">Mulai Obrolan</h3>
                <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                  Pilih salah satu kontak di panel kiri untuk melihat riwayat pesan dan mulai membalas chat secara instan.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Upload Confirmation Modal */}
      {fileModalOpen && selectedFile && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 relative flex flex-col transform scale-100 transition-all duration-300">
            <button
              onClick={() => {
                setFileModalOpen(false);
                setSelectedFile(null);
                setFileCaption('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-extrabold text-slate-900 mb-4">
              Kirim File ke {getChatName(activeChat)}
            </h3>

            {/* File Info / Preview */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 flex flex-col items-center justify-center border border-slate-200/60">
              {selectedFile.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="max-h-48 object-contain rounded-lg shadow-sm mb-2"
                />
              ) : (
                <div className="bg-indigo-50 text-indigo-500 p-4 rounded-full mb-2">
                  <FileText size={32} />
                </div>
              )}
              <span className="text-xs font-bold text-slate-800 max-w-xs truncate">{selectedFile.name}</span>
              <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>

            {/* Caption Input */}
            <form onSubmit={handleSendFileSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Teks Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Tambahkan keterangan..."
                  value={fileCaption}
                  onChange={(e) => setFileCaption(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-semibold focus:outline-none transition-all text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFileModalOpen(false);
                    setSelectedFile(null);
                    setFileCaption('');
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {sending ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Kirim File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
