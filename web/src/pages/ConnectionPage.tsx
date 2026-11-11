import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, fetchHealth } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { Card, PageHeader } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

const REVIEWER_STORAGE_KEY = 'reviewer_name';

function displayServerUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl, window.location.origin).href.replace(/\/$/, '');
  } catch {
    return baseUrl;
  }
}

export default function ConnectionPage() {
  const [reviewerName, setReviewerName] = useState(
    () => localStorage.getItem(REVIEWER_STORAGE_KEY) ?? '',
  );
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  const updateReviewerName = (value: string) => {
    setReviewerName(value);
    const name = value.trim();
    if (name) {
      localStorage.setItem(REVIEWER_STORAGE_KEY, name);
    } else {
      localStorage.removeItem(REVIEWER_STORAGE_KEY);
    }
  };

  const connection = healthQuery.isFetching
    ? { label: 'Memeriksa…', variant: 'running' as const }
    : healthQuery.isError
      ? { label: 'Tidak terhubung', variant: 'error' as const }
      : healthQuery.data
        ? { label: 'Terhubung', variant: 'success' as const }
        : { label: 'Belum diuji', variant: 'neutral' as const };

  return (
    <>
      <PageHeader title="Pengaturan" />

      <Card className="settings">
        <div className="field">
          <label htmlFor="server-url">URL server</label>
          <input
            id="server-url"
            value={displayServerUrl(API_BASE_URL)}
            readOnly
            title="Diatur saat build melalui VITE_API_BASE_URL"
          />
        </div>

        <div className="field">
          <label htmlFor="reviewer-name">Nama reviewer</label>
          <input
            id="reviewer-name"
            value={reviewerName}
            placeholder="Nama pengguna"
            maxLength={100}
            autoComplete="name"
            aria-describedby="reviewer-name-hint"
            onChange={(event) => updateReviewerName(event.target.value)}
          />
          <p id="reviewer-name-hint" className="hint">
            Dicantumkan pada keputusan manual. Tersimpan otomatis di browser ini.
          </p>
        </div>

        <div className="settings-actions">
          <Button onClick={() => void healthQuery.refetch()} disabled={healthQuery.isFetching}>
            Uji koneksi
          </Button>
          <span aria-live="polite">
            <Badge label={connection.label} variant={connection.variant} />
          </span>
        </div>

        {healthQuery.isError && !healthQuery.isFetching && (
          <p role="alert" className="settings-error">
            Server tidak dapat dihubungi: {healthQuery.error.message}
          </p>
        )}
        {healthQuery.data && !healthQuery.isError && (
          <p className="hint">
            Versi server {healthQuery.data.version} · Kontrak {healthQuery.data.contract_version} ·
            Fitur: {healthQuery.data.features.join(', ') || 'tidak ada yang diumumkan'}
          </p>
        )}
      </Card>
    </>
  );
}
