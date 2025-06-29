import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { trpc, queryClient, getTRPCClient } from './lib/trpc';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import LoginScreen from './components/LoginScreen';
import MainScreen from './components/MainScreen';
import type { TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../backend/src/index';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {isAuthenticated ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="h-full"
          >
            <ChatProvider>
              <MainScreen />
            </ChatProvider>
          </motion.div>
        ) : (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full"
          >
            <LoginScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function App() {
  const [trpcClient, setTrpcClient] = useState<TRPCClient<AppRouter>>(() => 
    getTRPCClient() // Start with HTTP-only client
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider updateTRPCClient={setTrpcClient}>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;