import { Routes, Route, Navigate } from 'react-router-dom';
import TransaksiTopbar from '../../transaksi/components/TransaksiTopbar';
import { TransaksiProvider } from '../../transaksi/components/TransaksiContext';
import VoucherDiskon from './VoucherDiskon';
import LoyaltyPoint from './LoyaltyPoint';

/**
 * Pembungkus area "Marketing" (full-screen, topbar sendiri).
 * Memakai ulang topbar & breadcrumb provider dari area Transaksi.
 */
export default function MarketingApp() {
  return (
    <TransaksiProvider>
      <div className="flex flex-col min-h-screen bg-white">
        <TransaksiTopbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="voucher-diskon" element={<VoucherDiskon />} />
            <Route path="loyalty-point" element={<LoyaltyPoint />} />
            <Route path="*" element={<Navigate to="voucher-diskon" replace />} />
          </Routes>
        </div>
      </div>
    </TransaksiProvider>
  );
}
