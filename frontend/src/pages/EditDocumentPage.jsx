import { streamAIContent } from "../lib/aiStream";
import CustomPromptModal from "../components/edit-document/CustomPromptModal";
import AISettingsModal from "../components/edit-document/AISettingsModal";
import ConflictModal from "../components/edit-document/ConflictModal";
import SearchModal from "../components/SearchModal";
import Modal from "../components/ui/Modal";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useBlocker } from "react-router";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import {
  ArrowLeft,
  ChevronDown,
  Edit,
  FileCode,
  FileDown,
  FileText,
  NotebookText,
  Save,
  Search,
} from "lucide-react";
import {
  DocumentDetailsTab,
  Button,
  ContentEditorTab,
  Dropdown,
  DropdownItem,
} from "../components";

import useDocumentEditor from "../hooks/useDocumentEditor";

function LeaveConfirmModal({ isOpen, onStay, onLeave }) {
  return (
    <Modal isOpen={isOpen} onClose={onStay} title="Unsaved changes">
      <div className="space-y-5">
        <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
          You have unsaved changes. Leaving this page will discard them.
        </p>
        <div className="flex justify-end items-center gap-x-2 md:gap-x-3">
          <Button type="button" variant="secondary" onClick={onStay}>
            Stay
          </Button>
          <Button type="button" variant="destructive" onClick={onLeave}>
            Discard &amp; leave
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditDocumentPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [document, setDocument] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [activeTab, setActiveTab] = useState("editor");
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [conflictData, setConflictData] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    style: "Professional",
    tone: [],
    audience: "",
    format: "",
    length: "",
    extraInstructions: "",
  });

  const { documentId } = useParams();
  const navigate = useNavigate();

  const isDirty = saveStatus !== "saved";

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  const {
    chunks,
    initialContent,
    handleDocumentEdit,
    resetDocument,
    reloadChunks,
    setIsStreaming,
    flushSave,
    keepMyVersion,
    useServerVersion: acceptServerVersion,
  } = useDocumentEditor(
    documentId,
    () => setSaveStatus("saved"),
    (serverChunks) => {
      setSaveStatus("dirty");
      setConflictData(serverChunks);
    }
  );

  const handleEditorEdit = (from, to, insertText) => {
    setSaveStatus("dirty");
    handleDocumentEdit(from, to, insertText);
  };

  const fileInputRef = useRef(null);
  const isStreamingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const editorRef = useRef(null);
  const saveLockRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDocument = async () => {
      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.DOCUMENTS.GET_BY_ID}/${documentId}`,
          { signal: controller.signal }
        );

        setDocument(data.document);
      } catch (error) {
        if (error?.name === "CanceledError" || error?.code === "ERR_CANCELED") return;
        console.error("Error fetching document:", error);

        toast.error("Failed to load document!", {
          duration: 5000,
        });

        navigate("/dashboard");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchDocument();
    return () => controller.abort();
  }, [documentId, navigate]);

  const handleEditDocument = (event) => {
    const { name, value } = event.target;

    setDocument((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSaveStatus("dirty");
  };

  const handleSaveChanges = async (documentToSave = document, showToast = true) => {
    // Synchronous double-submit guard — setIsSaving is async, so two rapid clicks
    // both pass an `if (isSaving)` check before the first one updates state.
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    setIsSaving(true);
    setSaveStatus("saving");

    try {
      const payload = {
        title: documentToSave.title,
        subtitle: documentToSave.subtitle,
        coverImage: documentToSave.coverImage,
      };
      await axiosInstance.put(
        `${API_ENDPOINTS.DOCUMENTS.UPDATE_CONTENT}/${documentId}`,
        payload
      );
      setSaveStatus("saved");
      if (showToast) {
        toast.success("Changes saved successfully!");
      }
    } catch (error) {
      console.error("Error saving document:", error);
      setSaveStatus("error");
      toast.error("Failed to save changes! Please try again.", {
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
      saveLockRef.current = false;
    }
  };

  const saveHandlerRef = useRef(handleSaveChanges);
  saveHandlerRef.current = handleSaveChanges;

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (saveLockRef.current) return;
        saveHandlerRef.current(undefined, false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const handleCoverImgUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) {
      toast.error("Please select an image file first.");
      return;
    }

    const formData = new FormData();
    formData.append("coverImage", file);

    setIsUploading(true);

    try {
      const { data } = await axiosInstance.put(
        `${API_ENDPOINTS.DOCUMENTS.UPDATE_COVER}/${documentId}/cover`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setDocument(data.document);

      toast.success("Cover image updated successfully!");
    } catch (error) {
      console.error("Error uploading cover image:", error);

      toast.error("Failed to upload cover image! Please try again.", {
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCustomPromptSubmit = async () => {
    if (!customPrompt.trim()) return;

    await handleAIAction("custom");
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();

    isStreamingRef.current = false;
    setIsGenerating(false);
    setSaveStatus("dirty");

    toast.success("Generation stopped");
  };

  const handleAIAction = async (action) => {
  if (isGenerating) {
    return;
  }

  if (!document.title) {
    toast.error("Document title is required!");
    return;
  }

  if (action === "custom" && !customPrompt.trim()) {
    setIsCustomPromptOpen(true);
    return;
  }

  if (!editorRef.current?.isReady()) {
    toast.error("Editor not ready");
    return;
  }

  // "continue" and "custom" append to the end; everything else replaces the whole doc
  const isReplaceAction = action !== "continue" && action !== "custom";

  // Context sent to AI: last 3 chunks for append actions, full doc for replace actions
  const contextForAI = !isReplaceAction
    ? chunks.slice(-3).map((c) => c.content).join("")
    : editorRef.current.getText();

  // Snapshot full doc BEFORE any clearing so we can restore if AI fails
  const savedContent = isReplaceAction ? editorRef.current.getText() : null;

  setIsGenerating(true);
  isStreamingRef.current = true;
  setIsStreaming(true);
  setSaveStatus("dirty");

  const actionLabels = {
    generate: "Generating draft...",
    continue: "Continuing document...",
    rewrite: "Rewriting content...",
    expand: "Expanding content...",
    shorten: "Shortening content...",
    grammar: "Fixing grammar...",
    simplify: "Simplifying content...",
    custom: "Writing with custom prompt...",
  };

  const loadingToast = toast.loading(
    actionLabels[action] || "AI is working..."
  );

  try {
    abortControllerRef.current =
      new AbortController();

    // For append actions: cursor at actual end of CM6 doc (not context length)
    // For replace actions: cursor at 0 after clear
    let streamCursor = !isReplaceAction
      ? editorRef.current.getDocLength()
      : 0;

    if (isReplaceAction) {
      resetDocument("");
      setSaveStatus("dirty");

      await axiosInstance.delete(
        `${API_ENDPOINTS.DOCUMENTS.GET_BY_ID}/${documentId}/chunks`
      );

      editorRef.current.replaceRange(
        0,
        editorRef.current.getDocLength(),
        ""
      );
    }

    await streamAIContent(
      {
        action,
        documentId,
        documentTitle: document.title,
        documentDescription:
          document.subtitle || "",
        existingContent: contextForAI,
        customPrompt,
        aiConfig,
      },
      (chunkText) => {
        editorRef.current.insertTextAt(
          streamCursor,
          chunkText
        );

        streamCursor += chunkText.length;
      },
      abortControllerRef.current.signal
    );

    toast.dismiss(loadingToast);
    toast.success("AI action completed");
  } catch (error) {
    if (error.name === "AbortError") {
      toast.dismiss(loadingToast);
      return;
    }

    console.error("AI action failed:", error);

    // Restore original content if AI failed after clearing the editor
    if (savedContent !== null) {
      editorRef.current.replaceRange(
        0,
        editorRef.current.getDocLength(),
        savedContent
      );
    }

    toast.dismiss(loadingToast);

    toast.error(
      error.response?.data?.error ||
      error.message ||
      "AI action failed."
    );
  } finally {
    isStreamingRef.current = false;
    setIsStreaming(false);
    setIsGenerating(false);
    flushSave();
  }
};

  const pollExportStatus = async (jobId) => {
    const MAX_ATTEMPTS = 60; // 60 × 2s = 2 min max
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { data } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.STATUS}/${jobId}`
      );
      if (data.status === "completed") return data;
      if (data.status === "failed")
        throw new Error(data.error || "Export failed");
    }
    throw new Error("Export timed out");
  };

  const handleExport = async (format) => {
    const isDocx = format === "docx";
    const label = isDocx ? "document" : "PDF";
    const loadingToast = toast.loading(`Generating ${label}...`);
    setIsExporting(true);

    try {
      const {
        data: { jobId },
      } = await axiosInstance.post(
        `${API_ENDPOINTS.EXPORTS.REQUEST}/${documentId}/${format}`
      );

      const { filename } = await pollExportStatus(jobId);

      const { data: blob } = await axiosInstance.get(
        `${API_ENDPOINTS.EXPORTS.DOWNLOAD}/${jobId}`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(blob);
      const linkEl = window.document.createElement("a");
      linkEl.href = url;
      linkEl.setAttribute("download", filename);
      window.document.body.appendChild(linkEl);
      linkEl.click();
      linkEl.parentNode.removeChild(linkEl);
      window.URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success(`${isDocx ? "Document" : "PDF"} downloaded successfully!`);
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      toast.dismiss(loadingToast);
      toast.error(`Failed to export ${label}!`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => handleExport("pdf");
  const handleExportDocx = () => handleExport("docx");

  if (
    isLoading ||
    !document
  ) {
    return (
      <main className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="size-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-sm">Loading Editor...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-display flex">
      <main className="flex-1 h-full flex flex-col">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 sm:p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="size-5 text-slate-700 dark:text-slate-300" />
            </button>

            <input
              type="text"
              name="title"
              value={document.title || ""}
              onChange={handleEditDocument}
              onBlur={() => {
                if (isDirty && !saveLockRef.current) handleSaveChanges(document, false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              placeholder="Untitled Document"
              aria-label="Document title"
              className="flex-1 min-w-0 bg-transparent text-slate-900 dark:text-slate-50 text-base sm:text-lg font-semibold truncate px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search documents"
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              <Search className="size-4" />
            </button>

            <Dropdown
              disabled={isExporting}
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  icon={FileDown}
                  size="sm"
                  isLoading={isExporting}
                >
                  <span className="hidden sm:inline-flex items-center gap-1">
                    Export
                    <ChevronDown className="size-4" />
                  </span>

                  <span className="sm:hidden">
                    <ChevronDown className="size-4" />
                  </span>
                </Button>
              }
            >
              <DropdownItem onClick={handleExportPDF} disabled={isExporting}>
                <FileText className="text-slate-500 size-4" />
                Export as PDF
              </DropdownItem>

              <DropdownItem onClick={handleExportDocx} disabled={isExporting}>
                <FileCode className="text-slate-500 size-4" />
                Export as DOCX
              </DropdownItem>
            </Dropdown>

            <Button
              type="button"
              isLoading={isSaving}
              onClick={() => handleSaveChanges()}
              icon={Save}
              size="sm"
            >
              Save
            </Button>
          </div>
        </div>

          <nav className="flex items-center gap-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mt-3 w-fit">
            <button
              type="button"
              onClick={() => {
                if (isGenerating) return;
                setActiveTab("editor");
              }}
              className={`${activeTab === "editor"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-50 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                } text-sm font-medium rounded-md px-3 sm:px-4 py-2 flex justify-center items-center gap-2 transition-all duration-200`}
            >
              <Edit className="size-4" />
              <span>Editor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`${activeTab === "details"
                ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-50 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                } text-sm font-medium rounded-md px-3 sm:px-4 py-2 flex justify-center items-center gap-2 transition-all duration-200`}
            >
              <NotebookText className="size-4" />
              <span>Details</span>
            </button>
          </nav>
        </header>

        <section className="w-full flex-1 overflow-hidden">
          {activeTab === "editor" ? (
            <ContentEditorTab
              chunks={chunks}
              initialContent={initialContent}
              editorRef={editorRef}
              isGenerating={isGenerating}
              onAIAction={handleAIAction}
              onCancelGeneration={handleCancelGeneration}
              onOpenAISettings={() => setIsAISettingsOpen(true)}
              onDocumentEdit={handleEditorEdit}
              documentId={documentId}
              onImportComplete={() => {
                // Re-fetch chunks in place instead of hard-reloading the page.
                reloadChunks();
                setSaveStatus("saved");
              }}
            />
          ) : (
            <DocumentDetailsTab
              document={document}
              onEditDocument={handleEditDocument}
              fileInputRef={fileInputRef}
              isUploading={isUploading}
              onCoverImageUpload={handleCoverImgUpload}
            />
          )}
        </section>

        <AISettingsModal
          isOpen={isAISettingsOpen}
          onClose={() => setIsAISettingsOpen(false)}
          aiConfig={aiConfig}
          setAiConfig={setAiConfig}
        />
        <CustomPromptModal
          isOpen={isCustomPromptOpen}
          onClose={() => {
            setIsCustomPromptOpen(false);
            setCustomPrompt("");
          }}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
          onSubmit={async () => {
            setIsCustomPromptOpen(false);
            await handleCustomPromptSubmit();
            setCustomPrompt("");
          }}
        />
        <ConflictModal
          isOpen={conflictData !== null}
          conflictedOrders={conflictData?.map((c) => c.order)}
          onKeepMine={() => {
            keepMyVersion((conflictData ?? []).map((c) => c.order));
            setConflictData(null);
          }}
          onUseServer={() => {
            acceptServerVersion(conflictData ?? []);
            setConflictData(null);
          }}
        />
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(docId) => {
            if (docId) navigate(`/documents/${docId}/edit`);
            else setIsSearchOpen(true);
          }}
        />
      </main>
      <LeaveConfirmModal
        isOpen={blocker.state === "blocked"}
        onStay={() => blocker.reset?.()}
        onLeave={() => blocker.proceed?.()}
      />
      <div className="fixed bottom-6 right-6 z-50 pointer-events-none animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-black/30 rounded-full px-4 py-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <div
            className={`size-2 rounded-full transition-colors ${saveStatus === "saved"
              ? "bg-green-500"
              : saveStatus === "saving"
                ? "bg-amber-500 animate-pulse"
                : saveStatus === "dirty"
                  ? "bg-slate-400"
                  : "bg-red-500"
              }`}
          />

          <span>
            {
              {
                saved: "All changes saved",
                saving: "Saving...",
                dirty: "Unsaved changes",
                error: "Save failed",
              }[saveStatus]
            }
          </span>
        </div>
      </div>
    </div>
  );
}

export default EditDocumentPage;
