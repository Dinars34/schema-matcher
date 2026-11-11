import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchCatalogEntries, fetchDatasetEntries } from '../api/catalog';
import { fetchCatalogEntryDetail } from '../api/catalogDetail';
import { queryKeys } from '../api/queryKeys';
import { useApiFeature } from '../hooks/useApiFeature';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Table } from '../components/common/Table';

const PAGE_SIZE = 10;

export default function CatalogPage() {
  const navigate = useNavigate();
  const reportFeature = useApiFeature('report');
  const historyFeature = useApiFeature('history');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const datasetFilters = {
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
    page,
    page_size: PAGE_SIZE,
  };
  const datasetsQuery = useQuery({
    queryKey: queryKeys.datasets(datasetFilters),
    queryFn: ({ signal }) => fetchCatalogEntries(datasetFilters, signal),
  });
  const entriesQuery = useQuery({
    queryKey: queryKeys.datasetEntries(selectedDatasetId ?? '', 1, PAGE_SIZE),
    queryFn: ({ signal }) => {
      if (!selectedDatasetId) throw new Error('ID dataset tidak valid.');
      return fetchDatasetEntries(selectedDatasetId, 1, PAGE_SIZE, signal);
    },
    enabled: Boolean(selectedDatasetId),
  });
  const entryQuery = useQuery({
    queryKey: queryKeys.entry(selectedEntryId ?? ''),
    queryFn: ({ signal }) => {
      if (!selectedEntryId) throw new Error('ID entri tidak valid.');
      return fetchCatalogEntryDetail(selectedEntryId, signal);
    },
    enabled: Boolean(selectedEntryId),
  });

  const datasets = datasetsQuery.data?.items ?? [];
  const entries = entriesQuery.data?.items ?? [];
  const total = datasetsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const entry = entryQuery.data;
  const columnRows = (entry?.columns ?? []).map((column, index) => ({
    key: `${column.name}-${index}`,
    cells: [
      <span style={{ fontWeight: 500 }}>{column.name}</span>,
      <span className="mono">{column.data_type}</span>,
    ],
  }));

  return (
    <>
      <PageHeader title="Katalog Dataset">
        {reportFeature.available && (
          <Button variant="primary" onClick={() => navigate('/reports/new')}>
            Ekspor laporan
          </Button>
        )}
      </PageHeader>

      <div>
        <label htmlFor="dataset-search">Cari dataset</label>
        <input
          id="dataset-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Nama atau ID dataset"
        />
      </div>

      <div className="g3">
        <Card>
          <h2>Dataset</h2>
          {datasetsQuery.isPending && <p className="mu">Memuat katalog...</p>}
          {datasetsQuery.isError && (
            <p role="alert" style={{ color: 'var(--ert)' }}>
              Gagal memuat katalog: {datasetsQuery.error.message}
            </p>
          )}
          {datasetsQuery.isSuccess && datasets.length === 0 && (
            <p className="mu">Tidak ada dataset yang cocok.</p>
          )}
          {datasets.map((dataset) => (
            <Button
              key={dataset.dataset_id}
              aria-pressed={selectedDatasetId === dataset.dataset_id}
              onClick={() => {
                setSelectedDatasetId(dataset.dataset_id);
                setSelectedEntryId(null);
              }}
              style={{ width: '100%', justifyContent: 'space-between', marginBottom: '8px' }}
            >
              <span>{dataset.name}</span>
              <span className="mono">{dataset.entry_count}</span>
            </Button>
          ))}
          <div className="catalog-pagination">
            <span className="mu">{total} dataset · {page}/{totalPages}</span>
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
        </Card>

        <Card>
          <h2>Entri</h2>
          {!selectedDatasetId && <p className="mu">Pilih dataset untuk melihat entrinya.</p>}
          {selectedDatasetId && entriesQuery.isPending && <p className="mu">Memuat entri...</p>}
          {entriesQuery.isError && (
            <p role="alert" style={{ color: 'var(--ert)' }}>
              Gagal memuat entri: {entriesQuery.error.message}
            </p>
          )}
          {entriesQuery.isSuccess && entries.length === 0 && (
            <p className="mu">Dataset ini belum memiliki entri.</p>
          )}
          {entries.map((item) => (
            <Button
              key={item.entry_id}
              aria-pressed={selectedEntryId === item.entry_id}
              onClick={() => setSelectedEntryId(item.entry_id)}
              style={{ width: '100%', justifyContent: 'space-between', marginBottom: '8px' }}
            >
              <span>{item.file_name}</span>
              <span className="mu">{item.status}</span>
            </Button>
          ))}
        </Card>

        <Card>
          <h2>Detail Entri</h2>
          {!selectedEntryId && <p className="mu">Pilih entri untuk melihat detailnya.</p>}
          {selectedEntryId && entryQuery.isPending && <p className="mu">Memuat detail entri...</p>}
          {entryQuery.isError && (
            <p role="alert" style={{ color: 'var(--ert)' }}>
              Gagal memuat detail entri: {entryQuery.error.message}
            </p>
          )}
          {entry && (
            <>
              <dl className="catalog-detail">
                <dt>ID entri</dt><dd className="mono">{entry.entry_id}</dd>
                <dt>File sumber</dt><dd>{entry.file_name}</dd>
                <dt>Sumber data</dt><dd>{entry.source || '—'}</dd>
                <dt>Status</dt><dd>{entry.status}</dd>
                <dt>Tahun</dt><dd>{entry.years.length ? entry.years.join(', ') : '—'}</dd>
              </dl>
              <h3>Kolom</h3>
              {columnRows.length > 0
                ? <Table headers={['Nama kolom', 'Tipe data']} rows={columnRows} />
                : <p className="mu">Tidak ada kolom tercatat.</p>}
              {historyFeature.available && (
                <Button
                  style={{ marginTop: '16px' }}
                  onClick={() => navigate(`/catalog/entries/${encodeURIComponent(entry.entry_id)}/history`)}
                >
                  Lihat Riwayat Audit
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
