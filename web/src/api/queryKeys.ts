import type { SubmissionFilters } from './submissions';
import type { DatasetFilters } from './catalog';
import type { HistoryFilters } from './history';

export const queryKeys = {
  health: ['health'] as const,
  submissions: (filters: SubmissionFilters) => ['submissions', filters] as const,
  submission: (id: string) => ['submission', id] as const,
  job: (id: string) => ['job', id] as const,
  datasets: (filters: DatasetFilters) => ['datasets', filters] as const,
  datasetEntries: (datasetId: string, page: number, pageSize: number) =>
    ['dataset-entries', datasetId, page, pageSize] as const,
  entry: (id: string) => ['entry', id] as const,
  history: (entryId: string, filters: HistoryFilters) => ['history', entryId, filters] as const,
};
