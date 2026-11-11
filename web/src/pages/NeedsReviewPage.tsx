import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchSubmissions } from '../api/submissions';
import { queryKeys } from '../api/queryKeys';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';

const PAGE_SIZE = 10;

export default function NeedsReviewPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const filters = {
    status: 'draft' as const,
    verdict: 'needs_review' as const,
    sort: '-uploaded_at' as const,
    page,
    page_size: PAGE_SIZE,
  };
  const submissionsQuery = useQuery({
    queryKey: queryKeys.submissions(filters),
    queryFn: ({ signal }) => fetchSubmissions(filters, signal),
  });
  const items = submissionsQuery.data?.items ?? [];
  const total = submissionsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tableRows = items.map((item) => ({
    key: item.id,
    cells: [
      <b style={{ fontWeight: 500 }}>{item.file_name}</b>,
      new Date(item.uploaded_at).toLocaleString(),
      <Badge label={item.verdict ?? 'needs_review'} variant="warning" />,
      <span className="mono">{item.similarity != null ? item.similarity.toFixed(3) : '—'}</span>,
      <Button
        size="sm"
        onClick={() => navigate(`/submissions/${encodeURIComponent(item.id)}`)}
      >
        Review sekarang
      </Button>,
    ],
  }));

  return (
    <>
      <PageHeader title="Antrean Needs Review">
        <p className="mu" style={{ margin: 0 }}>
          Proposal yang memerlukan keputusan manual reviewer.
        </p>
      </PageHeader>

      <Card style={{ padding: '8px 12px' }}>
        {submissionsQuery.isPending && (
          <p className="mu" style={{ padding: '12px' }}>Memuat antrean...</p>
        )}
        {submissionsQuery.isError && (
          <p role="alert" style={{ color: 'var(--ert)', padding: '12px' }}>
            Gagal memuat antrean: {submissionsQuery.error.message}
          </p>
        )}
        {submissionsQuery.isSuccess && items.length === 0 && (
          <p className="mu" style={{ padding: '24px', textAlign: 'center' }}>
            Tidak ada proposal dalam antrean review.
          </p>
        )}
        {submissionsQuery.isSuccess && items.length > 0 && (
          <Table headers={['File', 'Diunggah', 'Verdict', 'Similarity', '']} rows={tableRows} />
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="mu">{total} proposal perlu ditinjau · halaman {page} dari {totalPages}</p>
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
