import { apiClient, toApiRequestError } from './client';
import type { components } from './schema';

export type CatalogDatasetItem = components['schemas']['DatasetSummary'];
export type CatalogResponse = components['schemas']['DatasetPage'];
export type CatalogEntryItem = components['schemas']['EntrySummary'];
export type CatalogEntryPage = components['schemas']['EntryPage'];

export interface DatasetFilters {
  q?: string;
  page?: number;
  page_size?: number;
}

export async function fetchCatalogEntries(
  filters: DatasetFilters = {},
  signal?: AbortSignal,
): Promise<CatalogResponse> {
  const { data, error, response } = await apiClient.GET('/catalog/datasets', {
    params: { query: filters },
    signal,
  });
  if (error) throw toApiRequestError(error, response.status);
  return data;
}

export async function fetchDatasetEntries(
  datasetId: string,
  page = 1,
  pageSize = 10,
  signal?: AbortSignal,
): Promise<CatalogEntryPage> {
  const { data, error, response } = await apiClient.GET(
    '/catalog/datasets/{dataset_id}/entries',
    {
      params: {
        path: { dataset_id: datasetId },
        query: { page, page_size: pageSize },
      },
      signal,
    },
  );
  if (error) throw toApiRequestError(error, response.status);
  return data;
}