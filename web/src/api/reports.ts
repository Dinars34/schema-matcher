import { apiClient, toApiRequestError } from './client';
import type { components } from './schema';
import type { SubmissionFilters } from './submissions';

export type ReportResponse = components['schemas']['ReportData'];

export type ReportFilters = Pick<
  SubmissionFilters,
  'status' | 'verdict' | 'uploaded_from' | 'uploaded_to' | 'sort'
> & { ids?: string };

export async function fetchSubmissionReport(
  filters: ReportFilters = {},
  signal?: AbortSignal,
): Promise<ReportResponse> {
  const { data, error, response } = await apiClient.GET('/reports/submissions', {
    params: { query: filters },
    signal,
  });
  if (error) throw toApiRequestError(error, response.status);
  return data;
}