import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchDatasetEntries } from '../api/catalog';
import { queryKeys } from '../api/queryKeys';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';
import { useApiFeature } from '../hooks/useApiFeature';

const PAGE_SIZE = 10;

export default function DatasetEntriesPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const historyFeature = useApiFeature('history');
  const [page, setPage] = useState(1);
  const entriesQuery = useQuery({
    queryKey: queryKeys.datasetEntries(datasetId ?? '', page, PAGE_SIZE),
    queryFn: ({ signal }) => {
      if (!datasetId) throw new Error('ID dataset tidak valid.');
      return fetchDatasetEntries(datasetId, page, PAGE_SIZE, signal);
    },
    enabled: Boolean(datasetId),
  });
  const entries = entriesQuery.data?.items ?? [];
  const total = entriesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = entries.map((entry) => ({
    key: entry.entry_id,
    cells: [
      <span className="mono">{entry.entry_id}</span>,
      <span style={{ fontWeight: 500 }}>{entry.file_name}</span>,
      entry.source || '—',
      <Badge label={entry.status} variant={entry.status === 'accepted' ? 'success' : 'neutral'} />,
      new Date(entry.updated_at).toLocaleString(),
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          size="sm"
          onClick={() => navigate(`/catalog/entries/${encodeURIComponent(entry.entry_id)}`)}
        >
          Detail
        </Button>
        {historyFeature.available && (
          <Button
            size="sm"
            onClick={() => navigate(`/catalog/entries/${encodeURIComponent(entry.entry_id)}/history`)}
          >
            Riwayat
          </Button>
        )}
      </div>,
    ],
  }));

  return (
    <>
      <PageHeader title={`Entri Dataset: ${datasetId ?? '—'}`}>
        <Button size="sm" onClick={() => navigate('/catalog')}>Kembali ke katalog</Button>
      </PageHeader>

      <Card style={{ padding: '8px 12px' }}>
        {entriesQuery.isPending && <p className="mu" style={{ padding: '12px' }}>Memuat entri...</p>}
        {entriesQuery.isError && (
          <p role="alert" style={{ color: 'var(--ert)', padding: '12px' }}>
            Gagal memuat entri: {entriesQuery.error.message}
          </p>
        )}
        {entriesQuery.isSuccess && entries.length === 0 && (
          <p className="mu" style={{ padding: '24px', textAlign: 'center' }}>
            Dataset ini belum memiliki entri.
          </p>
        )}
        {entriesQuery.isSuccess && entries.length > 0 && (
          <Table
            headers={['ID Entri', 'File', 'Sumber', 'Status', 'Diperbarui', 'Aksi']}
            rows={rows}
          />
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="mu">{total} entri · halaman {page} dari {totalPages}</p>
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
