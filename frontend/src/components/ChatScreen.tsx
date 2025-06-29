import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { trpc } from '../lib/trpc';
import type { Message, PendingMessage } from '../types';

interface ChatScreenProps {
  threadId?: string | null;
  newThreadUsername?: string | null;
  onBack: () => void;
}

const DateSeparator: React.FC<{ date: Date }> = ({ date }) => {
  const getDateLabel = (date: Date) => {
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMMM d, yyyy');
    }
  };

  return (
    <div className="flex items-center justify-center my-4">
      <div className="flex-grow h-px bg-dark-700"></div>
      <div className="mx-4 px-4 py-1 bg-dark-800 rounded-full">
        <span className="text-xs text-dark-400 font-medium">
          {getDateLabel(date)}
        </span>
      </div>
      <div className="flex-grow h-px bg-dark-700"></div>
    </div>
  );
};

const ChatScreen: React.FC<ChatScreenProps> = ({ threadId, newThreadUsername, onBack }) => {
  const [message, setMessage] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]); // Store messages that are waiting to be sent while a new thread is being created
  const [createdThreadId, setCreatedThreadId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null); // Reference to the bottom of messages list for auto-scrolling
  const messagesContainerRef = useRef<HTMLDivElement>(null); // Reference to the messages container for scrolling
  const typingTimeoutRef = useRef<NodeJS.Timeout>(); // Timeout for clearing typing indicator
  const lastScrollHeightRef = useRef<number>(0); // Store the last scroll height for loading more messages

  const { threads, messages, onlineUsers, typingUsers, addMessage, updateThread } = useChat();
  const { user } = useAuth();

  // Determine which thread to use
  const effectiveThreadId = threadId || createdThreadId;
  const thread = effectiveThreadId ? threads.find(t => t.id === effectiveThreadId) : null;
  const threadMessages = effectiveThreadId ? (messages[effectiveThreadId] || []) : [];
  
  // Get the other participant from the thread
  const otherParticipant = thread?.participants?.find(p => p.id !== user?.id);
  const isOtherUserOnline = otherParticipant && onlineUsers.has(otherParticipant.id);
  const isOtherUserTyping = effectiveThreadId && typingUsers[effectiveThreadId] && 
    typingUsers[effectiveThreadId].has(otherParticipant?.id || '');

  // Create thread mutation
  const createThreadMutation = trpc.thread.createThread.useMutation({
    onSuccess: (data) => {
      setCreatedThreadId(data.id);
      updateThread({
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      });
      
      // Send all pending messages
      pendingMessages.forEach((pendingMsg) => {
        sendMessageMutation.mutate({
          threadId: data.id,
          content: pendingMsg.content
        });
      });
      
      // Clear pending messages
      setPendingMessages([]);
    },
    onError: (error) => {
      console.error('Failed to create thread:', error);
      // Remove pending messages on error
      setPendingMessages([]);
    },
  });

  // Send message mutation
  const sendMessageMutation = trpc.message.send.useMutation({
    onSuccess: (data) => {
      addMessage({
        ...data,
        createdAt: new Date(data.createdAt)
      });
      scrollToBottom();
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    },
  });

  // Typing mutation
  const typingMutation = trpc.message.typing.useMutation();

  // Fetch messages for this thread
  const messagesQuery = trpc.message.getMessages.useQuery(
    { threadId: effectiveThreadId!, page },
    { 
      enabled: !!effectiveThreadId,
      keepPreviousData: true // Keep showing previous messages while loading new ones
    }
  );

  // Process new messages without causing infinite loops
  useEffect(() => {
    if (messagesQuery.data) {
      const newMessages = messagesQuery.data.filter(msg => {
        // Only add messages that don't exist in threadMessages
        return !threadMessages.some(existingMsg => existingMsg.id === msg.id);
      });

      // Only add new messages
      newMessages.forEach(msg => addMessage({
        id: msg.id,
        content: msg.content,
        senderId: msg.senderId,
        createdAt: new Date(msg.createdAt),
        threadId: msg.threadId,
        unread: msg.unread,
        sender: msg.sender
      }));

      // If these are the first messages loaded, scroll to bottom
      if (newMessages.length > 0 && page === 1) {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      }

      // If loading more messages, maintain scroll position
      if (isLoadingMore && messagesContainerRef.current) {
        requestAnimationFrame(() => {
          const newScrollHeight = messagesContainerRef.current!.scrollHeight;
          const scrollDiff = newScrollHeight - lastScrollHeightRef.current;
          messagesContainerRef.current!.scrollTop = scrollDiff;
          setIsLoadingMore(false);
        });
      }
    }
  }, [messagesQuery.data]);

  // Reset page when changing threads
  useEffect(() => {
    setPage(1);
    setIsLoadingMore(false);
  }, [effectiveThreadId]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 100;
      setShowScrollToBottom(!isAtBottom);

      // Check if we've scrolled to the top and not already loading
      if (scrollTop === 0 && !isLoadingMore && !messagesQuery.isLoading && messagesQuery.data?.length === 20) {
        // Save the current scroll height before loading more
        lastScrollHeightRef.current = scrollHeight;
        setIsLoadingMore(true);
        setPage(prev => prev + 1);
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const messageContent = message.trim();
    setMessage('');

    // Stop typing
    if (isTyping) {
      setIsTyping(false);
      if (effectiveThreadId) {
        typingMutation.mutate({ threadId: effectiveThreadId, isTyping: false });
      }
    }

    if (effectiveThreadId) {
      // Send message directly
      sendMessageMutation.mutate({
        threadId: effectiveThreadId,
        content: messageContent
      });
    } else if (newThreadUsername) {
      // Need to create thread first
      const pendingMessage: PendingMessage = {
        id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: messageContent,
        createdAt: new Date(),
        isCreatingThread: true,
      };

      setPendingMessages(prev => [...prev, pendingMessage]);

      // Create thread if not already creating
      if (!createThreadMutation.isLoading) {
        createThreadMutation.mutate({
          userName: newThreadUsername,
        });
      }
    }

    scrollToBottom();
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    // Handle typing indicator
    if (effectiveThreadId) {
      if (!isTyping && e.target.value.trim()) {
        setIsTyping(true);
        typingMutation.mutate({ threadId: effectiveThreadId, isTyping: true });
      }
      
      // Clear typing timeout and set new one
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          setIsTyping(false);
          typingMutation.mutate({ threadId: effectiveThreadId, isTyping: false });
        }
      }, 2000);
    }
  };

  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Yesterday ' + format(date, 'HH:mm');
    } else {
      return format(date, 'MMM dd, HH:mm');
    }
  };

  const renderMessage = (msg: Message, index: number, messages: Message[]) => {
    const showAvatar = index === 0 || messages[index - 1]?.senderId !== msg.senderId;
    const isOwn = msg.senderId === user?.id;
    
    // Show timestamp if:
    // 1. It's the last message
    // 2. Next message is from different sender
    // 3. There's more than 1 minute gap to next message
    const showTime = index === messages.length - 1 || 
      messages[index + 1]?.senderId !== msg.senderId ||
      (index < messages.length - 1 && messages[index + 1].createdAt.getTime() - msg.createdAt.getTime() > 60 * 1000); // 1 minute gap

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-2`}
      >
        {/* Avatar */}
        <div className={`flex-shrink-0 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">
              {isOwn 
                ? user?.username?.charAt(0).toUpperCase() 
                : (otherParticipant?.username?.charAt(0).toUpperCase() || newThreadUsername?.charAt(0).toUpperCase() || '?')
              }
            </span>
          </div>
        </div>

        {/* Message Bubble */}
        <div className={`flex flex-col max-w-xs lg:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bg-primary-600 text-white rounded-br-md'
                : 'bg-dark-700 text-white rounded-bl-md'
            } shadow-lg`}
          >
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </div>
          {showTime && (
            <span className="text-xs text-dark-500 mt-1 px-2">
              {formatMessageTime(msg.createdAt)}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  const renderPendingMessage = (pendingMsg: PendingMessage) => {
    return (
      <motion.div
        key={pendingMsg.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex gap-3 flex-row-reverse mb-4"
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">
              {user?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Message Bubble with Loading State */}
        <div className="flex flex-col max-w-xs lg:max-w-md items-end">
          <div className="px-4 py-2 rounded-2xl bg-primary-600/70 text-white rounded-br-md shadow-lg relative">
            <p className="text-sm leading-relaxed pr-6">{pendingMsg.content}</p>
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <Loader2 className="w-3 h-3 animate-spin text-white/70" />
            </div>
          </div>
          <span className="text-xs text-dark-500 mt-1 px-2 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {pendingMsg.isCreatingThread ? 'Creating conversation...' : 'Sending...'}
          </span>
        </div>
      </motion.div>
    );
  };

  const renderMessages = () => {
    if (!threadMessages.length) return null;

    const sortedMessages = threadMessages
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return sortedMessages.map((msg, index, messages) => {
      const showDateSeparator = index === 0 || 
        !isSameDay(msg.createdAt, messages[index - 1].createdAt);

      return (
        <React.Fragment key={msg.id}>
          {showDateSeparator && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DateSeparator date={msg.createdAt} />
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderMessage(msg, index, messages)}
          </motion.div>
        </React.Fragment>
      );
    });
  };

  // Get display username and avatar for header
  const displayUsername = otherParticipant?.username || newThreadUsername;

  return (
    <div className="flex-1 flex flex-col bg-dark-900 h-full">
      {/* Header */}
      <div className="bg-dark-800 border-b border-dark-700 p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors duration-200 md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">
              {displayUsername?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          {isOtherUserOnline && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-dark-800 rounded-full"></div>
          )}
        </div>

        <div className="flex-1">
          <h3 className="text-white font-semibold">
            {displayUsername}
          </h3>
          <p className="text-sm text-dark-400">
            {!effectiveThreadId ? (
              <span className="text-yellow-400">New conversation</span>
            ) : isOtherUserTyping ? (
              <span className="text-green-400">typing...</span>
            ) : isOtherUserOnline ? (
              'Online'
            ) : (
              'Offline'
            )}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Loading More Messages Indicator */}
        <AnimatePresence>
          {isLoadingMore && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-center py-2"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-dark-800 rounded-full">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-dark-400">Loading older messages...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Initial Loading */}
        {messagesQuery.isLoading && !isLoadingMore && (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Messages */}
        {!messagesQuery.isLoading && (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {renderMessages()}
              {pendingMessages.map(renderPendingMessage)}
            </AnimatePresence>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      <AnimatePresence>
        {showScrollToBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg transition-colors duration-200"
          >
            <ArrowDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Message Input */}
      <div className="bg-dark-800 border-t border-dark-700 p-4">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={handleMessageChange}
            placeholder={
              !effectiveThreadId && newThreadUsername 
                ? `Message ${newThreadUsername}...` 
                : "Type a message..."
            }
            disabled={createThreadMutation.isLoading}
            className="flex-1 px-4 py-2 bg-dark-700 border border-dark-600 rounded-full text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!message.trim() || createThreadMutation.isLoading}
            className={`p-2 rounded-full transition-all duration-200 ${
              message.trim() && !createThreadMutation.isLoading
                ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg'
                : 'bg-dark-600 text-dark-400 cursor-not-allowed'
            }`}
          >
            {createThreadMutation.isLoading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatScreen;