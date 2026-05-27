import { useRef, useState } from "react";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

export default function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);

  const search = (q) => {
    setQuery(q);
    clearTimeout(debounceRef.current);

    if (!q || q.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.DOCUMENTS.SEARCH, {
          params: { q },
        });
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const clearSearch = () => {
    clearTimeout(debounceRef.current);
    setQuery("");
    setResults([]);
    setIsSearching(false);
  };

  return { query, results, isSearching, search, clearSearch };
}
