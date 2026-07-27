import { createContext, useContext, useState } from 'react';

const TransaksiCtx = createContext(null);

/**
 * Menyimpan "sub-breadcrumb" (judul tab aktif) agar TransaksiTopbar bisa
 * menampilkan keterangan seperti "Penjualan / Pesanan Butuh Diproses".
 */
export function TransaksiProvider({ children }) {
  const [subtitle, setSubtitle] = useState('');
  return (
    <TransaksiCtx.Provider value={{ subtitle, setSubtitle }}>{children}</TransaksiCtx.Provider>
  );
}

export function useTransaksiCrumb() {
  return useContext(TransaksiCtx) || { subtitle: '', setSubtitle: () => {} };
}
