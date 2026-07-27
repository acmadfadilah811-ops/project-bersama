import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { Kanban } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

// Hook & Komponen
import { useJobsData } from '../../hooks/useJobsData';
import { STAFF_COLUMNS } from '../../components/jobConstants';
import JobCard from '../../components/JobCard';
import EditJobModal from '../../components/modals/EditJobModal';
import ForwardJobModal from '../../components/modals/ForwardJobModal';
import WorkspaceModal from '../../components/modals/WorkspaceModal';
import QueueStartModal from '../../components/modals/QueueStartModal';
import FailedDetailModal from '../../components/modals/FailedDetailModal';
import FailedReasonModal from '../../components/modals/FailedReasonModal';
import WorkspaceReviewModal from '../../components/modals/WorkspaceReviewModal';

export default function KanbanGlobalPanel() {
  const { user } = useAuth();
  const isManager = ['owner', 'manager', 'admin'].includes(user?.role?.toLowerCase());

  // Data & Handlers dari custom hook
  const {
    jobs,
    orderMap,
    loading,
    saving,
    error,
    tahapList,
    staffList,
    groupedByStatus,
    fetchData,
    handleModalSave,
    handleForward,
    handleWorkspaceSave,
  } = useJobsData();

  // State Modal
  const [editJob, setEditJob] = useState(null);
  const [forwardJob, setForwardJob] = useState(null);
  const [workspaceJob, setWorkspaceJob] = useState(null); // { job, orderItemData, fromStart }
  const [queueStartJob, setQueueStartJob] = useState(null); // { job, orderInfo }
  const [failedDetailJob, setFailedDetailJob] = useState(null); // { job, orderInfo }
  const [failedReasonJob, setFailedReasonJob] = useState(null); // { job, orderInfo, pendingData }
  const [workspaceReviewJob, setWorkspaceReviewJob] = useState(null); // { job, orderItemData }

  // Sync Modal States
  useEffect(() => {
    if (workspaceJob) {
      const updatedJob = jobs.find((j) => j.id === workspaceJob.job.id);
      const orderItemId = typeof workspaceJob.job.order_item === 'object' ? workspaceJob.job.order_item?.id : workspaceJob.job.order_item;
      const updatedOrderInfo = orderMap[orderItemId];
      
      const jobChanged = updatedJob && JSON.stringify(updatedJob) !== JSON.stringify(workspaceJob.job);
      const orderChanged = updatedOrderInfo && JSON.stringify(updatedOrderInfo) !== JSON.stringify(workspaceJob.orderItemData);
      
      if (jobChanged || orderChanged) {
        setWorkspaceJob((prev) => ({
          ...prev,
          job: updatedJob || prev.job,
          orderItemData: updatedOrderInfo || prev.orderItemData
        }));
      }
    }
    if (workspaceReviewJob) {
      const updatedJob = jobs.find((j) => j.id === workspaceReviewJob.job.id);
      const orderItemId = typeof workspaceReviewJob.job.order_item === 'object' ? workspaceReviewJob.job.order_item?.id : workspaceReviewJob.job.order_item;
      const updatedOrderInfo = orderMap[orderItemId];
      
      const jobChanged = updatedJob && JSON.stringify(updatedJob) !== JSON.stringify(workspaceReviewJob.job);
      const orderChanged = updatedOrderInfo && JSON.stringify(updatedOrderInfo) !== JSON.stringify(workspaceReviewJob.orderItemData);
      
      if (jobChanged || orderChanged) {
        setWorkspaceReviewJob((prev) => ({
          ...prev,
          job: updatedJob || prev.job,
          orderItemData: updatedOrderInfo || prev.orderItemData
        }));
      }
    }
  }, [jobs, orderMap, workspaceJob, workspaceReviewJob]);

  // Buka workspace sesuai kolom status
  const openWorkspace = (job) => {
    const orderItemId = typeof job.order_item === 'object' ? job.order_item?.id : job.order_item;
    const orderInfo = orderMap[orderItemId];

    if (job.status_pekerjaan === 'antrean') {
      setQueueStartJob({ job, orderInfo });
    } else if (job.status_pekerjaan === 'gagal') {
      setFailedDetailJob({ job, orderInfo });
    } else if (job.status_pekerjaan === 'selesai') {
      setWorkspaceReviewJob({ job, orderItemData: orderInfo });
    } else {
      setWorkspaceJob({ job, orderItemData: orderInfo, fromStart: false });
    }
  };

  // Memulai Pekerjaan dari Papan Antrean
  const handleStartJob = async (job) => {
    try {
      await apiClient.patch(`/jobs/${job.id}/`, { status_pekerjaan: 'dikerjakan' });
      await fetchData(true);
      setQueueStartJob(null);
      const orderItemId = typeof job.order_item === 'object' ? job.order_item?.id : job.order_item;
      setWorkspaceJob({ job, orderItemData: orderMap[orderItemId], fromStart: false });
    } catch {
      alert('Gagal memulai pekerjaan.');
    }
  };

  // Menyimpan Alasan Gagal & Form Data Workspace
  const handleSaveFailedReason = async (reason) => {
    if (!failedReasonJob) return;
    const data = {
      ...failedReasonJob.pendingData,
      statusPekerjaan: 'gagal',
      alasanGagal: reason,
    };
    const result = await handleWorkspaceSave(data);
    if (result.ok) {
      setFailedReasonJob(null);
    } else {
      alert(result.error);
    }
  };

  // Mengajukan Revisi (Pekerjaan Selesai -> Dikerjakan)
  const handleRequestRevision = async (job) => {
    try {
      await apiClient.patch(`/jobs/${job.id}/`, {
        status_pekerjaan: 'dikerjakan',
        otp_code: '',
        otp_sent: false,
        otp_requested: false,
      });
      await fetchData(true);
      setWorkspaceReviewJob(null);
      const orderItemId = typeof job.order_item === 'object' ? job.order_item?.id : job.order_item;
      setWorkspaceJob({ job, orderItemData: orderMap[orderItemId], fromStart: false });
    } catch {
      alert('Gagal memproses revisi pekerjaan.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs">Memuat papan Kanban...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-3 pb-4 max-w-[1400px] mx-auto min-h-0">
      {/* Header Panel */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <h1 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Kanban size={13} className="text-indigo-650" />
            Papan Kanban Produksi (Global)
          </h1>
          <p className="text-[10px] text-slate-500 font-medium">
            Visualisasi alur kerja produksi seluruh divisi dari Antrean hingga Selesai.
          </p>
        </div>
      </div>

      {/* Kanban Scroll Container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-4 min-h-[300px] custom-scrollbar">
        {STAFF_COLUMNS.map((col) => {
          const colJobs = groupedByStatus[col.id] || [];
          return (
            <div key={col.id} className="flex-shrink-0 w-[270px] flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className={`flex items-center justify-between px-3 py-2 shrink-0 ${col.headerColor}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">{col.label}</span>
                </div>
                <span className="text-[10px] font-black bg-white/80 px-2 py-0.5 rounded-full text-slate-700">
                  {colJobs.length}
                </span>
              </div>
              
              <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                {colJobs.length === 0 ? (
                  <p className="text-center text-slate-400 text-[10px] py-8 italic">Tidak ada job</p>
                ) : (
                  colJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      orderInfo={
                        orderMap[
                          typeof job.order_item === 'object' ? job.order_item?.id : job.order_item
                        ]
                      }
                      onOpenWorkspace={() => openWorkspace(job)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <ForwardJobModal
        job={forwardJob}
        orderMap={orderMap}
        tahapList={tahapList}
        staffList={staffList}
        saving={saving}
        onSubmit={async (jobId, data) => {
          const result = await handleForward(jobId, data);
          if (result.ok) setForwardJob(null);
          else alert(result.error);
        }}
        onClose={() => setForwardJob(null)}
      />

      <EditJobModal
        job={editJob}
        orderMap={orderMap}
        tahapList={tahapList}
        staffList={staffList}
        saving={saving}
        isManager={isManager}
        onSubmit={async (jobId, formData) => {
          const result = await handleModalSave(jobId, formData, isManager);
          if (result.ok) setEditJob(null);
          else alert(result.error);
        }}
        onClose={() => setEditJob(null)}
      />

      {workspaceJob && (
        <WorkspaceModal
          workspaceJob={workspaceJob}
          saving={saving}
          onSubmit={async (data) => {
            if (data.statusPekerjaan === 'gagal') {
              setFailedReasonJob({
                job: workspaceJob.job,
                orderInfo: workspaceJob.orderItemData,
                pendingData: data,
              });
              setWorkspaceJob(null);
            } else {
              const result = await handleWorkspaceSave(data);
              if (result.ok) setWorkspaceJob(null);
              else alert(result.error);
            }
          }}
          onVerifySuccess={(job) => {
            setWorkspaceJob(null);
            setForwardJob(job);
          }}
          onClose={() => setWorkspaceJob(null)}
        />
      )}

      {queueStartJob && (
        <QueueStartModal
          job={queueStartJob.job}
          orderInfo={queueStartJob.orderInfo}
          onSubmit={() => handleStartJob(queueStartJob.job)}
          onClose={() => setQueueStartJob(null)}
        />
      )}

      {failedDetailJob && (
        <FailedDetailModal
          job={failedDetailJob.job}
          orderInfo={failedDetailJob.orderInfo}
          onClose={() => setFailedDetailJob(null)}
        />
      )}

      {failedReasonJob && (
        <FailedReasonModal
          job={failedReasonJob.job}
          orderInfo={failedReasonJob.orderInfo}
          onSubmit={handleSaveFailedReason}
          onClose={() => {
            setWorkspaceJob({
              job: failedReasonJob.job,
              orderItemData: failedReasonJob.orderInfo,
              fromStart: false,
            });
            setFailedReasonJob(null);
          }}
        />
      )}

      {workspaceReviewJob && (
        <WorkspaceReviewModal
          workspaceJob={workspaceReviewJob}
          onRevisi={handleRequestRevision}
          onClose={() => setWorkspaceReviewJob(null)}
        />
      )}
    </div>
  );
}
