import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

const AuthContext = createContext(null);

export function AuthContextProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Verify cookie on every mount by asking the server
  useEffect(() => {
    const controller = new AbortController();
    const checkAuthStatus = async () => {
      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.AUTH.ME, {
          signal: controller.signal,
        });
        setUser(data.user);
        setIsAuthenticated(true);
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    checkAuthStatus();
    return () => controller.abort();
  }, []);

  // Called after login/register — user data comes from the response body
  const authenticateUser = useCallback((userInfo) => {
    setIsAuthenticated(true);
    setUser(userInfo);
  }, []);

  // Called on logout — clears the HttpOnly cookie server-side and localStorage token
  const unauthenticateUser = useCallback(async (callback) => {
    try {
      await axiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // ignore — clear local state regardless
    }
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setUser(null);
    callback?.();
  }, []);

  const updateUser = useCallback((updatedUserInfo) => {
    setUser((prev) => ({ ...prev, ...updatedUserInfo }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      authenticateUser,
      unauthenticateUser,
      updateUser,
    }),
    [user, isLoading, isAuthenticated, authenticateUser, unauthenticateUser, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
