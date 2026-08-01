import { Mail } from 'lucide-react';
import useReceiptEmail from '../hooks/useReceiptEmail';

export default function ReceiptEmailField({ saleId, initialEmail }) {
  const { email, setEmail, isSending, sendReceipt } = useReceiptEmail({ saleId, initialEmail });

  return (
    <div>
      <label className="text-[10px] font-medium text-white/60 block mb-0.5">Email Resi</label>
      <div className="flex items-center border-b border-white/30 pb-1">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full text-xs font-semibold text-white bg-transparent focus:outline-none placeholder:text-white/40"
          placeholder="nama@customer.com"
          disabled={isSending}
        />
        <button
          type="button"
          onClick={sendReceipt}
          disabled={isSending}
          className="w-8 h-8 rounded-full bg-[#0088FF] hover:bg-blue-600 text-white flex items-center justify-center ml-2 transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-60"
          title="Kirim Resi via Email"
        >
          <Mail size={15} />
        </button>
      </div>
    </div>
  );
}
