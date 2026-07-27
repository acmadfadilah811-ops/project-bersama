import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import TambahPromosiForm from './TambahPromosiForm';
import PromosiPosList from './PromosiPosList';
import DetailPromosiPos from './DetailPromosiPos';

/** Tab "Promosi (POS)" — toggle antara daftar dan form tambah. */
export default function PromosiPosTab() {
  const [view, setView] = useState('list');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/pos-promotions/');
      setRows(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[VoucherDiskon] fetch promotions error:', err);
      setError('Gagal memuat daftar promosi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  if (view === 'detail') {
    return (
      <DetailPromosiPos
        row={selected}
        onCancel={() => {
          setView('list');
          setSelected(null);
        }}
        onEdit={(row) => {
          setEditing(row);
          setView('edit');
        }}
        onSaved={fetchRows}
      />
    );
  }

  if (view === 'create' || view === 'edit') {
    return (
      <TambahPromosiForm
        initial={editing}
        onCancel={() => {
          setView('list');
          setEditing(null);
        }}
        onSaved={() => {
          setView('list');
          setEditing(null);
          fetchRows();
        }}
      />
    );
  }

  return (
    <PromosiPosList
      rows={rows}
      loading={loading}
      error={error}
      onAdd={() => {
        setEditing(null);
        setView('create');
      }}
      onSelectRow={(row) => {
        setSelected(row);
        setView('detail');
      }}
      onRefresh={fetchRows}
    />
  );
}
