import ReturPembelianDetailView from '../../../transaksi/components/return/ReturPembelianDetailView';

export default function ReturPembelianDetail({ purchaseId, onBack, onSaved }) {
  return (
    <ReturPembelianDetailView
      docId={purchaseId}
      onBack={onBack}
      onSaved={onSaved}
    />
  );
}
