import { createApiClient, toApiRequestError } from './client';
import type { components } from './schema';

export type UploadResponse = components['schemas']['UploadResponse'];

export async function uploadSubmission(file: File, sheet: string): Promise<UploadResponse> {
  const { data, error, response } = await createApiClient().POST('/submissions', {
    body: { file: file.name, sheet },
    bodySerializer: () => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('sheet', sheet);
      return formData;
    },
  });
  if (error) throw toApiRequestError(error, response.status);
  return data;
}