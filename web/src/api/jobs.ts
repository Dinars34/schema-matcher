import { createApiClient, toApiRequestError } from './client';
import type { components } from './schema';

export type JobStatusResponse = components['schemas']['JobStatusResponse'];

export async function fetchJobStatus(jobId: string, signal?: AbortSignal): Promise<JobStatusResponse> {
  const { data, error, response } = await createApiClient().GET('/jobs/{job_id}', {
    params: { path: { job_id: jobId } },
    signal,
  });
  if (error) throw toApiRequestError(error, response.status);
  return data;
}