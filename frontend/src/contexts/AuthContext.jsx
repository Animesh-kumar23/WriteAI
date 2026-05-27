import { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

const AuthContext = createContext(null);

export function AuthContextProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Verify cookie on every mount by asking the server
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.AUTH.ME);
        setUser(data.user);
        setIsAuthenticated(true);
      } catch {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Called after login/register — user data comes from the response body
  const authenticateUser = (userInfo) => {
    setIsAuthenticated(true);
    setUser(userInfo);
  };

  // Called on logout — clears the HttpOnly cookie server-side
  const unauthenticateUser = async (callback) => {
    try {
      await axiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // ignore — clear local state regardless
    }
    setIsAuthenticated(false);
    setUser(null);
    callback?.();
  };

  const updateUser = (updatedUserInfo) => {
    setUser((prev) => ({ ...prev, ...updatedUserInfo }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        authenticateUser,
        unauthenticateUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used within an AuthContextProvider"
    );
  }

  return context;
}
