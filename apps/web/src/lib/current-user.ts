import { currentUserSchema } from '@rota-ready/shared';
import { queryOptions } from '@tanstack/react-query';
import { apiPut } from './api';

export const currentUserQuery = queryOptions({
  queryKey: ['currentUser'],
  queryFn: () => apiPut('/api/me', currentUserSchema),
});
