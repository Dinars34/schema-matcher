import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, fetchHealth } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';

export default function ConnectionPage() {
  const [reviewerName, setReviewerName] = useState(
    () => localStorage.getItem('reviewer_name') ?? '',
  );
  const [saved, setSaved] = useState(false);
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  const saveReviewerName = () => {
    const name = reviewerName.trim();
    if (!name) {
      localStorage.removeItem('reviewer_name');
      setReviewerName('');
    } else {
      localStorage.setItem('reviewer_name', name);
      setReviewerName(name);
    }
    setSaved(true);
  };

  return (
    <>
      <PageHeader title="Koneksi & Pengaturan">
        <Button size="sm" onClick={() => void healthQuery.refetch()} disabled={healthQuery.isFetching}>
          {healthQuery.isFetching ? 'Memeriksa...' : 'Periksa server'}
        </Button>
      </PageHeader>

      <Card>
        <h2>Koneksi API</h2>
        <p>Base URL: <code>{API_BASE_URL}</code></p>
        {healthQuery.isPending && <p className="mu">Memeriksa koneksi server...</p>}
        {healthQuery.isError && (
          <p role="alert" style={{ color: 'var(--ert)' }}>
            Server tidak dapat dihubungi: {healthQuery.error.message}
          </p>
        )}
        {healthQuery.data && (
          <>
            <p role="status">Status: {healthQuery.data.status}</p>
            <p>Versi server: {healthQuery.data.version}</p>
            <p>Versi kontrak: {healthQuery.data.contract_version}</p>
            <p>Fitur yang didukung: {healthQuery.data.features.join(', ') || 'Tidak ada fitur yang diumumkan.'}</p>
          </>
        )}
      </Card>

      <Card>
        <h2>Reviewer</h2>
        <p className="mu">
          Nama ini dicantumkan sebagai pelaku keputusan manual dan disimpan hanya di browser ini.
        </p>
        <label htmlFor="reviewer-name">Nama reviewer</label>
        <input
          id="reviewer-name"
          value={reviewerName}
          maxLength={100}
          onChange={(event) => {
            setReviewerName(event.target.value);
            setSaved(false);
          }}
        />
        <div className="end">
          {saved && <span role="status">Pengaturan tersimpan.</span>}
          <Button variant="primary" onClick={saveReviewerName}>Simpan nama</Button>
        </div>
      </Card>
    </>
  );
}
