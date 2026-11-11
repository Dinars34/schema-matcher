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
import { Badge } from '../components/common/Badge';
import type { CatalogEntryItem } from '../api/catalog';

const PAGE_SIZE = 10;

function statusVariant(status: CatalogEntryItem['status']) {
  return status === 'accepted' || status === 'merged' ? 'success' : 'neutral';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
  const entriesTotal = entriesQuery.data?.total ?? 0;
  const total = datasetsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedDataset = datasets.find((dataset) => dataset.dataset_id === selectedDatasetId);
  const entry = entryQuery.data;
  const columnRows = (entry?.columns ?? []).map((column, index) => ({
    key: `${column.name}-${index}`,
    cells: [
      <span className="col-name">{column.name}</span>,
      <span className="type-tag">{column.data_type}</span>,
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

      <div className="catalog">
        <Card className="pane">
          <div className="pane-hd">
            <h2>Dataset</h2>
            {datasetsQuery.isSuccess && <span className="count">{total}</span>}
          </div>
          {datasetsQuery.isPending && <p className="mu">Memuat katalog...</p>}
          {datasetsQuery.isError && (
            <p role="alert" className="pane-error">
              Gagal memuat katalog: {datasetsQuery.error.message}
            </p>
          )}
          {datasetsQuery.isSuccess && datasets.length === 0 && (
            <p className="mu">Tidak ada dataset yang cocok.</p>
          )}
          {datasets.length > 0 && (
            <ul className="pick-list">
              {datasets.map((dataset) => (
                <li key={dataset.dataset_id}>
                  <button
                    type="button"
                    className="pick"
                    aria-pressed={selectedDatasetId === dataset.dataset_id}
                    onClick={() => {
                      setSelectedDatasetId(dataset.dataset_id);
                      setSelectedEntryId(null);
                    }}
                  >
                    <span className="pick-title" title={dataset.name}>{dataset.name}</span>
                    <span className="pick-meta">
                      {dataset.entry_count} entri
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 && (
            <div className="pager">
              <span className="mu">Hal. {page} dari {totalPages}</span>
              <div className="pager-btns">
                <Button
                  size="sm"
                  aria-label="Halaman sebelumnya"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  ‹
                </Button>
                <Button
                  size="sm"
                  aria-label="Halaman selanjutnya"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  ›
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="pane">
          <div className="pane-hd">
            <h2>Entri</h2>
            {entriesQuery.isSuccess && <span className="count">{entriesTotal}</span>}
          </div>
          {selectedDataset && (
            <p className="pane-sub" title={selectedDataset.name}>{selectedDataset.name}</p>
          )}
          {!selectedDatasetId && <p className="mu">Pilih dataset untuk melihat entrinya.</p>}
          {selectedDatasetId && entriesQuery.isPending && <p className="mu">Memuat entri...</p>}
          {entriesQuery.isError && (
            <p role="alert" className="pane-error">
              Gagal memuat entri: {entriesQuery.error.message}
            </p>
          )}
          {entriesQuery.isSuccess && entries.length === 0 && (
            <p className="mu">Dataset ini belum memiliki entri.</p>
          )}
          {entries.length > 0 && (
            <ul className="pick-list">
              {entries.map((item) => (
                <li key={item.entry_id}>
                  <button
                    type="button"
                    className="pick"
                    aria-pressed={selectedEntryId === item.entry_id}
                    onClick={() => setSelectedEntryId(item.entry_id)}
                  >
                    <span className="pick-title" title={item.file_name}>{item.file_name}</span>
                    <span className="pick-row">
                      <Badge label={item.status} variant={statusVariant(item.status)} />
                      <span className="pick-meta">
                        {item.years.length > 0 ? `Tahun ${item.years.join(', ')} · ` : ''}
                        {formatDate(item.updated_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedDatasetId && entriesTotal > entries.length && (
            <Button
              size="sm"
              className="pane-more"
              onClick={() =>
                navigate(`/catalog/datasets/${encodeURIComponent(selectedDatasetId)}/entries`)
              }
            >
              Lihat semua {entriesTotal} entri
            </Button>
          )}
        </Card>

        <Card className="pane detail">
          <div className="pane-hd">
            <h2>Detail Entri</h2>
            {entry && <Badge label={entry.status} variant={statusVariant(entry.status)} />}
          </div>
          {!selectedEntryId && <p className="mu">Pilih entri untuk melihat detailnya.</p>}
          {selectedEntryId && entryQuery.isPending && <p className="mu">Memuat detail entri...</p>}
          {entryQuery.isError && (
            <p role="alert" className="pane-error">
              Gagal memuat detail entri: {entryQuery.error.message}
            </p>
          )}
          {entry && (
            <>
              <p className="detail-title">{entry.file_name}</p>
              <dl className="facts">
                <div className="wide">
                  <dt>ID entri</dt>
                  <dd className="mono">{entry.entry_id}</dd>
                </div>
                <div>
                  <dt>Sumber data</dt>
                  <dd>{entry.source || '—'}</dd>
                </div>
                <div>
                  <dt>Tahun</dt>
                  <dd>{entry.years.length ? entry.years.join(', ') : '—'}</dd>
                </div>
                <div className="wide">
                  <dt>Terakhir diperbarui</dt>
                  <dd>{formatDate(entry.updated_at)}</dd>
                </div>
              </dl>
              <div className="pane-hd sub">
                <h3>Kolom</h3>
                <span className="count">{columnRows.length}</span>
              </div>
              {columnRows.length > 0
                ? <Table headers={['Nama kolom', 'Tipe data']} rows={columnRows} />
                : <p className="mu">Tidak ada kolom tercatat.</p>}
              {historyFeature.available && (
                <Button
                  className="pane-action"
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
