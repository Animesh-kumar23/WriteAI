import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import toast from "react-hot-toast";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  DocumentCard,
  CreateDocumentModal,
  SearchModal,
} from "../components";
import { ArrowUpDown, FileText, FilePlus, Loader2, PencilLine, Search } from "lucide-react";

const SORT_OPTIONS = [
  { key: "updatedDesc", label: "Last edited (newest)" },
  { key: "updatedAsc", label: "Last edited (oldest)" },
  { key: "createdDesc", label: "Created (newest)" },
  { key: "createdAsc", label: "Created (oldest)" },
  { key: "titleAsc", label: "Title A–Z" },
  { key: "titleDesc", label: "Title Z–A" },
];

const sortDocuments = (docs, sortBy) => {
  const copy = [...docs];
  switch (sortBy) {
    case "updatedAsc":
      return copy.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    case "createdDesc":
      return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case "createdAsc":
      return copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case "titleAsc":
      return copy.sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
      );
    case "titleDesc":
      return copy.sort((a, b) =>
        (b.title || "").localeCompare(a.title || "", undefined, { sensitivity: "base" })
      );
    case "updatedDesc":
    default:
      return copy.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
};

const DocumentCardSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm animate-pulse">
    <div className="w-full aspect-16/10 bg-gray-200 dark:bg-slate-700 rounded-t-xl" />

    <div className="p-4">
      <div className="w-3/4 h-5 md:h-6 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
      <div className="w-1/2 h-3 md:h-4 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>
  </div>
);

const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isDeleting,
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen && !isDeleting) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose, isDeleting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="min-h-screen px-4 flex justify-center items-center">
        <div
          onClick={!isDeleting ? onClose : undefined}
          className="bg-black/50 backdrop-blur-sm fixed inset-0 animate-in fade-in duration-200"
          aria-hidden="true"
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl p-5 md:p-6 shadow-xl dark:shadow-black/40 relative animate-in zoom-in-95 duration-200"
        >
          <h3
            id="delete-modal-title"
            className="text-gray-900 dark:text-slate-50 text-base md:text-lg font-semibold mb-3 md:mb-4 pr-4 break-words"
          >
            {title}
          </h3>

          <p className="text-gray-600 dark:text-slate-400 text-sm md:text-base mb-5 md:mb-6">
            {message}
          </p>

          <div className="flex justify-end items-center gap-x-2 md:gap-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="bg-slate-700 text-slate-100 text-sm font-medium rounded-xl px-4 py-2.5 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-red-600 text-white text-sm font-medium rounded-xl px-4 py-2.5 inline-flex items-center gap-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting && <Loader2 className="size-5 animate-spin" />}
              {!isDeleting && "Delete"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const RenameDocumentModal = ({
  isOpen,
  onClose,
  onConfirm,
  initialTitle,
  isRenaming,
}) => {
  const [draft, setDraft] = useState(initialTitle || "");

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isOpen && !isRenaming) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isRenaming, onClose]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Title is required.");
      return;
    }
    if (trimmed === (initialTitle || "").trim()) {
      onClose();
      return;
    }
    onConfirm(trimmed);
  };

  if (!isOpen) return null;

  return (
    <div className="overflow-y-auto fixed inset-0 z-50">
      <div className="min-h-screen px-4 py-8 flex justify-center items-center">
        <div
          onClick={isRenaming ? undefined : onClose}
          className="bg-black/50 backdrop-blur-sm fixed inset-0"
          aria-hidden="true"
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-modal-title"
          className="max-w-md w-full bg-slate-800 rounded-xl p-5 md:p-6 shadow-xl relative"
        >
          <h3 id="rename-modal-title" className="text-slate-50 text-base md:text-lg font-semibold mb-5">
            Rename document
          </h3>
      <div className="space-y-5">
        <div className="grid gap-2">
          <label htmlFor="rename-title" className="text-slate-300 text-sm font-medium">
            Document Title<span className="text-red-500">*</span>
          </label>
          <input
            id="rename-title"
            autoFocus
            type="text"
            required
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="My new writing project"
            disabled={isRenaming}
            className="w-full h-11 bg-slate-800 text-slate-50 text-sm placeholder-slate-500 px-3 py-2 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
        </div>
        <div className="flex justify-end items-center gap-x-2 md:gap-x-3">
          <button type="button" onClick={onClose} disabled={isRenaming} className="bg-slate-700 text-slate-100 text-sm font-medium rounded-xl px-4 py-2.5 hover:bg-slate-600 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={isRenaming} className="bg-linear-to-r from-violet-600 to-purple-600 text-white text-sm font-medium rounded-xl px-4 py-2.5 inline-flex items-center gap-2 disabled:opacity-50">
            {isRenaming && <Loader2 className="size-5 animate-spin" />}
            {!isRenaming && "Save"}
          </button>
        </div>
      </div>
        </section>
      </div>
    </div>
  );
};

function DashboardPage() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDocumentModalOpen, setIsCreateDocumentModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState("blank");
  const [documentToDeleteId, setDocumentToDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [documentToRenameId, setDocumentToRenameId] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [sortBy, setSortBy] = useState("updatedDesc");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navigate = useNavigate();

  const sortedDocuments = useMemo(
    () => sortDocuments(documents, sortBy),
    [documents, sortBy]
  );

  const documentToRename = useMemo(
    () => documents.find((doc) => doc?._id === documentToRenameId) || null,
    [documents, documentToRenameId]
  );

  useEffect(() => {
    const controller = new AbortController();
    const fetchDocuments = async () => {
      setIsLoading(true);

      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.DOCUMENTS.GET_ALL, {
          signal: controller.signal,
        });
        setDocuments(data.documents);
      } catch (error) {
        if (error?.name === "CanceledError" || error?.code === "ERR_CANCELED") return;
        console.error("Error fetching documents:", error);
        toast.error("Failed to load your documents!", {
          duration: 5000,
        });
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchDocuments();
    return () => controller.abort();
  }, []);

  const handleDeleteDocument = async () => {
    if (!documentToDeleteId) return;

    setIsDeleting(true);

    try {
      await axiosInstance.delete(
        `${API_ENDPOINTS.DOCUMENTS.DELETE}/${documentToDeleteId}`
      );

      setDocuments((prev) => prev.filter((document) => document._id !== documentToDeleteId));

      toast.success("Document removed successfully!");
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to remove document!");
    } finally {
      setIsDeleting(false);
      setDocumentToDeleteId(null);
    }
  };

  const handleRenameDocument = async (newTitle) => {
    if (!documentToRenameId) return;

    setIsRenaming(true);

    try {
      const { data } = await axiosInstance.put(
        `${API_ENDPOINTS.DOCUMENTS.UPDATE_CONTENT}/${documentToRenameId}`,
        { title: newTitle }
      );

      const updated = data?.document;
      setDocuments((prev) =>
        prev.map((doc) =>
          doc._id === documentToRenameId
            ? { ...doc, ...(updated || { title: newTitle }) }
            : doc
        )
      );

      toast.success("Document renamed.");
      setDocumentToRenameId(null);
    } catch (error) {
      console.error("Error renaming document:", error);
      toast.error(error.response?.data?.error || "Failed to rename document.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleCreateDocument = (documentId) => {
    setIsCreateDocumentModalOpen(false);
    navigate(`/documents/${documentId}/edit`);
  };

  return (
    <DashboardLayout>
      <main className="container max-w-7xl p-4 md:p-6 mx-auto">
        <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-gray-900 dark:text-slate-50 text-xl md:text-2xl font-bold mb-1">
              Documents
            </h1>

            <p className="text-gray-600 dark:text-slate-400 text-xs md:text-sm">
              Manage, edit, and export your writing projects
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search documents"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors duration-150"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-xs bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 px-1.5 py-0.5 rounded">
                ⌘K
              </kbd>
            </button>

            {documents.length > 1 && (
              <label className="relative inline-flex items-center">
                <ArrowUpDown className="size-4 absolute left-3 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  aria-label="Sort documents"
                  className="appearance-none bg-transparent border border-slate-600 text-slate-300 text-sm rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
                </select>
              </label>
            )}

          <details className="relative">
            <summary className="bg-linear-to-r from-violet-600 to-purple-600 text-white text-sm font-medium rounded-xl px-4 py-2.5 shadow-lg shadow-violet-500/30 flex items-center gap-2 cursor-pointer list-none">
              <FilePlus className="size-4" /> New Document
            </summary>
            <div className="w-56 bg-slate-800 border border-slate-700 rounded-lg mt-2 py-1 shadow-lg absolute right-0 z-20 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setCreateMode("blank");
                setIsCreateDocumentModalOpen(true);
              }}
              className="w-full text-slate-300 px-4 py-2 text-sm text-left hover:bg-slate-700"
            >
              Create Blank
            </button>

            <button
              type="button"
              onClick={() => {
                setCreateMode("ai");
                setIsCreateDocumentModalOpen(true);
              }}
              className="w-full text-slate-300 px-4 py-2 text-sm text-left hover:bg-slate-700"
            >
              Create with AI
            </button>
            </div>
          </details>
          </div>
        </header>

        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(docId) => {
            if (docId) navigate(`/documents/${docId}/edit`);
            else setIsSearchOpen(true);
          }}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {Array(4)
              .fill(1)
              .map((_, index) => (
                <DocumentCardSkeleton key={index} />
              ))}
          </div>
        ) : documents.length === 0 ? (
          <section className="text-center border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl py-12 md:py-16 mt-8 flex flex-col justify-center items-center">
            <div className="size-14 md:size-16 bg-gray-100 dark:bg-slate-800 rounded-full mb-4 flex justify-center items-center">
              <FileText className="size-7 md:size-8 text-gray-400 dark:text-slate-500" />
            </div>

            <h3 className="text-gray-900 dark:text-slate-50 text-base md:text-lg font-medium mb-2">
              No documents yet
            </h3>

            <p className="max-w-md text-gray-500 dark:text-slate-400 text-sm md:text-base mb-6 px-4">
              Start your first writing project with AI assistance.
            </p>

            <details className="relative">
              <summary className="bg-linear-to-r from-violet-600 to-purple-600 text-white text-sm font-medium rounded-xl px-4 py-2.5 shadow-lg shadow-violet-500/30 flex items-center gap-2 cursor-pointer list-none">
                <PencilLine className="size-4" /> Start Writing
              </summary>
              <div className="w-56 bg-slate-800 border border-slate-700 rounded-lg mt-2 py-1 shadow-lg absolute left-1/2 -translate-x-1/2 z-20 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setCreateMode("blank");
                  setIsCreateDocumentModalOpen(true);
                }}
                className="w-full text-slate-300 px-4 py-2 text-sm text-left hover:bg-slate-700"
              >
                Create Blank
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateMode("ai");
                  setIsCreateDocumentModalOpen(true);
                }}
                className="w-full text-slate-300 px-4 py-2 text-sm text-left hover:bg-slate-700"
              >
                Create with AI
              </button>
              </div>
            </details>
          </section>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {sortedDocuments.map((document) => (
              <DocumentCard
                key={document._id}
                document={document}
                onDelete={() => {
                  setDocumentToDeleteId(document._id);
                }}
                onRename={() => {
                  setDocumentToRenameId(document._id);
                }}
              />
            ))}
          </ul>
        )}

        <DeleteConfirmationModal
          isOpen={Boolean(documentToDeleteId)}
          onClose={() => !isDeleting && setDocumentToDeleteId(null)}
          onConfirm={handleDeleteDocument}
          isDeleting={isDeleting}
          title={`Delete "${documents.find((doc) => doc?._id === documentToDeleteId)?.title ||
            "this document"
            }"?`}
          message="This action is permanent and cannot be undone. All content will be lost."
        />

        <RenameDocumentModal
          key={documentToRenameId || "closed"}
          isOpen={Boolean(documentToRenameId)}
          onClose={() => !isRenaming && setDocumentToRenameId(null)}
          onConfirm={handleRenameDocument}
          initialTitle={documentToRename?.title || ""}
          isRenaming={isRenaming}
        />

        <CreateDocumentModal
          isOpen={isCreateDocumentModalOpen}
          onClose={() => setIsCreateDocumentModalOpen(false)}
          onDocumentCreate={handleCreateDocument}
          initialMode={createMode}
        />
      </main>
    </DashboardLayout>
  );
}

export default DashboardPage;
