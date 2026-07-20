import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import { FileText, Lightbulb, Loader2, Sparkles, X } from "lucide-react";

function CreateDocumentModal({
  isOpen,
  onClose,
  onDocumentCreate,
  initialMode = "blank",
}) {
  const [documentTitle, setDocumentTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState(initialMode);
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const resetModal = () => {
    setDocumentTitle("");
    setTopic("");
    setIsCreating(false);
    setMode(initialMode);
    setIsGenerating(false);
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleCreateBlank = async () => {
  if (!documentTitle.trim()) {
    toast.error("Document title is required.");
    return;
  }

  setIsCreating(true);

  try {
    const {
      data: { document },
    } = await axiosInstance.post(
      API_ENDPOINTS.DOCUMENTS.CREATE,
      {
        title: documentTitle,
        subtitle: topic,
        content: "",
      }
    );

    toast.success("Document created successfully!");
    onDocumentCreate(document._id);
    handleClose();
  } catch (error) {
    console.error("Error creating document:", error);

    toast.error(
      error.response?.data?.message ||
      "Failed to create document."
    );
  } finally {
    setIsCreating(false);
  }
};


  const handleGenerateWithAI = async () => {
  if (!documentTitle.trim()) {
    toast.error("Document title is required.");
    return;
  }

  if (!topic.trim()) {
    toast.error("Tell AI what to create.");
    return;
  }

  setIsGenerating(true);

  const loadingToast = toast.loading(
    "Creating document with AI..."
  );

  try {
    const {
      data: { content },
    } = await axiosInstance.post(
      API_ENDPOINTS.AI.GENERATE_CONTENT,
      {
        action: "generate",
        documentTitle,
        documentDescription: topic,
        existingContent: "",
        customPrompt: "",
      }
    );

    const {
      data: { document },
    } = await axiosInstance.post(
      API_ENDPOINTS.DOCUMENTS.CREATE,
      {
        title: documentTitle,
        subtitle: topic,
        content,
      }
    );

    toast.dismiss(loadingToast);
    toast.success("Document created!");

    onDocumentCreate(document._id);
    handleClose();
  } catch (error) {
    console.error(error);

    toast.dismiss(loadingToast);

    toast.error(
      error.response?.data?.error ||
      "Failed to generate document."
    );
  } finally {
    setIsGenerating(false);
  }
};

  if (!isOpen) return null;

  const isBusy = isGenerating || isCreating;

  return (
    <div className="overflow-y-auto fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="min-h-screen px-4 py-8 flex justify-center items-center">
        <div
          onClick={handleClose}
          className="bg-black/50 backdrop-blur-sm fixed inset-0 animate-in fade-in duration-200"
          aria-hidden="true"
        />

        {/* Modal container */}
        <article
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-document-modal-title"
          className="max-w-md w-full bg-white dark:bg-slate-800 text-left rounded-xl p-5 md:p-6 shadow-xl dark:shadow-black/40 relative animate-in duration-200"
        >
          {/* Header */}
          <header className="mb-4 md:mb-5 flex justify-between items-start gap-x-4">
            <h3
              id="create-document-modal-title"
              className="text-gray-900 dark:text-slate-50 text-base md:text-lg font-semibold pr-8"
            >
              {mode === "ai" ? "Create Document with AI" : "Create New Document"}
            </h3>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close modal"
              className="text-gray-400 dark:text-slate-500 rounded-lg p-1.5 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-slate-300 focus-visible:bg-gray-100 dark:focus-visible:bg-slate-700 focus-visible:text-gray-600 dark:focus-visible:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 absolute top-4 md:top-5 right-4 md:right-5"
            >
              <X className="size-4 md:size-5" />
            </button>
          </header>

          {/* Content area */}
          <div className="text-sm md:text-base">
            <div className="space-y-5">
              <div className="w-full grid grid-cols-1 gap-y-2">
                <label
                  htmlFor="create-document-title"
                  className="text-gray-700 dark:text-slate-300 text-sm font-medium"
                >
                  <span>Document Title</span>
                  <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <div className="pl-3 flex justify-center items-center pointer-events-none absolute inset-y-0 left-0">
                    <FileText className="size-4 text-gray-400 dark:text-slate-500" />
                  </div>

                  <input
                    type="text"
                    id="create-document-title"
                    value={documentTitle}
                    onChange={(event) => setDocumentTitle(event.target.value)}
                    required
                    placeholder="My new writing project"
                    disabled={isBusy}
                    className="w-full h-11 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-50 text-sm placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 border rounded-xl pl-10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 dark:border-slate-700 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="w-full grid grid-cols-1 gap-y-2">
                <label
                  htmlFor="create-document-topic"
                  className="text-gray-700 dark:text-slate-300 text-sm font-medium"
                >
                  What do you want to create?
                </label>

                <div className="relative">
                  <div className="pl-3 flex justify-center items-center pointer-events-none absolute inset-y-0 left-0">
                    <Lightbulb className="size-4 text-gray-400 dark:text-slate-500" />
                  </div>

                  <input
                    autoFocus={mode === "ai"}
                    type="text"
                    id="create-document-topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Write a startup pitch deck draft for an AI SaaS..."
                    disabled={isBusy}
                    className="w-full h-11 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-50 text-sm placeholder-gray-400 dark:placeholder-slate-500 px-3 py-2 border rounded-xl pl-10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 dark:border-slate-700 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
                {mode === "blank" && (
                  <button
                    type="button"
                    onClick={handleCreateBlank}
                    disabled={isGenerating || isCreating}
                    className="font-medium whitespace-nowrap inline-flex justify-center items-center gap-2 transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-600 focus:ring-2 focus:ring-gray-500 dark:focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 text-sm px-4 py-2.5 rounded-xl"
                  >
                    {isCreating ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <span>Start Blank</span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleGenerateWithAI}
                  disabled={isCreating}
                  className="font-medium whitespace-nowrap inline-flex justify-center items-center gap-2 transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-linear-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:from-violet-700 hover:to-purple-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 text-sm px-4 py-2.5 rounded-xl"
                >
                  {isGenerating ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      <span>Generate with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

export default CreateDocumentModal;
