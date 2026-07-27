import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { playSoundForType } from '../utils/notificationSounds';
import apiClient from '../api/apiClient';
import { registerNotifier } from '../utils/notify';

const DynamicIslandContext = createContext(null);

const TRACKS = [
  {
    title: 'Chill Lofi Beats',
    artist: 'Lofi Work Study',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Free test mp3
    cover:
      'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=150&auto=format&fit=crop&q=60',
  },
  {
    title: 'Ambient Focus Sound',
    artist: 'Deep Focus',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    cover:
      'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=150&auto=format&fit=crop&q=60',
  },
  {
    title: 'Corporate Coffee',
    artist: 'Acoustic Guitar',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    cover:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=150&auto=format&fit=crop&q=60',
  },
  {
    title: 'Late Night Study',
    artist: 'Midnight Lofi',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    cover:
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=150&auto=format&fit=crop&q=60',
  },
  {
    title: 'Rainy Coffee Shop',
    artist: 'Jazz & Rain',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    cover:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=150&auto=format&fit=crop&q=60',
  },
  {
    title: 'Sunny Morning Chill',
    artist: 'Acoustic Warmth',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    cover:
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=150&auto=format&fit=crop&q=60',
  },
];

export function DynamicIslandProvider({ children }) {
  const [viewMode, setViewMode] = useState(() => (window.innerWidth < 768 ? 'mobile' : 'desktop'));
  const [activeNotification, setActiveNotification] = useState(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [audio] = useState(() => new Audio());

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('mobile');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle music changes
  useEffect(() => {
    audio.src = TRACKS[currentTrackIndex].url;
    audio.loop = true;
    if (musicPlaying) {
      audio.play().catch((err) => {
        console.warn('Autoplay blocked:', err);
        setMusicPlaying(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex, audio]);

  // Sync music playing state
  useEffect(() => {
    if (musicPlaying) {
      audio.play().catch((err) => {
        console.warn('Autoplay blocked:', err);
        setMusicPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [musicPlaying, audio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audio.pause();
    };
  }, [audio]);

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'desktop' ? 'mobile' : 'desktop'));
  };

  const triggerNotification = ({ type, title, message }) => {
    // Dismiss current first
    setActiveNotification(null);

    // Play type-aware notification sound
    playSoundForType(type);

    // Tiny delay to trigger CSS entry animation
    setTimeout(() => {
      setActiveNotification({ type, title, message });
    }, 100);
  };

  const dismissNotification = () => {
    setActiveNotification(null);
  };

  // FE-16: daftarkan surface notifikasi ini sebagai handler global agar helper
  // penanganan error API (notifyApiError) dapat menampilkan pesan ke pengguna
  // dari mana saja, termasuk di luar komponen React.
  useEffect(() => {
    registerNotifier(triggerNotification);
    return () => registerNotifier(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto dismiss notification after 4.5 seconds
  useEffect(() => {
    if (activeNotification) {
      const timer = setTimeout(() => {
        setActiveNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [activeNotification]);

  // Global background polling for incoming WhatsApp chats
  const knownChatsRef = useRef({});
  const isFirstFetchRef = useRef(true);

  useEffect(() => {
    let active = true;
    const pollChats = async () => {
      if (!localStorage.getItem('access_token')) return;
      try {
        const response = await apiClient.get('/whatsapp/chats/');
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.chats || response.data?.records || [];

        if (!active) return;

        const newKnown = { ...knownChatsRef.current };
        let hasNewMessage = false;
        let lastNewChat = null;

        data.forEach((chat) => {
          if (!chat) return;
          const jid = chat.remoteJid || chat.id || '';
          const unread = chat.unreadCount || 0;
          const timestamp = chat.messageTimestamp || 0;
          const name = chat.name || chat.pushName || jid.split('@')[0];
          
          // Get message body text
          let msgText = '';
          if (chat.message) {
            const m = chat.message;
            msgText = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '';
          }

          const prev = knownChatsRef.current[jid];

          if (!isFirstFetchRef.current) {
            // Jika unread > 0 dan (belum pernah tercatat atau unread bertambah atau timestamp lebih baru)
            if (unread > 0 && (!prev || unread > prev.unread || timestamp > prev.timestamp)) {
              hasNewMessage = true;
              lastNewChat = { name, text: msgText || 'Mengirimkan media' };
            }
          }

          newKnown[jid] = { unread, timestamp };
        });

        knownChatsRef.current = newKnown;
        isFirstFetchRef.current = false;

        if (hasNewMessage && lastNewChat) {
          triggerNotification({
            type: 'whatsapp',
            title: `Pesan WA: ${lastNewChat.name}`,
            message: lastNewChat.text,
          });
        }
      } catch (err) {
        console.warn('Silent global WhatsApp poll error:', err);
      }
    };

    // Poll every 8 seconds
    const interval = setInterval(pollChats, 8000);
    pollChats(); // Initial run

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <DynamicIslandContext.Provider
      value={{
        viewMode,
        setViewMode,
        toggleViewMode,
        activeNotification,
        triggerNotification,
        dismissNotification,
        musicPlaying,
        setMusicPlaying,
        currentTrackIndex,
        setCurrentTrackIndex,
        currentTrack: TRACKS[currentTrackIndex],
        showMusicPlayer,
        setShowMusicPlayer,
        tracks: TRACKS,
      }}
    >
      {children}
    </DynamicIslandContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDynamicIsland() {
  const context = useContext(DynamicIslandContext);
  if (!context) {
    throw new Error('useDynamicIsland must be used within a DynamicIslandProvider');
  }
  return context;
}
