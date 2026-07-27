import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../api/apiClient';
import { STAFF_COLUMNS } from '../components/jobConstants';
import { playSuccess } from '../../../utils/notificationSounds';
import { fetchAllPages } from '../../../utils/paginatedApi';

/**
 * useJobsData — Custom hook untuk semua state & handler di halaman Jobs.
 * Memisahkan logika dari tampilan agar Jobs.jsx tetap bersih.
 */
export function useJobsData() {
  const [jobs, setJobs] = useState([]);
  const [orderMap, setOrderMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const [tahapList, setTahapList] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const playNotificationSound = (filename) => {
    // Legacy fallback wrapper — routes to Web Audio API utility
    if (filename === 'selesai.mp3') playSuccess();
  };

  // ─── Fetch utama ──────────────────────────────────────
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [jobsRes, ordersRes] = await Promise.allSettled([
        fetchAllPages('/jobs/'),
        fetchAllPages('/orders/'),
      ]);

      if (jobsRes.status === 'fulfilled') {
        // Handle both paginated and non-paginated responses
        const rawJobs = jobsRes.value;
        setJobs(rawJobs);
        setError(null);
      } else {
        console.error('Gagal memuat data jobs:', jobsRes.reason);
        if (jobsRes.reason?.response?.status === 403) {
          setError(
            'Akses ditolak. Anda harus absen (Clock-In) terlebih dahulu untuk membuka Pekerjaan.'
          );
        }
      }

      if (ordersRes.status === 'fulfilled') {
        const raw = ordersRes.value;
        const map = {};
        raw.forEach((order) => {
          order.items?.forEach((item) => {
            map[item.id] = {
              orderItemId: item.id,
              orderId: order.id,
              jenisProduk: item.jenis_produk,
              customerName: order.nama,
              nomorWa: order.nomor_wa,
              keterangan: item.detail || '',
              keteranganDetail: item.keterangan_detail || '',
              catatanPelanggan: order.catatan_pelanggan || '',
              fileLink: item.gdrive_customer_link || '',
              desainSusulan: item.desain_susulan,
              panjang: item.panjang || 0,
              lebar: item.lebar || 0,
              qty: item.qty || 1,
              hargaJual: item.harga_jual || 0,
            };
          });
        });
        setOrderMap(map);
      } else {
        console.error('Gagal memuat data order:', ordersRes.reason);
        setError('Gagal memuat detail order untuk papan produksi. Silakan coba lagi.');
      }
    } catch (err) {
      console.error('Gagal memuat data jobs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ✅ FIX: Add isMounted cleanup to prevent setState on unmounted component
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!isMounted) return;
      await fetchData();

      if (!isMounted) return;
      try {
        const [tahapRes, staffRes] = await Promise.allSettled([
          fetchAllPages('/tahap-proses/'),
          fetchAllPages('/users/'),
        ]);
        if (!isMounted) return;
        if (tahapRes.status === 'fulfilled') {
          const val = tahapRes.value;
          const rawTahap = Array.isArray(val) ? val : (Array.isArray(val?.data) ? val.data : (val?.data?.results ?? (val?.results ?? [])));
          setTahapList(rawTahap);
        }
        if (staffRes.status === 'fulfilled') {
          const val = staffRes.value;
          const rawStaff = Array.isArray(val) ? val : (Array.isArray(val?.data) ? val.data : (val?.data?.results ?? (val?.results ?? [])));
          setStaffList(rawStaff.filter((u) => u.role === 'staff'));
        }
      } catch { /* silently ignore */ }
    };

    init();
    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Grouping untuk kanban staff ──────────────────────
  const groupedByStatus = useMemo(() => {
    const groups = {};
    STAFF_COLUMNS.forEach((col) => {
      groups[col.id] = [];
    });
    jobs.forEach((job) => {
      if (groups[job.status_pekerjaan] !== undefined) {
        groups[job.status_pekerjaan].push(job);
      }
    });
    return groups;
  }, [jobs]);

  // ─── Handler Edit Job (Fix: sekarang kirim tahap juga) ─
  const handleModalSave = async (jobId, formData, isManager) => {
    setSaving(true);
    const payload = {
      status_pekerjaan: formData.status_pekerjaan,
      insentif: parseInt(formData.insentif || 0),
    };
    // FIX: Sertakan tahap jika diubah (hanya manager)
    if (isManager && formData.tahap) {
      payload.tahap = parseInt(formData.tahap) || null;
    }
    if (isManager && formData.pic_staff !== undefined) {
      payload.pic_staff = formData.pic_staff || null;
    }
    try {
      await apiClient.patch(`/jobs/${jobId}/`, payload);
      if (payload.status_pekerjaan === 'selesai') playNotificationSound('selesai.mp3');
      await fetchData(true);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Gagal menyimpan perubahan.' };
    } finally {
      setSaving(false);
    }
  };

  // ─── Handler Forward Job ──────────────────────────────
  const handleForward = async (jobId, formData) => {
    setSaving(true);
    const payload = { aksi: formData.aksi };
    if (formData.aksi === 'forward') {
      payload.tahap_id = parseInt(formData.tahap_id);
      if (formData.pic_staff_id) payload.pic_staff_id = parseInt(formData.pic_staff_id);
    }
    try {
      await apiClient.post(`/jobs/${jobId}/forward/`, payload);
      await fetchData(true);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Gagal meneruskan job.' };
    } finally {
      setSaving(false);
    }
  };

  // ─── Handler Workspace Save ───────────────────────────
  const handleWorkspaceSave = async ({
    jobId,
    tableRows,
    materialUsage,
    driveLink,
    hargaJualBaru,
    hargaLama,
    orderItemId,
    statusPekerjaan,
    alasanGagal,
    fromStart,
  }) => {
    setSaving(true);
    try {
      // 1. Kurangi stok bahan jika ada
      const validMats = materialUsage.filter(
        (m) => m.item_id && parseFloat(String(m.qty).replace(',', '.')) > 0
      );
      if (validMats.length > 0) {
        const matPayload = validMats.map((m) => ({
          item_id: m.item_id,
          qty: parseFloat(String(m.qty).replace(',', '.')),
          catatan: m.catatan || '',
        }));
        await apiClient.post(`/jobs/${jobId}/use-materials/`, { materials: matPayload });
      }

      // 2. Simpan catatan & link drive
      const jobPayload = {
        catatan_staff: tableRows,
        gdrive_output_link: driveLink || '',
        status_pekerjaan: statusPekerjaan,
      };
      if (alasanGagal) jobPayload.alasan_gagal = alasanGagal;
      if (fromStart) jobPayload.status_pekerjaan = 'dikerjakan';
      await apiClient.patch(`/jobs/${jobId}/`, jobPayload);

      // 3. Update harga jika berubah
      if (hargaJualBaru && parseInt(hargaJualBaru) !== hargaLama) {
        await apiClient.patch(`/order-items/${orderItemId}/`, {
          harga_jual: parseInt(hargaJualBaru),
        });
      }

      if (jobPayload.status_pekerjaan === 'selesai') playNotificationSound('selesai.mp3');

      await fetchData(true);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Gagal menyimpan workspace.' };
    } finally {
      setSaving(false);
    }
  };

  // ─── Export Excel ─────────────────────────────────────
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await apiClient.get('/export/jobs/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'jobs.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Gagal mengekspor data.');
    } finally {
      setExporting(false);
    }
  };

  return {
    jobs,
    orderMap,
    loading,
    saving,
    exporting,
    error,
    tahapList,
    staffList,
    groupedByStatus,
    fetchData,
    handleModalSave,
    handleForward,
    handleWorkspaceSave,
    handleExport,
  };
}
