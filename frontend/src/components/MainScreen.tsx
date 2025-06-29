import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatList from './ChatList';
import ChatScreen from './ChatScreen';
import { useChat } from '../contexts/ChatContext';

const MainScreen: React.FC = () => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newThreadUsername, setNewThreadUsername] = useState<string | null>(null);
  const { setActiveThreadId } = useChat();

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
    setNewThreadUsername(null); // Clear new thread state
    setActiveThreadId(threadId);
  };

  const handleCreateThread = (username: string) => {
    setNewThreadUsername(username);
    setSelectedThreadId(null); // Clear existing thread state
    setActiveThreadId(null);
  };

  const handleBack = () => {
    setSelectedThreadId(null);
    setNewThreadUsername(null);
    setActiveThreadId(null);
  };

  const isInChatView = selectedThreadId || newThreadUsername;

  return (
    <div className="h-screen bg-dark-900 flex overflow-hidden">
      {/* Mobile Layout */}
      <div className="flex-1 md:hidden">
        <AnimatePresence mode="wait">
          {isInChatView ? (
            <motion.div
              key="chat"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="h-full"
            >
              <ChatScreen 
                threadId={selectedThreadId} 
                newThreadUsername={newThreadUsername}
                onBack={handleBack} 
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="h-full"
            >
              <ChatList 
                onThreadSelect={handleThreadSelect}
                onCreateThread={handleCreateThread}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex w-full h-full">
        {/* Chat List Panel - Fixed width, always visible */}
        <div className="w-80 flex-shrink-0 h-full border-r border-dark-700">
          <ChatList 
            onThreadSelect={handleThreadSelect}
            onCreateThread={handleCreateThread}
          />
        </div>

        {/* Chat Screen - Takes remaining space */}
        <div className="flex-1 relative">
          <AnimatePresence>
            {isInChatView ? (
              <motion.div
                key={selectedThreadId || newThreadUsername}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <ChatScreen 
                  threadId={selectedThreadId} 
                  newThreadUsername={newThreadUsername}
                  onBack={handleBack} 
                />
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex items-center justify-center bg-dark-900"
              >
                <div className="text-center">
                  <div className="w-24 h-24 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full"
                    />
                  </div>
                  <h3 className="text-2xl font-semibold text-white mb-2">
                    Welcome to Talk with Legolas
                  </h3>
                  <p className="text-dark-400 max-w-md">
                    Select a conversation from the sidebar to start chatting with your friends
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default MainScreen;