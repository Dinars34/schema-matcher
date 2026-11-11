import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchJobStatus } from '../api/jobs';
import { queryKeys } from '../api/queryKeys';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

interface JobNavigationState {
  submissionId?: string;
  fileName?: string;
}

function isNavigationState(value: unknown): value is JobNavigationState {
  return typeof value === 'object' && value !== null;
}

export default function ProgressPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navigationState = isNavigationState(location.state) ? location.state : {};
  const submissionId =
    searchParams.get('submission_id') ??
    (typeof navigationState.submissionId === 'string' ? navigationState.submissionId : undefined);
  const fileName =
    searchParams.get('file_name') ??
    (typeof navigationState.fileName === 'string' ? navigationState.fileName : null);

  const jobQuery = useQuery({
    queryKey: queryKeys.job(jobId ?? ''),
    queryFn: ({ signal }) => {
      if (!jobId) throw new Error('ID job tidak valid.');
      return fetchJobStatus(jobId, signal);
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data?.status === 'processing' ? 1_000 : false,
  });

  useEffect(() => {
    if (jobQuery.data?.status !== 'completed' || !submissionId) return;
    const timer = window.setTimeout(
      () => navigate(`/submissions/${encodeURIComponent(submissionId)}`, { replace: true }),
      1_000,
    );
    return () => window.clearTimeout(timer);
  }, [jobQuery.data?.status, navigate, submissionId]);

  const progressValue = jobQuery.data?.progress;
  const status = jobQuery.data?.status;
  const statusLabel =
    status === 'completed'
      ? 'Selesai'
      : status === 'failed'
        ? 'Gagal'
        : status === 'processing'
          ? 'Sedang berjalan'
          : 'Memuat status';

  return (
    <>
      <div>
        <h1>{fileName ? `Menganalisis ${fileName}` : 'Memantau analisis'}</h1>
        <p className="mu" style={{ marginTop: '4px' }}>
          Job <span className="mono">#{jobId ?? '—'}</span> · {statusLabel}
        </p>
      </div>

      {jobQuery.isPending && <p className="mu">Memuat status job...</p>}
      {jobQuery.isError && (
        <div role="alert" style={{ background: 'var(--er)', color: 'var(--ert)', padding: '12px 16px', borderRadius: 'var(--r2)' }}>
          <strong>Status job tidak dapat dimuat:</strong> {jobQuery.error.message}
        </div>
      )}
      {status === 'failed' && (
        <div role="alert" style={{ background: 'var(--er)', color: 'var(--ert)', padding: '12px 16px', borderRadius: 'var(--r2)' }}>
          <strong>Analisis gagal:</strong> {jobQuery.data?.message}
        </div>
      )}
      {status === 'completed' && !submissionId && (
        <p role="status">
          Analisis selesai. ID submission tidak tersedia pada sesi browser ini; buka daftar submission untuk melihat hasil.
        </p>
      )}

      {progressValue !== undefined && (
        <div
          className="bar"
          role="progressbar"
          aria-valuenow={progressValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Kemajuan analisis"
        >
          <i style={{ width: `${progressValue}%`, transition: 'width 0.4s ease' }}></i>
        </div>
      )}

      <Card style={{ padding: '16px 24px' }}>
        <div className="st">
          <Badge
            label={status ?? 'Memuat'}
            variant={status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'running'}
          />
          <span>{jobQuery.data?.message ?? 'Menunggu status dari server.'}</span>
        </div>
      </Card>

      <p className="mu">
        Status diperbarui otomatis dari server. Anda dapat meninggalkan halaman ini dan membuka daftar submission.
      </p>
      <div className="end">
        <Button onClick={() => navigate('/submissions')}>Kembali ke submission</Button>
      </div>
    </>
  );
}
