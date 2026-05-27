import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import axiosInstance from "../lib/axios";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import toast from "react-hot-toast";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  DocumentCard,
  Button,
  CreateDocumentModal,
  Dropdown,
  DropdownItem,
  SearchModal,
} from "../components";
import { FileText, FilePlus, PencilLine, Search } from "lucide-react";

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
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              isLoading={isDeleting}
            >
              Delete
            </Button>
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);

      try {
        const { data } = await axiosInstance.get(API_ENDPOINTS.DOCUMENTS.GET_ALL);
        setDocuments(data.documents);
      } catch (error) {
        console.error("Error fetching documents:", error);
        toast.error("Failed to load your documents!", {
          duration: 5000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
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

          <div className="flex items-center gap-2">
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

          <Dropdown
            trigger={
              <Button
                type="button"
                icon={FilePlus}
                className="w-full sm:w-auto"
              >
                New Document
              </Button>
            }
          >
            <DropdownItem
              onClick={() => {
                setCreateMode("blank");
                setIsCreateDocumentModalOpen(true);
              }}
            >
              Create Blank
            </DropdownItem>

            <DropdownItem
              onClick={() => {
                setCreateMode("ai");
                setIsCreateDocumentModalOpen(true);
              }}
            >
              Create with AI
            </DropdownItem>
          </Dropdown>
          </div>
        </header>

        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(docId) => {
            if (docId) navigate(`/documents/${docId}`);
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

            <Dropdown
              trigger={
                <Button
                  type="button"
                  icon={PencilLine}
                >
                  Start Writing
                </Button>
              }
            >
              <DropdownItem
                onClick={() => {
                  setCreateMode("blank");
                  setIsCreateDocumentModalOpen(true);
                }}
              >
                Create Blank
              </DropdownItem>

              <DropdownItem
                onClick={() => {
                  setCreateMode("ai");
                  setIsCreateDocumentModalOpen(true);
                }}
              >
                Create with AI
              </DropdownItem>
            </Dropdown>
          </section>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {documents.map((document) => (
              <DocumentCard
                key={document._id}
                document={document}
                onDelete={() => {
                  setDocumentToDeleteId(document._id);
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