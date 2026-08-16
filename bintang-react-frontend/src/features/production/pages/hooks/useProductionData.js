import { useState, useCallback } from 'react';
import apiClient from '../../../../api/apiClient';

export default function useProductionData() {
  const [jobs, setJobs] = useState([]);
  const [claimPool, setClaimPool] = useState([]);
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

  // Fetch jobs for staff (includes personal kanban and claim pool)
  const fetchJobs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/jobs/');
      const allJobs = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      // Separate personal jobs and unassigned division jobs (claim pool)
      const personal = allJobs.filter((j) => j.pic_staff !== null);
      const pool = allJobs.filter((j) => j.pic_staff === null);

      setJobs(personal);
      setClaimPool(pool);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      if (err.response?.status === 403) {
        setError(
          'Akses ditolak. Anda harus absen masuk (Clock-In) terlebih dahulu untuk membuka papan produksi.'
        );
      } else if (!isSilent) {
        setError('Gagal memuat data papan produksi.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

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
        apiClient.get('/jobs/'), // All jobs
      ]);
      setInventory(Array.isArray(resInv.data) ? resInv.data : (resInv.data?.results || []));
      const allJobs = Array.isArray(resGlobal.data) ? resGlobal.data : (resGlobal.data?.results || []);
      setGlobalJobs(allJobs);
      // Sync ke jobs/claimPool juga supaya Staff Mode view bisa langsung terisi saat switch
      setJobs(allJobs.filter((j) => j.pic_staff !== null));
      setClaimPool(allJobs.filter((j) => j.pic_staff === null));
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
    await fetchJobs();
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
      await fetchJobs();
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
      await fetchJobs();
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
      await fetchJobs();
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
    jobs,
    claimPool,
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
    fetchJobs,
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
