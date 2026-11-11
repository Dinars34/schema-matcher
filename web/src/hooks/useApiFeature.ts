import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import type { ApiHealth } from '../api/client';

export function useApiFeature(feature: ApiHealth['features'][number]) {
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => fetchHealth(signal),
  });

  return {
    available: healthQuery.data?.features.includes(feature) ?? false,
    checking: healthQuery.isPending,
    healthError: healthQuery.error,
  };
}
