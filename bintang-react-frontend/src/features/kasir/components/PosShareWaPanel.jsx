import React, { useState } from 'react';
import { X, Send, User, ChevronRight } from 'lucide-react';

export default function PosShareWaPanel({
  cart = [],
  selectedCustomer,
  totalAmount = 0,
  contacts = [],
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('phone'); // 'phone' | 'customer'
  const [phoneNumber, setPhoneNumber] = useState(
    selectedCustomer?.nomor_wa
      ? selectedCustomer.nomor_wa.replace(/^(\+62|62|0)/, '')
      : ''
  );
  const [selectedContact, setSelectedContact] = useState(selectedCustomer || null);

  // Calculate Product (distinct) and Barang (sum qty)
  const productCount = cart.length;
  const barangCount = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 1), 0);
  const formattedTotal = Number(totalAmount).toLocaleString('id-ID');

  // Handle Contact selection
  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    const cleanedPhone = (contact.nomor_wa || contact.telepon || '')
      .replace(/^(\+62|62|0)/, '');
    setPhoneNumber(cleanedPhone);
  };

  // Build WhatsApp text message
  const getWhatsAppMessage = () => {
    let msg = `*klontong - Detail Pesanan*\n\n`;
    cart.forEach((item) => {
      const lineTotal = item.hargaTotal != null
        ? item.hargaTotal
        : (Number(item.harga) * Number(item.qty));
      msg += `• *${item.nama}*\n  Rp ${Number(item.harga).toLocaleString('id-ID')} x ${item.qty} = Rp ${lineTotal.toLocaleString('id-ID')}\n`;
      if (item.panjang > 0 && item.lebar > 0) {
        msg += `  (Ukuran: ${item.panjang}m x ${item.lebar}m - ${item.luas} m²)\n`;
      }
      if (item.finishingJenis && item.finishingJenis !== 'Polosan') {
        msg += `  (Finishing: ${item.finishingJenis})\n`;
      }
    });

    msg += `\n*Produk :* ${productCount}\n*Barang :* ${barangCount}\n`;
    msg += `\n*Subtotal :* Rp ${formattedTotal}\n*Grandtotal :* Rp ${formattedTotal}\n\nTerima kasih telah berbelanja di klontong!`;
    return encodeURIComponent(msg);
  };

  const formattedPhoneForWa = () => {
    let clean = phoneNumber.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) clean = clean.substring(1);
    if (!clean.startsWith('8')) return clean;
    return `62${clean}`;
  };

  const handleSendWhatsApp = () => {
    const phone = formattedPhoneForWa();
    if (!phone) {
      alert('Masukkan nomor WhatsApp yang valid.');
      return;
    }
    const msg = getWhatsAppMessage();
    const url = `https://wa.me/${phone}?text=${msg}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex-1 flex min-h-0 bg-[#0B4F43] overflow-hidden border-l border-slate-200 animate-fade-in">
      {/* Sisi Kiri SS: Struk Nota & Dark Green Area */}
      <div className="flex-1 p-6 flex flex-col items-center justify-between overflow-y-auto min-h-0 text-white">
        {/* Header Kirim Ke */}
        <div className="text-center space-y-1">
          <div className="text-xs font-semibold text-emerald-200 tracking-wider">Kirim Ke</div>
          <div className="text-xl font-black tracking-wide text-white">
            +62 {phoneNumber || '...'}
          </div>
        </div>

        {/* Struk Nota Putih dengan Jagged Edges SS */}
        <div className="w-full max-w-sm my-4 bg-white text-slate-800 rounded-sm shadow-2xl p-6 relative flex flex-col justify-between space-y-4 border-t-8 border-dashed border-emerald-900">
          {/* Header Store */}
          <div className="text-center font-black text-lg text-slate-900 border-b border-slate-200 pb-3">
            klontong
          </div>

          {/* List Items */}
          <div className="space-y-3 max-h-60 overflow-y-auto text-xs font-medium pr-1">
            {cart.length === 0 ? (
              <div className="text-center text-slate-400 py-4 font-bold">Keranjang Kosong</div>
            ) : (
              cart.map((item, idx) => {
                const lineTotal = item.hargaTotal != null
                  ? item.hargaTotal
                  : (Number(item.harga) * Number(item.qty));
                return (
                  <div key={item.key || idx} className="space-y-0.5">
                    <div className="font-extrabold text-slate-900">{item.nama}</div>
                    <div className="text-slate-600 font-semibold flex justify-between">
                      <span>
                        Rp {Number(item.harga).toLocaleString('id-ID')} x {item.qty}
                      </span>
                      <span>= Rp {lineTotal.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary Products & Items */}
          <div className="border-t border-slate-200 pt-3 text-xs space-y-1 text-slate-700 font-semibold">
            <div>Produk : <span className="font-black text-slate-900">{productCount}</span></div>
            <div>Barang : <span className="font-black text-slate-900">{barangCount}</span></div>
          </div>

          {/* Financial Totals */}
          <div className="border-t border-slate-200 pt-3 text-xs space-y-1 font-bold">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal :</span>
              <span>Rp {formattedTotal}</span>
            </div>
            <div className="flex justify-between text-slate-900 text-sm font-black pt-1">
              <span>Grandtotal :</span>
              <span>Rp {formattedTotal}</span>
            </div>
          </div>
          {/* Note: "Powered by Olsera" is REMOVED as requested */}
        </div>

        {/* Green WhatsApp Action Button SS */}
        <button
          type="button"
          onClick={handleSendWhatsApp}
          className="flex items-center justify-center gap-2 text-white font-extrabold text-lg hover:text-emerald-200 transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
            <Send size={18} />
          </div>
          <span>WhatsApp</span>
        </button>
      </div>

      {/* Sisi Kanan SS: Panel Bagikan Pesanan */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col justify-between shrink-0">
        {/* Header Panel */}
        <div>
          <div className="p-4 flex items-center justify-between border-b border-slate-100">
            <h3 className="font-extrabold text-base text-slate-800">Bagikan Pesanan</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs: Nomor HP | Pilih Pelanggan SS */}
          <div className="grid grid-cols-2 border-b border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('phone')}
              className={`py-3 text-center transition-all cursor-pointer ${
                activeTab === 'phone'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Nomor HP
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('customer')}
              className={`py-3 text-center transition-all cursor-pointer ${
                activeTab === 'customer'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pilih Pelanggan
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-4 space-y-4">
            {activeTab === 'phone' ? (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 block">Nomor WhatsApp</label>
                <div className="flex items-center gap-2 border border-blue-400 rounded-xl px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-400">
                  <div className="flex items-center gap-1 shrink-0 text-slate-700 font-bold text-xs">
                    <span className="w-4 h-3 bg-red-600 rounded-sm inline-block border border-slate-200" />
                    <span>+62</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="Masukkan nomer whatsapp"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 text-xs font-bold text-slate-800 focus:outline-none bg-transparent placeholder:text-slate-300"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Daftar Pelanggan</label>
                {contacts.length === 0 ? (
                  <div className="text-center text-slate-400 py-4 text-xs font-bold">Tidak ada kontak pelanggan</div>
                ) : (
                  contacts.map((contact) => {
                    const isSelected = selectedContact?.id === contact.id;
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => handleSelectContact(contact)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 shadow-sm'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-black text-xs flex items-center justify-center shrink-0">
                            {contact.nama ? contact.nama.charAt(0).toUpperCase() : <User size={14} />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-800 text-xs truncate">{contact.nama}</div>
                            <div className="text-[10px] text-slate-500 font-semibold truncate">{contact.nomor_wa || contact.telepon || '-'}</div>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-400 shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Button Kirim Pesanan » SS */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full py-3.5 rounded-xl bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <span>Kirim Pesanan</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
