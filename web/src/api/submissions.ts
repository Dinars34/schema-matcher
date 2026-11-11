import { apiClient, toApiRequestError } from './client';
import type { components } from './schema';

export type SubmissionItem = components['schemas']['Submission'];
export type SubmissionPageResponse = components['schemas']['SubmissionPage'];
export type SubmissionStatus = components['schemas']['SubmissionStatus'];
export type Verdict = components['schemas']['Verdict'];

export interface SubmissionFilters {
  page?: number;
  page_size?: number;
  status?: SubmissionStatus;
  verdict?: Verdict;
  uploaded_from?: string;
  uploaded_to?: string;
  sort?: 'uploaded_at' | '-uploaded_at';
}

export async function fetchSubmissions(
  filters: SubmissionFilters = {},
  signal?: AbortSignal,
): Promise<SubmissionPageResponse> {
  const { data, error, response } = await apiClient.GET('/submissions', {
    params: { query: filters },
    signal,
  });
  if (error) throw toApiRequestError(error, response.status);
  return data;
}
