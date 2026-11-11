import createClient from 'openapi-fetch';
import type { paths, components } from './schema';

export type ApiHealth = components['schemas']['HealthResponse'];
export type ApiErrorResponse = components['schemas']['ErrorResponse'];

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const apiClient = createClient<paths>({ baseUrl: API_BASE_URL });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export function toApiRequestError(error: unknown, status: number): ApiRequestError {
  if (isRecord(error)) {
    if (typeof error.message === 'string') {
      return new ApiRequestError(
        error.message,
        status,
        typeof error.code === 'string' ? error.code : undefined,
      );
    }
    if ('detail' in error && typeof error.detail === 'string') {
      return new ApiRequestError(error.detail, status);
    }
    if ('detail' in error && Array.isArray(error.detail)) {
      const details = error.detail
        .map((item) => {
          if (!isRecord(item) || !('msg' in item)) return null;
          return typeof item.msg === 'string' ? item.msg : null;
        })
        .filter((message): message is string => message !== null);
      if (details.length > 0) return new ApiRequestError(details.join('; '), status);
    }
  }

  return new ApiRequestError(`Permintaan gagal (HTTP ${status}).`, status);
}

export async function fetchHealth(signal?: AbortSignal): Promise<ApiHealth> {
  const { data, response } = await apiClient.GET('/health', { signal });
  if (!data) {
    throw new ApiRequestError('Server tidak mengembalikan status kesehatan.', response.status);
  }
  return data;
}
