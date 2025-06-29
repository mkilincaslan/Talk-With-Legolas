import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "../../../backend/src/index";

export interface User {
  id: string;
  username: string;
  createdAt?: Date;
  online?: boolean;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  unread: boolean;
  sender?: User;
}

export interface Thread {
  id: string;
  participants: User[];
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
  lastMessage?: Message;
  otherUser?: User;
  unreadCount?: number;
}

export interface PendingMessage {
  id: string;
  content: string;
  createdAt: Date;
  isCreatingThread: boolean;
}

export interface WSMessage {
  type: "new_message" | "typing_status" | "online_status" | "connected" | "new_thread";
  threadId?: string;
  userId?: string;
  isTyping?: boolean;
  isOnline?: boolean;
  thread?: Thread;
  method?: string;
  message?: Message;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  updateTRPCClient?: (client: TRPCClient<AppRouter>) => void;
}

export interface ChatState {
  threads: Thread[];
  messages: { [threadId: string]: Message[] };
  onlineUsers: Set<string>;
  typingUsers: { [threadId: string]: Set<string> };
  searchQuery: string;
  activeThreadId: string | null;
}

export interface ChatContextType extends ChatState {
  addMessage: (message: Message) => void;
  updateThread: (thread: Thread) => void;
  setSearchQuery: (query: string) => void;
  setActiveThreadId: (threadId: string | null) => void;
  filteredThreads: Thread[];
}

export type ChatAction =
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'UPDATE_THREAD'; thread: Thread }
  | { type: 'SET_THREADS'; threads: Thread[] }
  | { type: 'SET_MESSAGES'; threadId: string; messages: Message[] }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_ACTIVE_THREAD'; threadId: string | null }
  | { type: 'UPDATE_ONLINE_STATUS'; userId: string; isOnline: boolean }
  | { type: 'UPDATE_TYPING_STATUS'; threadId: string; userId: string; isTyping: boolean };

export type MessageHandler = (message: WSMessage) => void;