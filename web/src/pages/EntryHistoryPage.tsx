import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchEntryHistory } from '../api/history';
import type { components } from '../api/schema';
import { queryKeys } from '../api/queryKeys';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Table } from '../components/common/Table';
import { useApiFeature } from '../hooks/useApiFeature';

const PAGE_SIZE = 10;

type EntrySnapshot = components['schemas']['EntrySnapshot'];

function describeSnapshot(snapshot: EntrySnapshot | null | undefined) {
  if (!snapshot) return '—';
  const source = snapshot.source || 'sumber tidak diketahui';
  return `${source}; ${snapshot.columns.length} kolom; tahun ${snapshot.years.join(', ') || '—'}`;
}

export default function EntryHistoryPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const historyFeature = useApiFeature('history');
  const [page, setPage] = useState(1);
  const invalidEntryId = !entryId || entryId === 'undefined';
  const filters = { page, page_size: PAGE_SIZE };
  const historyQuery = useQuery({
    queryKey: queryKeys.history(entryId ?? '', filters),
    queryFn: ({ signal }) => {
      if (!entryId || entryId === 'undefined') throw new Error('ID entri tidak valid.');
      return fetchEntryHistory(entryId, filters, signal);
    },
    enabled: !invalidEntryId && historyFeature.available,
  });
  const events = historyQuery.data?.items ?? [];
  const total = historyQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = events.map((event) => ({
    key: event.event_id,
    cells: [
      new Date(event.decided_at).toLocaleString(),
      <Badge label={event.action} variant="success" />,
      event.decided_by || 'Sistem',
      <div>
        <div><strong>Sebelum:</strong> {event.before ? describeSnapshot(event.before) : '—'}</div>
        <div><strong>Sesudah:</strong> {event.after ? describeSnapshot(event.after) : '—'}</div>
      </div>,
    ],
  }));

  return (
    <>
      <PageHeader title={`Riwayat Entri: ${entryId || 'Tidak diketahui'}`}>
        <Button size="sm" onClick={() => navigate('/catalog')}>Kembali ke katalog</Button>
      </PageHeader>

      <Card style={{ padding: '8px 12px' }}>
        {invalidEntryId && (
          <p role="alert" style={{ color: 'var(--ert)', padding: '12px' }}>ID entri tidak valid.</p>
        )}
        {!invalidEntryId && !historyFeature.checking && !historyFeature.available && (
          <p role="alert" style={{ color: 'var(--ert)', padding: '12px' }}>
            Server tidak mengumumkan dukungan riwayat entri.
          </p>
        )}
        {historyQuery.isPending && !invalidEntryId && historyFeature.available && (
          <p className="mu" style={{ padding: '12px' }}>Memuat riwayat...</p>
        )}
        {historyQuery.isError && (
          <p role="alert" style={{ color: 'var(--ert)', padding: '12px' }}>
            Gagal memuat riwayat: {historyQuery.error.message}
          </p>
        )}
        {historyQuery.isSuccess && events.length === 0 && (
          <p className="mu" style={{ padding: '24px', textAlign: 'center' }}>
            Tidak ada riwayat tercatat.
          </p>
        )}
        {historyQuery.isSuccess && events.length > 0 && (
          <Table headers={['Waktu', 'Aksi', 'Aktor', 'Snapshot']} rows={rows} />
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="mu">{total} peristiwa · halaman {page} dari {totalPages}</p>
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
