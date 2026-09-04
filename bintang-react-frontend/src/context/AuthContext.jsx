/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Baca business_settings dari localStorage sejak deklarasi —
// supaya state awal sudah berisi logo tanpa harus menunggu useEffect.
const _loadCachedSettings = () => {
  try {
    const raw = localStorage.getItem('business_settings');
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { nama_bisnis: 'StarPhoto & Advertising', no_telepon: '', alamat: '', logo_url: '', deskripsi: '' };
};

import apiClient from '../api/apiClient';
import authSession from '../utils/authSession';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Inisiasi langsung dari cache — tidak pernah flash default
  const [businessSettings, setBusinessSettings] = useState(_loadCachedSettings);
  const [loading, setLoading] = useState(true);

  const fetchBusinessSettings = async () => {
    try {
      const res = await apiClient.get('/business-settings/');
      const data = res.data;
      if (data && data.nama_bisnis) {
        setBusinessSettings(data);
        localStorage.setItem('business_settings', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Gagal sinkronisasi data bisnis:', err);
    }
  };

  useEffect(() => {
    const token = authSession.getAccessToken();
    const savedUser = authSession.getUser();

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));

      // Ambil data terbaru dari server di background agar foto dll selalu sinkron
      apiClient.get('/users/me/')
        .then((res) => {
          const data = res.data;
          if (data.id) {
            setUser(data);
            authSession.setUser(data);
          }
        })
        .catch((err) => console.error('Gagal sinkronisasi data user:', err));

      // Ambil juga data bisnis terbaru dari server
      fetchBusinessSettings();
    }
    setLoading(false);
  }, []);

  const login = (userData, accessToken, refreshToken) => {
    authSession.start(userData, accessToken, refreshToken);
    setUser(userData);
    // Settings sudah ada di state dari cache, langsung fetch untuk sinkron
    fetchBusinessSettings();
  };

  const logout = () => {
    authSession.clear();
    // business_settings TIDAK dihapus dari localStorage maupun state —
    // itu data bisnis (logo, nama toko) yang sama untuk semua user,
    // bukan data sensitif. Logo tetap tampil saat login kembali.
    setUser(null);
  };

  const updateUser = (newData) => {
    const updatedUser = { ...user, ...newData };
    authSession.setUser(updatedUser);
    setUser(updatedUser);
  };

  const updateBusinessSettings = (newSettings) => {
    const updated = { ...businessSettings, ...newSettings };
    localStorage.setItem('business_settings', JSON.stringify(updated));
    setBusinessSettings(updated);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateUser, businessSettings, updateBusinessSettings, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook agar mudah dipanggil di komponen manapun
export function useAuth() {
  return useContext(AuthContext);
}
