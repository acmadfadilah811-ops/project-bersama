import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MoreHorizontal, ArrowLeftRight, Edit3, Trash2, FileText, CheckCircle } from 'lucide-react';
import PasanganJurnalModal from '../components/pos/PasanganJurnalModal';
import UbahJurnalModal from '../components/pos/UbahJurnalModal';
import HapusJurnalModal from '../components/pos/HapusJurnalModal';
import { notify } from '../../../utils/notify';

export default function DetailPiutangSelesai({ selectedDetailItem, onBack }) {
  const [activeSubIndex, setActiveSubIndex] = useState(null);
  const [selectedSubRow, setSelectedSubRow] = useState(null);
  const [pilihFilter, setPilihFilter] = useState('Semua');
  const [isPasanganOpen, setIsPasanganOpen] = useState(false);
  const [isUbahOpen, setIsUbahOpen] = useState(false);
  const [isHapusOpen, setIsHapusOpen] = useState(false);
  const subActionRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (subActionRef.current && !subActionRef.current.contains(event.target)) {
        setActiveSubIndex(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLunas = selectedDetailItem.status === 'Lunas';
  const detailRows = [];
  
  // Row 1: Sales Transaction
  detailRows.push({
    isPayment: false,
    date: selectedDetailItem.date,
    txNo: selectedDetailItem.txNo.startsWith('EFC') 
      ? selectedDetailItem.txNo 
      : selectedDetailItem.txNo.replace('32HB260724', 'EFC8260724'),
    desc: `Penjualan ke ${selectedDetailItem.client}`,
    amount: selectedDetailItem.amount,
    amountStr: selectedDetailItem.amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })
  });

  if (isLunas) {
    // Row 2: Payment Transaction
    detailRows.push({
      isPayment: true,
      date: selectedDetailItem.date,
      txNo: `PR2607240000000${selectedDetailItem.id + 1}`,
      desc: `Pembayaran dari ${selectedDetailItem.client}`,
      amount: -selectedDetailItem.amount,
      amountStr: `(${selectedDetailItem.amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })})`
    });
  }

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header Card matching Screenshot 1 & 2 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-4">
          {/* Dynamic Status Badge */}
          {isLunas ? (
            <div className="bg-[#E6F4EA] text-[#137333] px-4 py-2.5 rounded-lg flex items-center gap-2 select-none shadow-3xs border border-[#A8DAB5]">
              <CheckCircle size={18} className="text-[#137333] shrink-0" />
              <div className="text-left leading-tight">
                <span className="text-[9px] uppercase font-bold tracking-wider block opacity-80">Piutang</span>
                <span className="text-xs font-black block mt-0.5">Lunas</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#FEF3C7] text-[#D97706] px-4 py-2.5 rounded-lg flex items-center gap-2.5 select-none shadow-3xs border border-[#FDE68A]">
              <FileText size={18} className="text-[#D97706] shrink-0" />
              <div className="text-left leading-tight">
                <span className="text-[9px] uppercase font-bold tracking-wider block opacity-80">Piutang</span>
                <span className="text-xs font-black block mt-0.5">Belum dibayar</span>
              </div>
            </div>
          )}
          <div>
            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Piutang</div>
            <h3 className="text-sm font-bold text-slate-800">
              Penjualan ke {selectedDetailItem.client}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3.5 py-1.5 border border-emerald-250 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
        >
          ← Kembali
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 space-y-4 min-h-[320px] relative">
        
        {/* Dropdown 'Pilih' (Gray & Interactive) */}
        <div className="w-44">
          <select
            value={pilihFilter}
            onChange={(e) => setPilihFilter(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-205 rounded-lg bg-slate-50 text-slate-650 font-bold cursor-pointer outline-none focus:border-[#0088E8] text-xs shadow-3xs"
          >
            {['Semua', 'No. Transaksi', 'Tgl Transaksi', 'Nama Tipe Transaksi', 'No. Dokumen', 'Deskripsi'].map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="border border-slate-150 rounded-lg bg-white relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-5 py-3 rounded-tl-lg">Tanggal</th>
                <th className="px-5 py-3">No. Transaksi</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3 text-right">Amount (IDR)</th>
                <th className="px-5 py-3 text-center rounded-tr-lg">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((subRow, idx) => (
                <tr key={subRow.txNo} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 text-slate-600 font-medium">
                    {subRow.date}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-slate-800">
                    {subRow.txNo}
                  </td>
                  <td className="px-5 py-4 text-slate-650 font-bold">
                    {subRow.desc}
                  </td>
                  <td className={`px-5 py-4 text-right font-mono font-bold ${subRow.isPayment ? 'text-slate-500 font-medium' : 'text-slate-800'}`}>
                    {subRow.amountStr}
                  </td>
                  <td className="px-5 py-4 text-center relative">
                    <button
                      type="button"
                      onClick={() => setActiveSubIndex(activeSubIndex === idx ? null : idx)}
                      className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {activeSubIndex === idx && (
                      <div ref={subActionRef} className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-[99] w-44 font-semibold text-slate-700 text-left animate-fade-in">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubIndex(null);
                            setSelectedSubRow(subRow);
                            setIsPasanganOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <ArrowLeftRight size={13} className="text-slate-400 shrink-0" />
                          <span>Pasangan Jurnal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubIndex(null);
                            setSelectedSubRow(subRow);
                            setIsUbahOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                        >
                          <Edit3 size={13} className="text-slate-400 shrink-0" />
                          <span>Ubah</span>
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubIndex(null);
                            setSelectedSubRow(subRow);
                            setIsHapusOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2 text-rose-600 hover:text-rose-700 font-bold"
                        >
                          <Trash2 size={13} className="text-rose-500 shrink-0" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination in sub-detail page */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <div className="flex items-center gap-2">
            <button disabled className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-slate-100 text-slate-400 rounded-md cursor-not-allowed select-none">
              <span>15 item</span>
              <ChevronDown size={11} className="text-slate-350" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span>Total {detailRows.length}</span>
            <div className="flex items-center gap-1.5">
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed select-none">
                &lt;
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed select-none">
                &gt;
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-8 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none select-none"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Product Order Details Table Card matching Screenshot */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs select-none">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Produk Pesanan
          </h4>
        </div>

        {/* Table */}
        <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                <th className="px-4 py-2.5 w-[5%] text-center">No.</th>
                <th className="px-4 py-2.5 w-[45%]">Deskripsi</th>
                <th className="px-4 py-2.5 w-[10%]">Seri</th>
                <th className="px-4 py-2.5 w-[10%] text-center">Qty</th>
                <th className="px-4 py-2.5 w-[15%] text-right">Harga (IDR)</th>
                <th className="px-4 py-2.5 w-[10%] text-right">Diskon</th>
                <th className="px-4 py-2.5 w-[15%] text-right">Total Harga (IDR)</th>
                <th className="px-4 py-2.5 w-[5%] text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 text-center text-slate-500">1</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                      <FileText size={14} />
                    </div>
                    <span className="font-bold text-[#0088E8] hover:underline cursor-pointer">
                      banner
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-450 font-bold">-</td>
                <td className="px-4 py-3 text-center text-slate-700 font-bold">1</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                  {selectedDetailItem.amount.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-450">0</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                  {selectedDetailItem.amount.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-3 text-center text-slate-350">-</td>
              </tr>
              {/* Summary row */}
              <tr className="bg-slate-50/40 font-bold text-slate-800 text-[11px]">
                <td colSpan={2} className="px-4 py-2.5">Total Pesanan</td>
                <td className="px-4 py-2.5">-</td>
                <td className="px-4 py-2.5 text-center text-slate-800">1</td>
                <td colSpan={4} className="px-4 py-2.5"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Calculations Aligned Right */}
        <div className="flex justify-end pt-2">
          <div className="w-96 space-y-2 text-xs font-semibold text-slate-600">
            
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-bold text-slate-850">
                IDR {selectedDetailItem.amount.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Diskon</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-400">IDR 0 (0.00%)</span>
                <button type="button" className="text-[#0088E8] hover:underline text-[10px] font-bold">
                  ⚙ Pengaturan Diskon
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>Biaya Layanan</span>
              <span className="font-mono text-slate-400">IDR 0</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Pajak</span>
              <span className="font-mono text-slate-400">IDR 0</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Pembulatan</span>
              <span className="font-mono text-slate-400">IDR 0</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Biaya Pengiriman</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-400">IDR 0</span>
                <button type="button" className="text-[#0088E8] hover:underline text-[10px] font-bold">
                  ⚙ Pengaturan Biaya Pengiriman
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>Tambahan Pembayaran</span>
              <span className="font-mono text-slate-400">IDR 0</span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-150 pt-2 font-bold text-slate-850">
              <span>Total Ditagihkan</span>
              <span className="font-mono font-black text-[#0088E8] text-[13px]">
                IDR {selectedDetailItem.amount.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-bold text-slate-850">
              <span>Pembayaran</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-emerald-650">
                  IDR {selectedDetailItem.amount.toLocaleString('id-ID')}
                </span>
                <button type="button" className="text-[#0088E8] hover:underline text-[10px] font-bold">
                  ⚙ Pengaturan Pembayaran
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Payment Details on the left */}
        <div className="border-t border-slate-150 pt-4 space-y-1.5 text-[11px] font-bold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Cara Pembayaran :</span>
            <span className="text-slate-800 uppercase">CASH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Referensi Pembayaran :</span>
            <span className="text-slate-800">-</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-semibold">Tanggal Pembayaran :</span>
            <span className="text-slate-800">{selectedDetailItem.date}</span>
          </div>
        </div>

      </div>

      {/* Modal: Pasangan Jurnal */}
      {selectedSubRow && (
        <PasanganJurnalModal
          isOpen={isPasanganOpen}
          onClose={() => {
            setIsPasanganOpen(false);
            setSelectedSubRow(null);
          }}
          txNo={selectedSubRow.txNo}
          clientName={selectedDetailItem.client}
          amount={Math.abs(selectedSubRow.amount)}
        />
      )}

      {/* Modal: Ubah Jurnal */}
      {selectedSubRow && (
        <UbahJurnalModal
          isOpen={isUbahOpen}
          onClose={() => {
            setIsUbahOpen(false);
            setSelectedSubRow(null);
          }}
          initialData={{
            ...selectedDetailItem,
            txNo: selectedSubRow.txNo,
            amount: Math.abs(selectedSubRow.amount)
          }}
          onUpdate={(newData) => {
            // Note: Detail update logic handled by parents if state is fully synced,
            // here we simulate dynamic modal callback.
          }}
        />
      )}

      {/* Modal: Hapus Jurnal */}
      {selectedSubRow && (
        <HapusJurnalModal
          isOpen={isHapusOpen}
          onClose={() => {
            setIsHapusOpen(false);
            setSelectedSubRow(null);
          }}
          txNo={selectedSubRow.txNo}
          onDeleteConfirm={() => {
            onBack();
          }}
        />
      )}

    </div>
  );
}
