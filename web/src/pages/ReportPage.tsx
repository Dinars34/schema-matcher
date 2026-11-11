import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchSubmissionReport } from '../api/reports';
import type { ReportFilters } from '../api/reports';
import { downloadReport } from '../lib/reportExport';
import type { ReportFormat } from '../lib/reportExport';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useApiFeature } from '../hooks/useApiFeature';

export default function ReportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedIds = searchParams.get('ids')?.trim() ?? '';
  const reportFeature = useApiFeature('report');
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [status, setStatus] = useState<NonNullable<ReportFilters['status']> | ''>('');
  const [verdict, setVerdict] = useState<NonNullable<ReportFilters['verdict']> | ''>('');
  const [uploadedFrom, setUploadedFrom] = useState('');
  const [uploadedTo, setUploadedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    setFeedback(null);
    setError(null);
    const filters: ReportFilters = {
      ...(status ? { status } : {}),
      ...(verdict ? { verdict } : {}),
      ...(uploadedFrom ? { uploaded_from: uploadedFrom } : {}),
      ...(uploadedTo ? { uploaded_to: uploadedTo } : {}),
      ...(selectedIds ? { ids: selectedIds } : {}),
      sort: '-uploaded_at',
    };

    try {
      const report = await fetchSubmissionReport(filters);
      await downloadReport(report.rows.map((row) => ({ ...row })), format);
      setFeedback(`${report.total} baris laporan diunduh sebagai ${format.toUpperCase()}.`);
    } catch (reportError: unknown) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : 'Terjadi kesalahan saat membuat laporan.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Ekspor Laporan Submission" />
      {selectedIds && (
        <p className="mu">
          Laporan dibatasi pada {selectedIds.split(',').filter(Boolean).length} submission terpilih.
        </p>
      )}

      {!reportFeature.checking && !reportFeature.available && (
        <p role="alert" style={{ background: 'var(--er)', color: 'var(--ert)', padding: '12px 16px', borderRadius: 'var(--r2)' }}>
          Server tidak mengumumkan dukungan laporan.
          {reportFeature.healthError instanceof Error ? ` ${reportFeature.healthError.message}` : ''}
        </p>
      )}

      <div className="g2" style={{ marginBottom: '16px' }}>
        <Card>
          <label htmlFor="report-format" style={{ display: 'block', fontWeight: 500, marginBottom: '8px' }}>
            Format berkas
          </label>
          <select
            id="report-format"
            value={format}
            onChange={(event) => setFormat(event.target.value as ReportFormat)}
            style={{ width: '100%', padding: '8px', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}
          >
            <option value="xlsx">Excel Workbook (.xlsx)</option>
            <option value="csv">Comma-Separated Values (.csv)</option>
          </select>
        </Card>

        <Card>
          <label htmlFor="report-status" style={{ display: 'block', fontWeight: 500, marginBottom: '8px' }}>
            Status submission
          </label>
          <select
            id="report-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            style={{ width: '100%', padding: '8px', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}
          >
            <option value="">Semua status</option>
            <option value="processing">processing</option>
            <option value="draft">draft</option>
            <option value="accepted">accepted</option>
            <option value="merged">merged</option>
            <option value="rejected">rejected</option>
          </select>
        </Card>

        <Card>
          <label htmlFor="report-verdict" style={{ display: 'block', fontWeight: 500, marginBottom: '8px' }}>
            Verdict
          </label>
          <select
            id="report-verdict"
            value={verdict}
            onChange={(event) => setVerdict(event.target.value as typeof verdict)}
            style={{ width: '100%', padding: '8px', borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}
          >
            <option value="">Semua verdict</option>
            <option value="new_dataset">new_dataset</option>
            <option value="new_source">new_source</option>
            <option value="enrichment">enrichment</option>
            <option value="duplicate">duplicate</option>
            <option value="needs_review">needs_review</option>
          </select>
        </Card>

        <Card className="g2">
          <div>
            <label htmlFor="report-from">Diunggah sejak</label>
            <input
              id="report-from"
              type="date"
              value={uploadedFrom}
              max={uploadedTo || undefined}
              onChange={(event) => setUploadedFrom(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="report-to">Diunggah sampai</label>
            <input
              id="report-to"
              type="date"
              value={uploadedTo}
              min={uploadedFrom || undefined}
              onChange={(event) => setUploadedTo(event.target.value)}
            />
          </div>
        </Card>
      </div>

      {feedback && (
        <p role="status" style={{ background: 'var(--ac)', color: '#fff', padding: '12px 16px', borderRadius: 'var(--r2)' }}>
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" style={{ background: 'var(--er)', color: 'var(--ert)', padding: '12px 16px', borderRadius: 'var(--r2)' }}>
          Gagal mengunduh laporan: {error}
        </p>
      )}

      <div className="end">
        <Button onClick={() => navigate('/submissions')} disabled={loading}>
          Kembali ke submission
        </Button>
        <Button
          variant="primary"
          onClick={handleGenerateReport}
          disabled={loading || !reportFeature.available}
        >
          {loading ? 'Memproses laporan...' : 'Unduh laporan'}
        </Button>
      </div>
    </>
  );
}
