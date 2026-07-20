import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import DocumentModel from "../lib/documentModel";
import chunkLimits from "../../../config/chunkLimits.json";

export default function useDocumentEditor(
  documentId,
  onAllSaved = () => {},
  onConflict = () => {}
) {
  const [chunks, setChunks] = useState([]);
  const [initialContent, setInitialContent] = useState("");
  const [saveStatus, setSaveStatus] = useState("saved");

  const modelRef = useRef(new DocumentModel());
  const globalSaveTimerRef = useRef(null);
  const isStreamingRef = useRef(false);
  const saveEpochRef = useRef(0);
  const saveInFlightRef = useRef(null);

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
      setSaveStatus("saved");
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

  const performSave = async () => {
    const capturedEpoch = saveEpochRef.current;
    const dirty = modelRef.current.getDirtyChunks();
    const deleted = modelRef.current.getDeletedChunks();

    if (dirty.length === 0 && deleted.length === 0) {
      setSaveStatus("saved");
      onAllSaved();
      return true;
    }

    // Snapshot content now so we can detect concurrent edits after the
    // async save completes (normalizeAndSplit rebuilds this.chunks in-place,
    // so markChunkSaved on a post-edit chunk would clear dirty incorrectly).
    const snapshot = dirty.map(({ order, content, version }) => ({ order, content, version }));
    const deletionSnapshot = deleted.map(({ order, version }) => ({ order, version }));
    const operations = [
      ...snapshot.map((chunk) => ({ type: "update", ...chunk })),
      ...deletionSnapshot.map((chunk) => ({ type: "delete", ...chunk })),
    ];

    const BATCH_LIMIT = chunkLimits.clientBatchOperations;
    let activeUpdates = [];

    const applySaveResults = (data) => {
      const contentByOrder = new Map(
        activeUpdates.map(({ order, content }) => [order, content])
      );

      (data.savedChunks ?? []).forEach(({ order, version }) => {
        modelRef.current.updateChunkVersion(order, version);
        modelRef.current.markChunkSavedIfUnchanged(
          order,
          contentByOrder.get(order)
        );
      });

      (data.deletedOrders ?? []).forEach((order) => {
        modelRef.current.markChunkDeleted(order);
      });
    };

    try {
      setSaveStatus("saving");

      for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
        const batch = operations.slice(i, i + BATCH_LIMIT);
        activeUpdates = batch.filter(({ type }) => type === "update");
        const activeDeletions = batch.filter(({ type }) => type === "delete");

        // Build clientVersions map for chunks that have a known server version
        const clientVersions = {};
        activeUpdates.forEach(({ order, version }) => {
          if (version !== undefined) {
            clientVersions[order] = version;
          }
        });

        const hasVersions = Object.keys(clientVersions).length > 0;

        const { data } = await axiosInstance.patch(
          `${API_ENDPOINTS.DOCUMENTS.GET_BY_ID}/${documentId}/chunks/batch`,
          {
            chunks: activeUpdates.map(({ order, content }) => ({ order, content })),
            deletedChunks: activeDeletions.map(({ order, version }) => ({
              order,
              ...(version !== undefined && { version }),
            })),
            ...(hasVersions && { clientVersions }),
          }
        );

        if (capturedEpoch !== saveEpochRef.current) return false;

        applySaveResults(data);
      }

      const stillPending =
        modelRef.current.getDirtyChunks().length > 0 ||
        modelRef.current.getDeletedChunks().length > 0;
      setSaveStatus(stillPending ? "dirty" : "saved");

      if (!stillPending) {
        onAllSaved();
      }

      return true;
    } catch (error) {
      if (error?.response?.status === 409 && error.response.data?.conflict) {
        applySaveResults(error.response.data);
        setSaveStatus("dirty");
        onConflict(error.response.data.serverChunks ?? []);
        return false;
      }

      console.error(error);
      setSaveStatus("error");
      toast.error("Failed to save document");
      return false;
    }
  };

  const saveDirtyChunks = async () => {
    if (saveInFlightRef.current) {
      return saveInFlightRef.current;
    }

    const savePromise = performSave();
    saveInFlightRef.current = savePromise;

    try {
      return await savePromise;
    } finally {
      if (saveInFlightRef.current === savePromise) {
        saveInFlightRef.current = null;
      }
    }
  };

  const queueSave = () => {
    clearTimeout(globalSaveTimerRef.current);
    globalSaveTimerRef.current = setTimeout(saveDirtyChunks, 1200);
  };

  // Called immediately when streaming stops — bypasses the debounce delay
  const flushSave = async () => {
    clearTimeout(globalSaveTimerRef.current);
    globalSaveTimerRef.current = null;
    const saved = await saveDirtyChunks();
    if (!saved) return false;

    const stillPending =
      modelRef.current.getDirtyChunks().length > 0 ||
      modelRef.current.getDeletedChunks().length > 0;
    return stillPending ? saveDirtyChunks() : true;
  };

  const setIsStreaming = (val) => {
    isStreamingRef.current = val;
  };

  const handleDocumentEdit = (from, to, insertText) => {
    modelRef.current.replaceRange(from, to, insertText);
    setChunks(modelRef.current.getChunks());
    setSaveStatus("dirty");

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
    setSaveStatus("dirty");
  };

  useEffect(() => {
    return () => {
      clearTimeout(globalSaveTimerRef.current);
    };
  }, []);

  // After a conflict: user chose "keep mine" — strip version from conflicted orders
  // so the next save goes through without a version filter (force-overwrite).
  const keepMyVersion = async (conflictedOrders) => {
    conflictedOrders.forEach((order) => {
      modelRef.current.clearChunkVersion(order);
    });

    // onConflict fires from inside the current save. Let that request unwind
    // before starting the force-overwrite, otherwise the in-flight guard would
    // hand this call the just-failed promise instead of a new save.
    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }

    // Force-overwrite once, then reload the new server version so later saves
    // use normal conflict detection again.
    const saved = await saveDirtyChunks();
    if (saved) await loadAllChunks();
  };

  // After a conflict: user chose "use server version" — reload the complete document.
  const useServerVersion = () => loadAllChunks();

  const reloadChunks = useCallback(() => loadAllChunks(), [loadAllChunks]);

  return {
    chunks,
    initialContent,
    saveStatus,
    handleDocumentEdit,
    resetDocument,
    reloadChunks,
    setIsStreaming,
    flushSave,
    keepMyVersion,
    useServerVersion,
  };
}
