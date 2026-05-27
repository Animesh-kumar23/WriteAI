import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";

export default function useDocumentChunks(documentId, chunkLimit = 4) {
  const [chunks, setChunks] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const sentinelRef = useRef(null);
  const isFetchingMoreRef = useRef(false);

  const loadChunks = async (start = 0) => {
    if (isFetchingMoreRef.current) {
      return;
    }

    if (!hasMore && start !== 0) {
      return;
    }

    isFetchingMoreRef.current = true;

    try {
      setLoadingMore(true);

      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.DOCUMENTS.GET_BY_ID}/${documentId}/chunks`,
        {
          params: {
            start,
            limit: chunkLimit,
          },
        }
      );

      const fetchedChunks = data.chunks || [];

      if (start === 0) {
        setChunks(fetchedChunks);
      } else {
        setChunks((prev) => [
          ...prev,
          ...fetchedChunks,
        ]);
      }

      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Error loading chunks:", error);
      toast.error("Failed to load chunks!");
    } finally {
      setLoadingMore(false);
      isFetchingMoreRef.current = false;
    }
  };

  useEffect(() => {
    if (!documentId) {
      return;
    }

    setChunks([]);
    setHasMore(true);

    loadChunks(0);
  }, [documentId]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (
          entry.isIntersecting &&
          !isFetchingMoreRef.current &&
          hasMore
        ) {
          loadChunks(chunks.length);
        }
      },
      {
        rootMargin: "500px",
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, chunks.length, documentId]);

  return {
    chunks,
    setChunks,
    loadingMore,
    sentinelRef,
  };
}