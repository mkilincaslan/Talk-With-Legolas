import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LogOut, User, Plus } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { trpc } from '../lib/trpc';
import { Thread } from '../types';

interface ChatListProps {
  onThreadSelect: (threadId: string) => void;
  onCreateThread: (username: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ onThreadSelect, onCreateThread }) => {
  const { 
    filteredThreads, 
    searchQuery, 
    setSearchQuery, 
    onlineUsers, 
    typingUsers 
  } = useChat();
  const { logout, user } = useAuth();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM dd');
    }
  };

  const getLastMessageDisplay = (thread: Thread) => {
    const otherParticipant = thread.participants?.find(p => p.id !== user?.id);
    const isTyping = typingUsers[thread.id] && 
      typingUsers[thread.id].has(otherParticipant?.id || '');
    
    if (isTyping && otherParticipant) {
      return (
        <span className="text-green-400 text-sm italic">
          {otherParticipant.username} is typing...
        </span>
      );
    }

    if (thread.lastMessage) {
      const senderName = thread.lastMessage.senderId === user?.id 
        ? 'You' 
        : thread.lastMessage.sender?.username || 'Unknown';
      
      return (
        <span className="text-dark-400 text-sm truncate">
          {senderName}: {thread.lastMessage.content}
        </span>
      );
    }

    return <span className="text-dark-500 text-sm">No messages yet</span>;
  };

  // Check if search query matches an existing thread
  const hasExistingThread = searchQuery.length >= 2 && 
    filteredThreads.some(thread => 
      thread.participants?.some(p => 
        p.id !== user?.id && p.username.toLowerCase() === searchQuery.toLowerCase()
      )
    );

  // Show create button if search query is valid and no existing thread
  const showCreateButton = searchQuery.length >= 2 && 
    !hasExistingThread && 
    searchQuery.toLowerCase() !== user?.username?.toLowerCase();

  const handleCreateThread = () => {
    if (showCreateButton) {
      onCreateThread(searchQuery.trim());
      setSearchQuery(''); // Clear search after creating
    }
  };

  return (
    <div className="w-full h-full bg-dark-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600/20 rounded-full">
              <User className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">{user?.username}</h2>
              <p className="text-dark-400 text-sm">Online</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isLoading}
            className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors duration-200 disabled:opacity-50"
            title="Logout"
          >
            {logoutMutation.isLoading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogOut className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Search Input with Create Button */}
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              placeholder="Search conversations or enter username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-700/50 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            />
          </div>
          
          {/* Create Thread Button */}
          <AnimatePresence>
            {showCreateButton && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                transition={{ duration: 0.2 }}
                onClick={handleCreateThread}
                className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-1 text-sm font-medium transition-colors duration-200 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Create
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {filteredThreads.map((thread, index) => {
            const otherParticipant = thread.participants?.find(p => p.id !== user?.id);
            const isOnline = otherParticipant && onlineUsers.has(otherParticipant.id);
            
            // Check for unread messages from other users
            const hasUnread = thread.lastMessage?.unread && thread.lastMessage.senderId !== user?.id;

            return (
              <motion.div
                key={thread.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="border-b border-dark-700 last:border-b-0"
              >
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(55, 65, 81, 0.5)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onThreadSelect(thread.id)}
                  className="w-full p-4 text-left hover:bg-dark-700/50 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {otherParticipant?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      {isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-dark-800 rounded-full"></div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white font-medium truncate">
                          {otherParticipant?.username || 'Unknown User'}
                        </h3>
                        <div className="flex items-center gap-2">
                          {hasUnread && (
                            <div className="w-2 h-2 bg-primary-500 rounded-full" />
                          )}
                          {thread.lastMessage && (
                            <span className="text-dark-500 text-xs">
                              {formatMessageTime(thread.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className={`${hasUnread ? 'text-white font-medium' : 'text-dark-400'}`}>
                        {getLastMessageDisplay(thread)}
                      </div>
                    </div>
                  </div>
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredThreads.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-dark-700 rounded-full flex items-center justify-center mx-auto mb-4">
              {showCreateButton ? (
                <Plus className="w-8 h-8 text-primary-400" />
              ) : (
                <Search className="w-8 h-8 text-dark-500" />
              )}
            </div>
            <p className="text-dark-400 mb-2">
              {searchQuery.length >= 2 
                ? showCreateButton 
                  ? `Start a conversation with "${searchQuery}"`
                  : 'No conversations found'
                : 'No conversations yet'
              }
            </p>
            {showCreateButton && (
              <p className="text-dark-500 text-sm">
                Click "Create" to start a new conversation
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatList;