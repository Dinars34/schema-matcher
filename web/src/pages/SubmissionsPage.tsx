import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchSubmissions } from '../api/submissions';
import type { SubmissionFilters, SubmissionStatus, Verdict } from '../api/submissions';
import { queryKeys } from '../api/queryKeys';
import { useApiFeature } from '../hooks/useApiFeature';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';

const PAGE_SIZE = 10;

function getStatusVariant(status: SubmissionStatus) {
  if (status === 'accepted' || status === 'merged') return 'success';
  if (status === 'processing') return 'running';
  if (status === 'rejected') return 'error';
  return 'neutral';
}

function getVerdictVariant(verdict: Verdict) {
  if (verdict === 'enrichment' || verdict === 'new_dataset' || verdict === 'new_source') return 'success';
  if (verdict === 'needs_review') return 'warning';
  return 'error';
}

export default function SubmissionsPage() {
  const navigate = useNavigate();
  const reportFeature = useApiFeature('report');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SubmissionStatus | ''>('');
  const [verdict, setVerdict] = useState<Verdict | ''>('');
  const [uploadedFrom, setUploadedFrom] = useState('');
  const [uploadedTo, setUploadedTo] = useState('');
  const [sort, setSort] = useState<NonNullable<SubmissionFilters['sort']>>('-uploaded_at');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters: SubmissionFilters = {
    page,
    page_size: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(verdict ? { verdict } : {}),
    ...(uploadedFrom ? { uploaded_from: uploadedFrom } : {}),
    ...(uploadedTo ? { uploaded_to: uploadedTo } : {}),
    sort,
  };
  const submissionsQuery = useQuery({
    queryKey: queryKeys.submissions(filters),
    queryFn: ({ signal }) => fetchSubmissions(filters, signal),
  });
  const items = submissionsQuery.data?.items ?? [];
  const total = submissionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetPage = () => setPage(1);
  const clearSelection = () => setSelectedIds(new Set());
  const allVisibleSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const toggleVisibleSelection = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) items.forEach((item) => next.delete(item.id));
    else items.forEach((item) => next.add(item.id));
    setSelectedIds(next);
  };
  const tableRows = items.map((item) => ({
    key: item.id,
    cells: [
      <input
        type="checkbox"
        aria-label={`Pilih ${item.file_name}`}
        checked={selectedIds.has(item.id)}
        onChange={() => {
          const next = new Set(selectedIds);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          setSelectedIds(next);
        }}
        style={{ width: '18px', height: '18px', accentColor: 'var(--ac)' }}
      />,
      <b style={{ fontWeight: 500 }}>{item.file_name}</b>,
      new Date(item.uploaded_at).toLocaleString(),
      <Badge label={item.status} variant={getStatusVariant(item.status)} />,
      item.verdict
        ? <Badge label={item.verdict} variant={getVerdictVariant(item.verdict)} />
        : '—',
      <span className="mono">
        {item.similarity != null ? item.similarity.toFixed(3) : '—'}
      </span>,
      <Button size="sm" onClick={() => navigate(`/submissions/${encodeURIComponent(item.id)}`)}>
        Buka
      </Button>,
    ],
  }));

  return (
    <>
      <PageHeader title="Submission">
        {selectedIds.size > 0 && reportFeature.available && (
          <Button
            onClick={() =>
              navigate(`/reports/new?ids=${encodeURIComponent([...selectedIds].join(','))}`)
            }
          >
            Ekspor pilihan ({selectedIds.size})
          </Button>
        )}
        {reportFeature.available && (
          <Button onClick={() => navigate('/reports/new')}>Ekspor laporan</Button>
        )}
        <Button variant="primary" onClick={() => navigate('/upload')}>
          Unggah baru
        </Button>
      </PageHeader>

      <div className="gf">
        <div>
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SubmissionStatus | '');
              clearSelection();
              resetPage();
            }}
          >
            <option value="">Semua</option>
            <option value="processing">processing</option>
            <option value="draft">draft</option>
            <option value="accepted">accepted</option>
            <option value="merged">merged</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
        <div>
          <label htmlFor="verdict-filter">Verdict</label>
          <select
            id="verdict-filter"
            value={verdict}
            onChange={(event) => {
              setVerdict(event.target.value as Verdict | '');
              clearSelection();
              resetPage();
            }}
          >
            <option value="">Semua</option>
            <option value="new_dataset">new_dataset</option>
            <option value="new_source">new_source</option>
            <option value="enrichment">enrichment</option>
            <option value="duplicate">duplicate</option>
            <option value="needs_review">needs_review</option>
          </select>
        </div>
        <div>
          <label htmlFor="uploaded-from">Diunggah sejak</label>
          <input
            id="uploaded-from"
            type="date"
            value={uploadedFrom}
            max={uploadedTo || undefined}
            onChange={(event) => {
              setUploadedFrom(event.target.value);
              clearSelection();
              resetPage();
            }}
          />
        </div>
        <div>
          <label htmlFor="uploaded-to">Diunggah sampai</label>
          <input
            id="uploaded-to"
            type="date"
            value={uploadedTo}
            min={uploadedFrom || undefined}
            onChange={(event) => {
              setUploadedTo(event.target.value);
              clearSelection();
              resetPage();
            }}
          />
        </div>
        <div>
          <label htmlFor="sort">Urutan</label>
          <select
            id="sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as NonNullable<SubmissionFilters['sort']>);
              clearSelection();
              resetPage();
            }}
          >
            <option value="-uploaded_at">Terbaru</option>
            <option value="uploaded_at">Terlama</option>
          </select>
        </div>
      </div>

      <Card style={{ padding: '8px 12px' }}>
        {submissionsQuery.isPending && (
          <p className="mu" style={{ padding: '12px' }}>Memuat data submission...</p>
        )}
        {submissionsQuery.isError && (
          <p role="alert" style={{ color: 'var(--ert)', padding: '12px' }}>
            Gagal memuat: {submissionsQuery.error.message}
          </p>
        )}
        {submissionsQuery.isSuccess && items.length === 0 && (
          <p className="mu" style={{ padding: '24px', textAlign: 'center' }}>
            Tidak ada submission yang cocok dengan filter.
          </p>
        )}
        {submissionsQuery.isSuccess && items.length > 0 && (
          <Table
            headers={[
              <input
                type="checkbox"
                aria-label="Pilih semua pada halaman"
                onChange={toggleVisibleSelection}
                checked={allVisibleSelected}
                style={{ width: '18px', height: '18px', accentColor: 'var(--ac)' }}
              />,
              'File',
              'Diunggah',
              'Status',
              'Verdict',
              'Similarity',
              '',
            ]}
            rows={tableRows}
          />
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="mu" id="cnt">
          {selectedIds.size} dipilih · {total} submission · halaman {page} dari {totalPages}
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Sebelumnya
          </Button>
          <Button
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Selanjutnya
          </Button>
        </div>
      </div>
    </>
  );
}
