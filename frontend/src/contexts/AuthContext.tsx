import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { User, AuthState } from "../types";
import { getTRPCClient } from "../lib/trpc";
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "../../../backend/src/index";
import { wsClient } from "../lib/ws-client";

interface AuthContextType extends AuthState {
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  updateTRPCClient?: (client: TRPCClient<AppRouter>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
  updateTRPCClient?: (client: TRPCClient<AppRouter>) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  updateTRPCClient,
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Check for existing token on app start
    const token = localStorage.getItem("auth_token");
    const userData = localStorage.getItem("user_data");
    const tokenExpiration = localStorage.getItem("token_expiration");

    // Check if token is expired
    if (tokenExpiration) {
      const expirationTime = parseInt(tokenExpiration, 10);
      if (expirationTime < Date.now()) {
        logout();
      }
    }

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setAuthState({
          user,
          token,
          isAuthenticated: true,
        });
      } catch (error: unknown) {
        // Clear invalid data and logout
        logout();
        console.error("Error parsing user data:", error);
      }
    } else logout();
  }, []);

  // Handle WebSocket connection based on authentication state
  useEffect(() => {
    if (authState.isAuthenticated && authState.token) {
      // Initialize WebSocket connection
      wsClient.connect(authState.token);

      // Create new tRPC client
      const newTrpcClient = getTRPCClient();

      // Update the tRPC client in the provider
      if (updateTRPCClient) {
        updateTRPCClient(newTrpcClient);
      }

      return () => {
        wsClient.disconnect();
      };
    }
  }, [authState.isAuthenticated, authState.token, updateTRPCClient]);

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_data");
    localStorage.removeItem("token_expiration");

    wsClient.disconnect();

    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  };

  const login = (user: User, token: string) => {
    // Set token expiration for 1 hour
    const expirationTime = Date.now() + 60 * 60 * 1000;

    localStorage.setItem("auth_token", token);
    localStorage.setItem("user_data", JSON.stringify(user));
    localStorage.setItem("token_expiration", expirationTime.toString());

    setAuthState({
      user,
      token,
      isAuthenticated: true,
    });

    // Set up automatic logout after 1 hour
    setTimeout(() => {
      logout();
    }, 60 * 60 * 1000);
  };

  const setUser = (user: User | null) => {
    setAuthState((prev) => ({
      ...prev,
      user,
    }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        setUser,
        updateTRPCClient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
