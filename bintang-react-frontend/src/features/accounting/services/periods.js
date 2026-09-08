import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';

export async function fetchAccountingPeriods(fiscalYear) {
  const { data } = await apiClient.get('/accounting/periods/', {
    params: { fiscal_year: fiscalYear },
  });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function fetchAccountingPeriodDetail(periodId) {
  // fetchAllPages, bukan 1 halaman page_size=1000 tetap -- sebelumnya kalau
  // 1 bulan punya >1000 baris jurnal (mungkin di bulan sibuk), sisanya diam-diam
  // hilang tanpa peringatan apa pun ke user yang lagi review sebelum tutup buku
  // (bug ditemukan audit Tutup Buku, 2026-09-08). Periode dibatasi 1 bulan
  // kalender jadi wajar ditarik semua (bukan kasus "riwayat tak terbatas"
  // seperti halaman Piutang/Hutang).
  return fetchAllPages(`/accounting/periods/${periodId}/detail/`);
}

export async function closeAccountingPeriod(startDate, endDate) {
  const { data } = await apiClient.post('/accounting/close-period/', {
    start_date: startDate,
    end_date: endDate,
    confirm: true,
  });
  return data;
}

export async function closeAllAccountingPeriods(fiscalYear) {
  const { data } = await apiClient.post('/accounting/periods/close-all/', {
    confirm: true,
    fiscal_year: fiscalYear,
  });
  return data;
}
