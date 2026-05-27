import axios from "axios";
import { API_BASE_URL } from "../utils/api-endpoints";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send HttpOnly cookie on every request (desktop)
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 80000, // 80s
});

// Request interceptor — attach Bearer token for mobile browsers that block
// cross-site cookies (iOS Safari ITP, Android Chrome Privacy Sandbox).
// Desktop browsers that persist the HttpOnly cookie continue to use it;
// the backend auth middleware accepts either.
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — auto-store token returned by login/register, and
// clear it on 401 so stale tokens don't accumulate.
axiosInstance.interceptors.response.use(
  (response) => {
    if (response.data?.token) {
      localStorage.setItem("token", response.data.token);
    }
    return response;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
    }

    console.error("Axios error:", err);

    if (err.response?.status === 500) {
      console.error("Internal Server Error! Please try again in a few minutes.");
    } else if (err.code === "ECONNABORTED") {
      console.error("Request timeout! Please try again later.");
    }

    return Promise.reject(err);
  }
);

export default axiosInstance;
