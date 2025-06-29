import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from './AuthContext';
import { wsClient } from '../lib/ws-client';
import type { 
  WSMessage, 
  Message, 
  Thread, 
  ChatState, 
  ChatContextType, 
  ChatAction 
} from '../types';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'ADD_MESSAGE': {
      const threadMessages = state.messages[action.message.threadId] || [];
      // Check if message already exists
      if (threadMessages.some(msg => msg.id === action.message.id)) {
        return state;
      }
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.message.threadId]: [...threadMessages, action.message],
        },
      };
    }

    case 'UPDATE_THREAD': {
      // Check if thread already exists
      const threadExists = state.threads.some(t => t.id === action.thread.id);
      
      if (threadExists) {
        return {
          ...state,
          threads: state.threads.map(thread =>
            thread.id === action.thread.id ? action.thread : thread
          ),
        };
      } else {
        // Add new thread to the beginning of the list
        return {
          ...state,
          threads: [action.thread, ...state.threads],
        };
      }
    }

    case 'SET_THREADS':
      return {
        ...state,
        threads: action.threads,
      };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.threadId]: action.messages,
        },
      };

    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.query,
      };

    case 'SET_ACTIVE_THREAD':
      return {
        ...state,
        activeThreadId: action.threadId,
      };

    case 'UPDATE_ONLINE_STATUS': {
      const newOnlineUsers = new Set(state.onlineUsers);
      if (action.isOnline) {
        newOnlineUsers.add(action.userId);
      } else {
        newOnlineUsers.delete(action.userId);
      }
      return {
        ...state,
        onlineUsers: newOnlineUsers,
      };
    }

    case 'UPDATE_TYPING_STATUS': {
      const threadTypingUsers = state.typingUsers[action.threadId] || new Set();
      const newTypingUsers = new Set(threadTypingUsers);
      
      if (action.isTyping) {
        newTypingUsers.add(action.userId);
      } else {
        newTypingUsers.delete(action.userId);
      }

      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.threadId]: newTypingUsers,
        },
      };
    }

    default:
      return state;
  }
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [chatState, dispatch] = useReducer(chatReducer, {
    threads: [],
    messages: {},
    onlineUsers: new Set<string>(),
    typingUsers: {},
    searchQuery: '',
    activeThreadId: null,
  });

  // Fetch threads
  const { data: threads } = trpc.thread.getThreads.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });

  const markMessagesAsRead = trpc.message.markAsRead.useMutation();

  // Initialize online users from thread participants
  useEffect(() => {
    if (threads) {
      // Create a new Set for online users
      const onlineUsers = new Set<string>();

      // Go through all threads and their participants
      threads.forEach(thread => {
        thread.participants.forEach(participant => {
          if (participant.online) {
            onlineUsers.add(participant.id);
          }
        });
      });

      // Update each online user in the state
      onlineUsers.forEach(userId => {
        dispatch({
          type: 'UPDATE_ONLINE_STATUS',
          userId,
          isOnline: true,
        });
      });

      // Update threads in state
      dispatch({
        type: 'SET_THREADS',
        threads: threads.map(thread => ({
          ...thread,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
          lastMessage: thread.lastMessage
            ? {
                ...thread.lastMessage,
                createdAt: new Date(thread.lastMessage.createdAt),
              }
            : undefined,
        })),
      });
    }
  }, [threads]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const handleMessage = (data: WSMessage) => {

      switch (data.type) {
        case 'new_message':
          if (data.message) {
            const message = {
              ...data.message,
              createdAt: new Date(data.message.createdAt),
              unread: data.message.senderId !== user.id && data.message.threadId !== chatState.activeThreadId,
            };

            // Update thread's lastMessage and add the message
            const updatedThread = chatState.threads.find(t => t.id === message.threadId);
            if (updatedThread) {
              dispatch({
                type: 'UPDATE_THREAD',
                thread: {
                  ...updatedThread,
                  lastMessage: message,
                  updatedAt: message.createdAt,
                },
              });
            }

            dispatch({
              type: 'ADD_MESSAGE',
              message,
            });
          }
          break;

        case 'new_thread':
          if (data.thread) {
            // Add new thread to the list
            dispatch({
              type: 'UPDATE_THREAD',
              thread: {
                ...data.thread,
                createdAt: new Date(data.thread.createdAt),
                updatedAt: new Date(data.thread.updatedAt),
                lastMessage: data.thread.lastMessage ? {
                  ...data.thread.lastMessage,
                  createdAt: new Date(data.thread.lastMessage.createdAt),
                } : undefined,
              },
            });

            // Update online status for thread participants
            data.thread.participants.forEach(participant => {
              if (participant.online) {
                dispatch({
                  type: 'UPDATE_ONLINE_STATUS',
                  userId: participant.id,
                  isOnline: true,
                });
              }
            });
          }
          break;

        case 'typing_status':
          if (data.threadId && data.userId !== undefined) {
            dispatch({
              type: 'UPDATE_TYPING_STATUS',
              threadId: data.threadId,
              userId: data.userId,
              isTyping: data.isTyping || false,
            });
          }
          break;

        case 'online_status':
          if (data.userId !== undefined) {
            dispatch({
              type: 'UPDATE_ONLINE_STATUS',
              userId: data.userId,
              isOnline: data.isOnline || false,
            });
          }
          break;
      }
    };

    wsClient.addMessageHandler(handleMessage);

    return () => {
      wsClient.removeMessageHandler(handleMessage);
    };
  }, [isAuthenticated, user, chatState.activeThreadId, chatState.threads]);

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', message });
  }, []);

  const updateThread = useCallback((thread: Thread) => {
    dispatch({ type: 'UPDATE_THREAD', thread });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
  }, []);

  const setActiveThreadId = useCallback((threadId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_THREAD', threadId });

    // If thread is selected and has unread messages from other users, mark them as read
    if (threadId && user) {
      const thread = chatState.threads.find(t => t.id === threadId);
      if (thread?.lastMessage?.unread && thread.lastMessage.senderId !== user.id) {
        markMessagesAsRead.mutate({ threadId });

        // Update thread's lastMessage unread status
        dispatch({
          type: 'UPDATE_THREAD',
          thread: {
            ...thread,
            lastMessage: {
              ...thread.lastMessage,
              unread: false,
            },
          },
        });
      }
    }
  }, [user, chatState.threads]);

  const filteredThreads = chatState.threads
    .filter(thread => {
      if (!chatState.searchQuery) return true;
      return thread.participants.some(
        p => p.id !== user?.id && p.username.toLowerCase().includes(chatState.searchQuery.toLowerCase())
      );
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <ChatContext.Provider
      value={{
        ...chatState,
        addMessage,
        updateThread,
        setSearchQuery,
        setActiveThreadId,
        filteredThreads,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};