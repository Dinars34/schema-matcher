import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ConnectionPage from './pages/ConnectionPage';
import SubmissionsPage from './pages/SubmissionsPage';
import UploadPage from './pages/UploadPage';
import ProgressPage from './pages/ProgressPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage';
import NeedsReviewPage from './pages/NeedsReviewPage';
import CatalogPage from './pages/CatalogPage';
import DatasetEntriesPage from './pages/DatasetEntriesPage';
import CatalogDetailPage from './pages/CatalogDetailPage';
import EntryHistoryPage from './pages/EntryHistoryPage';
import ReportPage from './pages/ReportPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/submissions" replace />} />

            <Route path="/upload" element={<UploadPage />} />
            <Route path="/submissions" element={<SubmissionsPage />} />
            <Route path="/needs-review" element={<NeedsReviewPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/catalog/datasets/:datasetId/entries" element={<DatasetEntriesPage />} />
            <Route path="/catalog/entries/:entryId" element={<CatalogDetailPage />} />
            <Route path="/catalog/entries/:entryId/history" element={<EntryHistoryPage />} />
            <Route path="/settings" element={<ConnectionPage />} />

            <Route path="/jobs/:jobId" element={<ProgressPage />} />
            <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="/reports/new" element={<ReportPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}