import { apiClient, toApiRequestError } from './client';
import type { components } from './schema';

export type HistoryEvent = components['schemas']['HistoryEvent'];
export type HistoryPage = components['schemas']['HistoryPage'];

export interface HistoryFilters {
  page?: number;
  page_size?: number;
}

export async function fetchEntryHistory(
  entryId: string,
  filters: HistoryFilters = {},
  signal?: AbortSignal,
): Promise<HistoryPage> {
  const { data, error, response } = await apiClient.GET(
    '/catalog/entries/{entry_id}/history',
    {
      params: {
        path: { entry_id: entryId },
        query: filters,
      },
      signal,
    },
  );
  if (error) throw toApiRequestError(error, response.status);
  return data;
}