import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import DocumentModel from "../lib/documentModel";

export default function useDocumentEditor(
  documentId,
  onAllSaved = () => {},
  onConflict = () => {}
) {
  const [chunks, setChunks] = useState([]);
  const [initialContent, setInitialContent] = useState("");

  const modelRef = useRef(new DocumentModel());
  const globalSaveTimerRef = useRef(null);
  const isStreamingRef = useRef(false);
  const saveEpochRef = useRef(0);

  const loadAllChunks = useCallback(async (signal) => {
    try {
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.DOCUMENTS.GET_BY_ID}/${documentId}/chunks`,
        { params: { all: true }, signal }
      );

      const fetchedChunks = data.chunks || [];

      modelRef.current = new DocumentModel(fetchedChunks);

      setChunks(modelRef.current.getChunks());
      setInitialContent(modelRef.current.getFullText());
    } catch (error) {
      if (axiosInstance.isCancel?.(error) || error?.name === "CanceledError" || error?.code === "ERR_CANCELED") {
        return;
      }
      console.error(error);
      toast.error("Failed to load document");
    }
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;

    clearTimeout(globalSaveTimerRef.current);
    globalSaveTimerRef.current = null;

    const controller = new AbortController();
    loadAllChunks(controller.signal);

    return () => {
      controller.abort();
    };
  }, [documentId, loadAllChunks]);

  const saveDirtyChunks = async () => {
    const capturedEpoch = saveEpochRef.current;
    const dirty = modelRef.current.getDirtyChunks();

    if (dirty.length === 0) return;

    // Snapshot content now so we can detect concurrent edits after the
    // async save completes (normalizeAndSplit rebuilds this.chunks in-place,
    // so markChunkSaved on a post-edit chunk would clear dirty incorrectly).
    const snapshot = dirty.map(({ order, content, version }) => ({ order, content, version }));

    const BATCH_LIMIT = 450;

    try {
      for (let i = 0; i < snapshot.length; i += BATCH_LIMIT) {
        const batch = snapshot.slice(i, i + BATCH_LIMIT);

        // Build clientVersions map for chunks that have a known server version
        const clientVersions = {};
        batch.forEach(({ order, version }) => {
          if (version !== undefined) {
            clientVersions[order] = version;
          }
        });

        const hasVersions = Object.keys(clientVersions).length > 0;

        const { data } = await axiosInstance.patch(
          `${API_ENDPOINTS.DOCUMENTS.GET_BY_ID}/${documentId}/chunks/batch`,
          {
            chunks: batch.map(({ order, content }) => ({ order, content })),
            ...(hasVersions && { clientVersions }),
          }
        );

        if (capturedEpoch !== saveEpochRef.current) return;

        // Update tracked versions for successfully saved chunks
        batch.forEach(({ order, version }) => {
          if (version !== undefined) {
            modelRef.current.updateChunkVersion(order, version + 1);
          }
        });

        void data;
      }

      // Only clear dirty if the chunk content hasn't changed since we started saving.
      // If the user edited the same chunk during the in-flight request the dirty
      // flag must stay set so the next debounced save picks it up.
      snapshot.forEach(({ order, content }) => {
        modelRef.current.markChunkSavedIfUnchanged(order, content);
      });

      if (modelRef.current.getDirtyChunks().length === 0) {
        onAllSaved();
      }
    } catch (error) {
      if (error?.response?.status === 409 && error.response.data?.conflict) {
        onConflict(error.response.data.serverChunks ?? []);
        return;
      }

      console.error(error);
      toast.error("Failed to save document");
    }
  };

  const queueSave = () => {
    clearTimeout(globalSaveTimerRef.current);
    globalSaveTimerRef.current = setTimeout(saveDirtyChunks, 1200);
  };

  // Called immediately when streaming stops — bypasses the debounce delay
  const flushSave = () => {
    clearTimeout(globalSaveTimerRef.current);
    globalSaveTimerRef.current = null;
    saveDirtyChunks();
  };

  const setIsStreaming = (val) => {
    isStreamingRef.current = val;
  };

  const handleDocumentEdit = (from, to, insertText) => {
    modelRef.current.replaceRange(from, to, insertText);
    setChunks(modelRef.current.getChunks());

    if (!isStreamingRef.current) {
      queueSave();
    }
  };

  const resetDocument = (newText = "") => {
    clearTimeout(globalSaveTimerRef.current);
    globalSaveTimerRef.current = null;
    saveEpochRef.current++;

    modelRef.current = new DocumentModel([{ order: 0, content: newText }]);
    setChunks(modelRef.current.getChunks());
  };

  useEffect(() => {
    return () => {
      clearTimeout(globalSaveTimerRef.current);
    };
  }, []);

  // After a conflict: user chose "keep mine" — strip version from conflicted orders
  // so the next save goes through without a version filter (force-overwrite).
  const keepMyVersion = (conflictedOrders) => {
    conflictedOrders.forEach((order) => {
      modelRef.current.clearChunkVersion(order);
    });
    saveDirtyChunks();
  };

  // After a conflict: user chose "use server version" — reset doc to server content.
  const useServerVersion = (serverChunks) => {
    const joined = serverChunks
      .sort((a, b) => a.order - b.order)
      .map((c) => c.content)
      .join("");
    resetDocument(joined);
  };

  const reloadChunks = useCallback(() => loadAllChunks(), [loadAllChunks]);

  return {
    chunks,
    initialContent,
    handleDocumentEdit,
    resetDocument,
    reloadChunks,
    setIsStreaming,
    flushSave,
    keepMyVersion,
    useServerVersion,
  };
}
