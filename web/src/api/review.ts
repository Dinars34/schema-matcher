import { createApiClient, toApiRequestError } from './client';
import type { components } from './schema';

export type SubmissionDetail = components['schemas']['SubmissionDetail'];
export type SchemaColumn = components['schemas']['ColumnInfo'];
export type DecisionPayload = components['schemas']['DecisionRequest'];
export type DecisionResponse = components['schemas']['DecisionResponse'];

export async function fetchSubmissionDetail(id: string, signal?: AbortSignal): Promise<SubmissionDetail> {
  const { data, error, response } = await createApiClient().GET('/submissions/{submission_id}', {
    params: { path: { submission_id: id } },
    signal,
  });
  if (error) throw toApiRequestError(error, response.status);
  return data;
}

export async function submitDecision(
  id: string,
  payload: DecisionPayload,
): Promise<DecisionResponse> {
  const { data, error, response } = await createApiClient().POST(
    '/submissions/{submission_id}/decision',
    { params: { path: { submission_id: id } }, body: payload },
  );
  if (error) throw toApiRequestError(error, response.status);
  return data;
}