import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCatalogEntryDetail } from '../api/catalogDetail';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Table } from '../components/common/Table';
import { useApiFeature } from '../hooks/useApiFeature';
import { queryKeys } from '../api/queryKeys';

export default function CatalogDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const historyFeature = useApiFeature('history');
  const invalidEntryId = !entryId || entryId === 'undefined';

  const entryQuery = useQuery({
    queryKey: queryKeys.entry(entryId ?? ''),
    queryFn: ({ signal }) => {
      if (!entryId || entryId === 'undefined') {
        throw new Error('ID entri tidak valid.');
      }
      return fetchCatalogEntryDetail(entryId, signal);
    },
    enabled: !invalidEntryId,
  });

  if (invalidEntryId) {
    return (
      <div style={{ padding: '24px' }}>
        <p role="alert" style={{ color: 'var(--ert)' }}>ID entri tidak valid.</p>
        <Button onClick={() => navigate('/catalog')}>Kembali ke katalog</Button>
      </div>
    );
  }

  if (entryQuery.isPending) {
    return <p className="mu" style={{ padding: '24px' }}>Memuat detail dataset...</p>;
  }

  if (entryQuery.isError || !entryQuery.data) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ color: 'var(--ert)' }}>
          Error: {entryQuery.error instanceof Error ? entryQuery.error.message : 'Data tidak ditemukan.'}
        </p>
        <Button onClick={() => navigate('/catalog')}>Kembali ke Katalog</Button>
      </div>
    );
  }

  const entry = entryQuery.data;
  const columnHeaders = ['Nama Kolom', 'Tipe Data'];
  const columnRows = (entry.columns || []).map((col, idx) => ({
    key: idx,
    cells: [
      <span style={{ fontWeight: 500 }}>{col.name}</span>,
      <span className="mono">{col.data_type}</span>,
    ],
  }));

  return (
    <>
      <PageHeader title={`Dataset: ${entry.dataset_name}`}>
        <span className="mono" style={{ color: 'var(--mu)' }}>
          ID entri: {entry.entry_id}
        </span>
      </PageHeader>

      <Card className="g2">
        <div>
          <p className="mu" style={{ margin: '0 0 4px' }}>File sumber</p>
          <p style={{ fontWeight: 500, margin: 0 }}>{entry.file_name}</p>
        </div>
        <div>
          <p className="mu" style={{ margin: '0 0 4px' }}>Sumber data</p>
          <p style={{ fontWeight: 500, margin: 0 }}>{entry.source || '—'}</p>
        </div>
        <div>
          <p className="mu" style={{ margin: '0 0 4px' }}>Dataset ID</p>
          <p className="mono" style={{ margin: 0 }}>{entry.dataset_id}</p>
        </div>
        <div>
          <p className="mu" style={{ margin: '0 0 4px' }}>Status</p>
          <p style={{ fontWeight: 500, margin: 0 }}>{entry.status}</p>
        </div>
        <div>
          <p className="mu" style={{ margin: '0 0 4px' }}>Terakhir diperbarui</p>
          <p style={{ fontWeight: 500, margin: 0 }}>
            {new Date(entry.updated_at).toLocaleDateString()}
          </p>
        </div>
      </Card>

      <div className="g2">
        <Card>
          <h2>Struktur Kolom Schema</h2>
          <Table headers={columnHeaders} rows={columnRows} />
        </Card>

        <Card>
          <h2>Cakupan Tahun Data</h2>
          <p style={{ fontSize: '16px', fontWeight: 500, margin: '8px 0 0' }}>
            {entry.years && entry.years.length > 0 ? entry.years.join(', ') : 'Tidak ada tahun tercatat'}
          </p>
        </Card>
      </div>

      <div className="end">
        <Button onClick={() => navigate('/catalog')}>Kembali ke Katalog</Button>
        {historyFeature.available && (
          <Button variant="primary" onClick={() => navigate(`/catalog/entries/${entryId}/history`)}>
            Lihat Riwayat Audit
          </Button>
        )}
      </div>
    </>
  );
}