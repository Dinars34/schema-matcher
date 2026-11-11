import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { fetchHealth } from '../api/client';
import type { ApiHealth } from '../api/client';
import { fetchSubmissions } from '../api/submissions';
import type { SubmissionFilters } from '../api/submissions';
import { queryKeys } from '../api/queryKeys';

const QUEUE_FILTERS: SubmissionFilters = {
  status: 'draft',
  verdict: 'needs_review',
  sort: '-uploaded_at',
};

const NAV_ITEMS: {
  path: string;
  label: string;
  feature?: ApiHealth['features'][number];
  badge?: boolean;
}[] = [
  { path: '/upload', label: 'Unggah', feature: 'queue' },
  { path: '/submissions', label: 'Submission', feature: 'queue' },
  { path: '/needs-review', label: 'Needs review', feature: 'queue', badge: true },
  { path: '/catalog', label: 'Katalog', feature: 'catalog' },
  { path: '/settings', label: 'Pengaturan' },
];

export default function AppLayout() {
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 30_000,
  });
  const queueQuery = useQuery({
    queryKey: queryKeys.submissions({ ...QUEUE_FILTERS, page: 1, page_size: 1 }),
    queryFn: ({ signal }) =>
      fetchSubmissions({ ...QUEUE_FILTERS, page: 1, page_size: 1 }, signal),
    refetchInterval: 30_000,
  });

  const features = healthQuery.data?.features;

  return (
    <div className="app">
      <a className="skip" href="#main">
        Lewati ke konten
      </a>
      <nav className="side" aria-label="Utama">
        <div className="logo">Schema Matcher</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.filter((item) =>
            !item.feature ||
            healthQuery.isPending ||
            (features?.includes(item.feature) ?? false),
          ).map((item) => (
            <NavLink key={item.path} to={item.path}>
              <span>{item.label}</span>
              {item.badge && queueQuery.data && (
                <span className="n" aria-label={`${queueQuery.data.total} item perlu ditinjau`}>
                  {queueQuery.data.total}
                </span>
              )}
              {item.badge && queueQuery.isError && (
                <span
                  className="n"
                  title={queueQuery.error instanceof Error ? queueQuery.error.message : 'Gagal memuat jumlah antrean.'}
                  aria-label="Jumlah antrean tidak dapat dimuat"
                >
                  !
                </span>
              )}
            </NavLink>
          ))}
        </div>
        <div className="srv" role="status" aria-live="polite">
          <span className="d"></span>
          {healthQuery.isPending
            ? 'Menghubungkan ke server…'
            : healthQuery.isError
              ? 'Server tidak terhubung'
              : 'Server terhubung'}
        </div>
      </nav>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
