import { createTRPCReact } from '@trpc/react-query';
import { wsLink, splitLink, httpBatchLink } from '@trpc/client';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '../../../backend/src/index';
import { wsClient } from './ws-client';

// Environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

// Create a function to get tRPC client
export const getTRPCClient = () => {
  const client = wsClient.getClient();

  return trpc.createClient({
    links: [
      // Split based on operation type
      splitLink({
        condition: (op) => op.type === 'subscription',
        // When subscription, use WebSocket if available
        true: client
          ? wsLink({
              client,
            })
          : httpBatchLink({
              url: API_URL,
              headers: () => {
                const token = getAuthToken();
                return token ? { Authorization: `Bearer ${token}` } : {};
              },
            }),
        // When query/mutation, use HTTP
        false: httpBatchLink({
          url: API_URL,
          headers: () => {
            const token = getAuthToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      }),
    ],
  });
};