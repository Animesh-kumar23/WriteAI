import axios from "axios";
import { API_BASE_URL } from "../utils/api-endpoints";

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send HttpOnly cookie on every request
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 80000, // 80s
});

// Response interceptor - central error logging
axiosInstance.interceptors.response.use(
  (response) => response,
  (err) => {
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
