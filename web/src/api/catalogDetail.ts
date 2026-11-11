import { apiClient, toApiRequestError } from './client';
import type { components } from './schema';

export type CatalogColumn = components['schemas']['ColumnInfo'];
export type CatalogDetailEntry = components['schemas']['EntryDetail'];

export async function fetchCatalogEntryDetail(
  entryId: string,
  signal?: AbortSignal,
): Promise<CatalogDetailEntry> {
  const { data, error, response } = await apiClient.GET('/catalog/entries/{entry_id}', {
    params: { path: { entry_id: entryId } },
    signal,
  });
  if (error) throw toApiRequestError(error, response.status);
  return data;
}