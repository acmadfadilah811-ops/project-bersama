import { useState, useCallback, useRef } from 'react';
import apiClient from '../../../../api/apiClient';
import { todayISO } from '../../../../utils/date';

const extractList = (data) => {
  const list = Array.isArray(data) ? data : (data?.results || []);
  const count = Array.isArray(data) ? list.length : (data?.count || 0);
  return { list, count };
};

export default function useProductionData() {
  // Antrean Global Divisi (job unassigned yang bisa diklaim).
  const [claimPool, setClaimPool] = useState([]);
  const [claimPoolCount, setClaimPoolCount] = useState(0);
  // Pekerjaan Saya -- kerja aktif (Antrean/Progress/Gagal-Batal-Kendala).
  const [jobs, setJobs] = useState([]);
  const [jobsCount, setJobsCount] = useState(0);
  // Pekerjaan Saya -- kolom Selesai, dibatasi rentang tanggal (default hari ini).
  const [doneJobs, setDoneJobs] = useState([]);
  const [doneJobsCount, setDoneJobsCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tahapList, setTahapList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pricelists, setPricelists] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [globalJobs, setGlobalJobs] = useState([]);
  const [logs, setLogs] = useState(() => {
    try {
      const cached = localStorage.getItem('production_activity_logs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const handleFetchError = (err, isSilent) => {
    console.error('Failed to fetch jobs:', err);
    if (err.response?.status === 403) {
      setError(
        'Akses ditolak. Anda harus absen masuk (Clock-In) terlebih dahulu untuk membuka papan produksi.'
      );
    } else if (!isSilent) {
      setError('Gagal memuat data papan produksi.');
    }
  };

  // Papan produksi TIDAK boleh lagi menarik seluruh riwayat job sekaligus --
  // job 'selesai' dari bulan/tahun lalu dulu ikut tertarik tanpa filter/
  // paginasi, dan tanpa page/page_size OptionalPageNumberPagination diam-
  // diam berhenti di 1000 baris (job lebih lama hilang tanpa peringatan).
  // Dipecah jadi 3 fetch bertarget, masing-masing mengingat parameter
  // terakhirnya (lewat ref) supaya refetch setelah aksi (klaim/mulai/
  // selesai) bisa dipanggil ulang tanpa perlu parameter dari pemanggil.
  // Fitur redesign kanban 2026-09-07.
  const claimPoolParamsRef = useRef({ page: 1, pageSize: 30, tahap: '' });
  const activeJobsParamsRef = useRef({ page: 1, pageSize: 100 });
  // todayISO() (utils/date.js) -- BUKAN toISOString().slice(0,10): itu
  // tanggal UTC, jadi dini hari WIB (00:00-07:00) salah jatuh ke "kemarin"
  // (bug ditemukan user 2026-09-07).
  const doneJobsParamsRef = useRef({ page: 1, pageSize: 20, dateFrom: todayISO(), dateTo: todayISO() });

  const fetchClaimPool = useCallback(async (params = {}, isSilent = false) => {
    const merged = { ...claimPoolParamsRef.current, ...params };
    claimPoolParamsRef.current = merged;
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const query = { unassigned: true, status_pekerjaan: 'antrean', page: merged.page, page_size: merged.pageSize };
      if (merged.tahap) query.tahap = merged.tahap;
      const res = await apiClient.get('/jobs/', { params: query });
      const { list, count } = extractList(res.data);
      setClaimPool(list);
      setClaimPoolCount(count);
    } catch (err) {
      handleFetchError(err, isSilent);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const fetchMyActiveJobs = useCallback(async (params = {}, isSilent = false) => {
    const merged = { ...activeJobsParamsRef.current, ...params };
    activeJobsParamsRef.current = merged;
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/jobs/', {
        params: {
          mine: true,
          status_pekerjaan: 'antrean,dikerjakan,kendala,gagal,batal',
          page: merged.page,
          page_size: merged.pageSize,
        },
      });
      const { list, count } = extractList(res.data);
      setJobs(list);
      setJobsCount(count);
    } catch (err) {
      handleFetchError(err, isSilent);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const fetchMyDoneJobs = useCallback(async (params = {}, isSilent = false) => {
    const merged = { ...doneJobsParamsRef.current, ...params };
    doneJobsParamsRef.current = merged;
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/jobs/', {
        params: {
          mine: true,
          status_pekerjaan: 'selesai',
          date_from: merged.dateFrom,
          date_to: merged.dateTo,
          page: merged.page,
          page_size: merged.pageSize,
        },
      });
      const { list, count } = extractList(res.data);
      setDoneJobs(list);
      setDoneJobsCount(count);
    } catch (err) {
      handleFetchError(err, isSilent);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Refetch pakai parameter terakhir -- dipakai action handler (klaim/mulai/
  // selesai/forward) yang tidak perlu tahu halaman/filter yang sedang aktif.
  const refetchClaimPool = useCallback((isSilent = true) => fetchClaimPool(claimPoolParamsRef.current, isSilent), [fetchClaimPool]);
  const refetchMyActiveJobs = useCallback((isSilent = true) => fetchMyActiveJobs(activeJobsParamsRef.current, isSilent), [fetchMyActiveJobs]);
  const refetchMyDoneJobs = useCallback((isSilent = true) => fetchMyDoneJobs(doneJobsParamsRef.current, isSilent), [fetchMyDoneJobs]);

  // Fetch metadata needed for forwarding/assigning
  const fetchMetadata = useCallback(async () => {
    const [resTahap, resStaff, resInv] = await Promise.allSettled([
        apiClient.get('/tahap-proses/'),
        apiClient.get('/users/?role=staff'),
        apiClient.get('/inventory/'),
    ]);

    const dataOrEmpty = (result) =>
      result.status === 'fulfilled'
        ? (Array.isArray(result.value.data) ? result.value.data : (result.value.data?.results || []))
        : [];

    // Staff memang tidak boleh membaca daftar seluruh staff. Kegagalan 403
    // itu tidak boleh ikut mengosongkan daftar tahap/divisi tujuan.
    setTahapList(dataOrEmpty(resTahap));
    setStaffList(dataOrEmpty(resStaff));
    setInventory(dataOrEmpty(resInv));

    [resTahap, resStaff, resInv]
      .filter((result) => result.status === 'rejected')
      .forEach((result) => console.error('Failed to fetch production metadata:', result.reason));
  }, []);

  // Fetch Admin panels data (Only core jobs and inventory)
  const fetchAdminData = useCallback(async () => {
    try {
      const [resInv, resGlobal] = await Promise.all([
        apiClient.get('/inventory/'),
        apiClient.get('/jobs/'), // All jobs (admin/owner/manager -- tidak dibatasi filter staff)
      ]);
      setInventory(Array.isArray(resInv.data) ? resInv.data : (resInv.data?.results || []));
      const allJobs = Array.isArray(resGlobal.data) ? resGlobal.data : (resGlobal.data?.results || []);
      setGlobalJobs(allJobs);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await apiClient.get('/contacts/production-lite/');
      setCustomers(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  }, []);

  const fetchPricelists = useCallback(async () => {
    try {
      const res = await apiClient.get('/product-prices/');
      setPricelists(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch pricelists:', err);
    }
  }, []);

  const fetchDivisions = useCallback(async () => {
    try {
      const res = await apiClient.get('/divisi/');
      setDivisions(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch divisions:', err);
    }
  }, []);

  // Actions
  // Klaim semua job sekaligus dalam satu order/transaksi — sebelumnya staff
  // harus klaim satu-satu per item (tiap baris qty/finishing berbeda jadi
  // JobBoard terpisah di server), padahal buat staff itu tetap satu
  // pekerjaan/satu order yang sama (bug ditemukan 2026-08-13). Tidak ada
  // endpoint bulk baru di server — cukup panggil endpoint claim yang sama
  // beberapa kali lalu refetch sekali di akhir.
  const claimJobs = async (jobIds) => {
    const hasil = await Promise.allSettled(jobIds.map((id) => apiClient.post(`/jobs/${id}/claim/`)));
    const gagal = hasil.filter((r) => r.status === 'rejected');
    // Klaim memindahkan job dari Antrean Global -> Pekerjaan Saya (aktif).
    await Promise.all([refetchClaimPool(false), refetchMyActiveJobs()]);
    if (gagal.length === 0) {
      addLocalLog(`${jobIds.length} pekerjaan dalam satu order diklaim oleh Anda.`);
      return { ok: true };
    }
    if (gagal.length < jobIds.length) {
      addLocalLog(`${jobIds.length - gagal.length}/${jobIds.length} pekerjaan dalam satu order diklaim oleh Anda.`);
    }
    const pesanPertama = gagal[0]?.reason?.response?.data?.error || 'Gagal mengklaim pekerjaan.';
    return {
      ok: false,
      error: gagal.length === jobIds.length
        ? pesanPertama
        : `${gagal.length} dari ${jobIds.length} item gagal diklaim: ${pesanPertama}`,
    };
  };

  const startJob = async (jobId) => {
    try {
      const res = await apiClient.post(`/jobs/${jobId}/start/`);
      await refetchMyActiveJobs(false);
      addLocalLog(`Pekerjaan #${jobId} mulai dikerjakan.`);
      return { ok: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Gagal memulai pekerjaan.';
      return { ok: false, error: errorMsg };
    }
  };

  const completeJob = async (jobId) => {
    try {
      const res = await apiClient.post(`/jobs/${jobId}/complete/`);
      // Selesai memindahkan job dari kolom aktif -> kolom Selesai.
      await Promise.all([refetchMyActiveJobs(false), refetchMyDoneJobs()]);
      addLocalLog(`Pekerjaan #${jobId} selesai dikerjakan.`);
      return { ok: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Gagal menyelesaikan pekerjaan.';
      return { ok: false, error: errorMsg };
    }
  };

  const forwardJob = async (jobId, payload) => {
    try {
      const res = await apiClient.post(`/jobs/${jobId}/forward/`, payload);
      // Forward bisa memindahkan job ke tahap/divisi lain (hilang dari
      // Pekerjaan Saya) atau mengubah statusnya -- refresh kedua kelompok
      // aktif supaya papan tidak menampilkan data basi.
      await Promise.all([refetchMyActiveJobs(false), refetchClaimPool()]);
      addLocalLog(`Pekerjaan #${jobId} diteruskan ke tahap/divisi lain.`);
      return { ok: true, data: res.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Gagal meneruskan pekerjaan.';
      return { ok: false, error: errorMsg };
    }
  };

  // Helper log lokal untuk dashboard event log
  const addLocalLog = (message) => {
    const newLog = {
      id: Date.now(),
      waktu: new Date().toISOString(),
      keterangan: message,
    };
    setLogs((prev) => {
      const updated = [newLog, ...prev].slice(0, 100);
      try {
        localStorage.setItem('production_activity_logs', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save activity logs to localStorage:', err);
      }
      return updated;
    });
  };

  return {
    claimPool,
    claimPoolCount,
    jobs,
    jobsCount,
    doneJobs,
    doneJobsCount,
    loading,
    tahapList,
    staffList,
    inventory,
    customers,
    pricelists,
    divisions,
    globalJobs,
    logs,
    error,
    setError,
    fetchClaimPool,
    fetchMyActiveJobs,
    fetchMyDoneJobs,
    fetchMetadata,
    fetchAdminData,
    fetchCustomers,
    fetchPricelists,
    fetchDivisions,
    claimJobs,
    startJob,
    completeJob,
    forwardJob,
    addLocalLog,
  };
}
