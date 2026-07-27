import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../api/apiClient';
import { Clock, Play, CheckCircle2, XCircle, AlertCircle, MessageSquare, Bell } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { playAlert, playSuccess, playReject } from '../../../utils/notificationSounds';

export default function AttendanceSessionManager() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessionData, setSessionData] = useState(null);
  const [unlockRequests, setUnlockRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waktuMulai, setWaktuMulai] = useState('08:00');
  const [batasMaksimal, setBatasMaksimal] = useState('09:00');
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const canManageSession = ['owner', 'manager'].includes(user?.role?.toLowerCase());
  const prevRequestCountRef = useRef(null); // Track previous unlock request count

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [sessionRes, requestsRes] = await Promise.all([
        apiClient.get('/hr/attendance-session/'),
        canManageSession ? apiClient.get('/hr/unlock-requests/') : Promise.resolve({ data: [] }),
      ]);
      setSessionData(sessionRes.data);
      setRepeatDaily(sessionRes.data?.repeat_daily || false);
      if (sessionRes.data?.batas_maksimal) {
        const dateBatas = new Date(sessionRes.data.batas_maksimal);
        setBatasMaksimal(
          `${String(dateBatas.getHours()).padStart(2, '0')}:${String(dateBatas.getMinutes()).padStart(2, '0')}`
        );
      }
      if (sessionRes.data?.waktu_mulai) {
        const dateMulai = new Date(sessionRes.data.waktu_mulai);
        setWaktuMulai(
          `${String(dateMulai.getHours()).padStart(2, '0')}:${String(dateMulai.getMinutes()).padStart(2, '0')}`
        );
      }
      const newRequests = requestsRes.data;
      setUnlockRequests(newRequests);

      // Play alert sound if new unlock requests have arrived since last poll
      if (canManageSession && prevRequestCountRef.current !== null) {
        if (newRequests.length > prevRequestCountRef.current) {
          playAlert();
        }
      }
      prevRequestCountRef.current = newRequests.length;
    } catch (err) {
      console.error('Gagal mengambil data sesi absensi', err);
    } finally {
      setLoading(false);
    }
  }, [canManageSession]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll every 30 seconds for new unlock requests
  useEffect(() => {
    if (!canManageSession) return;
    const interval = setInterval(() => {
      apiClient.get('/hr/unlock-requests/').then(res => {
        const newRequests = res.data;
        if (prevRequestCountRef.current !== null && newRequests.length > prevRequestCountRef.current) {
          playAlert();
          setUnlockRequests(newRequests);
        }
        prevRequestCountRef.current = newRequests.length;
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [canManageSession]);

  const handleStartSession = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/attendance-session/', {
        waktu_mulai: waktuMulai,
        batas_maksimal: batasMaksimal,
        repeat_daily: repeatDaily,
      });
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal memulai sesi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      setActionLoading(true);
      await apiClient.post(`/hr/unlock-requests/${id}/${action}/`);
      // Play sound feedback for manager action
      if (action === 'approve') playSuccess();
      else if (action === 'reject') playReject();
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal memproses permohonan');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex items-center justify-center min-h-[150px]">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isActive = sessionData?.is_active;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full justify-between">
      <div>
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="text-slate-800 font-extrabold text-[11px] flex items-center gap-1.5">
            <Clock size={14} className="text-blue-600" /> Sesi Absensi
          </h2>
          {isActive && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-600 uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Aktif
            </span>
          )}
        </div>

        <div className="p-3">
          {/* Kontrol Sesi */}
          <div
            className={`p-3 rounded-lg border ${isActive ? 'bg-blue-50/30 border-blue-100' : 'bg-slate-50 border-slate-200'} mb-4`}
          >
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800">
                  {isActive ? 'Sesi Hari Ini Berjalan' : 'Sesi Belum Dimulai'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                  {isActive
                    ? `Batas akhir absen ditetapkan pada jam ${new Date(sessionData.batas_maksimal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Tentukan batas maksimal absensi untuk hari ini.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/50">
                {canManageSession ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-500 uppercase mb-0.5">
                          Jam Mulai
                        </span>
                        <input
                          type="time"
                          value={waktuMulai}
                          onChange={(e) => setWaktuMulai(e.target.value)}
                          className="w-full text-xs font-bold px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-500 uppercase mb-0.5">
                          Batas Telat
                        </span>
                        <input
                          type="time"
                          value={batasMaksimal}
                          onChange={(e) => setBatasMaksimal(e.target.value)}
                          className="w-full text-xs font-bold px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        id="repeatDaily"
                        checked={repeatDaily}
                        onChange={(e) => setRepeatDaily(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                      <label
                        htmlFor="repeatDaily"
                        className="text-[10px] font-semibold text-slate-600 cursor-pointer select-none"
                      >
                        Terapkan Jadwal Ini Setiap Hari (Otomatis)
                      </label>
                    </div>

                    <button
                      onClick={handleStartSession}
                      disabled={actionLoading}
                      className="w-full justify-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors mt-1 cursor-pointer"
                    >
                      {isActive ? (
                        'Update Waktu'
                      ) : (
                        <>
                          <Play size={12} /> Mulai Sesi
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500 leading-normal flex items-start gap-1.5">
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>
                      Jadwal absensi dikontrol oleh Owner dan Manager. Silakan hubungi mereka jika
                      terdapat kendala waktu absensi.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Permohonan Izin Buka Akun (Hanya untuk Owner & Manager) */}
      {canManageSession && (
        <div className="p-3 border-t border-slate-100">
          <h3 className="text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-wider flex items-center gap-1">
            <AlertCircle size={12} /> Permohonan Izin
          </h3>

          <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
            {unlockRequests.length > 0 ? (
              unlockRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 bg-white border border-amber-200 rounded-lg shadow-sm flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-bold text-slate-800 text-xs">{req.staff_nama}</span>
                        <span className="text-[8px] px-1 bg-amber-100 text-amber-700 rounded font-bold uppercase">
                          {req.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 italic leading-tight">
                        "{req.alasan}"
                      </p>
                      <p className="text-[8px] text-slate-400 mt-1">
                        {new Date(req.waktu_request).toLocaleTimeString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-1 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleAction(req.id, 'approve')}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-1 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded border border-emerald-200 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={14} /> Setuju
                    </button>
                    <button
                      onClick={() => handleAction(req.id, 'reject')}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-1 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      <XCircle size={14} /> Tolak
                    </button>
                    {req.staff_no_wa && (
                      <button
                        onClick={() => {
                          const cleanNumber = req.staff_no_wa.replace('+', '').replace(' ', '').replace('-', '');
                          navigate(`/whatsapp-chat?number=${cleanNumber}`);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
                        title="Chat Staff via WhatsApp"
                      >
                        <MessageSquare size={14} /> Chat Staff
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                <p className="text-[10px] font-medium text-slate-400">Belum ada permohonan baru.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
