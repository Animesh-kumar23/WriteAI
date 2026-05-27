import { useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { API_ENDPOINTS } from "../utils/api-endpoints";
import axiosInstance from "../lib/axios";
import DashboardLayout from "../layouts/DashboardLayout";
import { FileText, Search } from "lucide-react";
import { DocumentView } from "../components";
import SearchModal from "../components/SearchModal";
import { toast } from "sonner";
import useDocumentChunks from "../hooks/useDocumentChunks";

const DocumentViewSkeleton = () => (
  <div className="animate-pulse">
    <div className="w-1/2 h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
    <div className="w-1/2 h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4" />

    <div className="flex items-center gap-8">
      <div className="w-1/4">
        <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>

      <div className="w-3/4">
        <div className="h-full bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>
    </div>
  </div>
);

function DocumentPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  const [currentDocument, setCurrentDocument] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const {
    chunks,
    sentinelRef,
    loadingMore,
  } = useDocumentChunks(documentId);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const { data } = await axiosInstance.get(
          `${API_ENDPOINTS.DOCUMENTS.GET_BY_ID}/${documentId}`
        );

        setCurrentDocument(data.document);
      } catch (error) {
        console.error("Error fetching document:", error);

        toast.error("Failed to load document!", {
          duration: 5000,
        });

        navigate("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [documentId, navigate]);

  return (
    <DashboardLayout>
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(docId) => {
          if (docId) navigate(`/documents/${docId}`);
          else setIsSearchOpen(true);
        }}
      />

      {isLoading ? (
        <div className="container max-w-7xl p-4 md:p-6 mx-auto">
          <DocumentViewSkeleton />
        </div>
      ) : currentDocument ? (
        <DocumentView
          document={currentDocument}
          chunks={chunks}
          sentinelRef={sentinelRef}
          loadingMore={loadingMore}
          onSearchOpen={() => setIsSearchOpen(true)}
        />
      ) : (
        <div className="h-full px-4 flex justify-center items-center">
          <section className="text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-4 py-12">
            <div className="size-16 bg-slate-100 dark:bg-slate-800 rounded-full mb-4 mx-auto flex justify-center items-center">
              <FileText className="size-8 text-slate-400 dark:text-slate-500" />
            </div>

            <h3 className="text-slate-900 dark:text-slate-50 text-lg font-medium mb-2">
              Document not found
            </h3>

            <p className="max-w-md text-slate-500 dark:text-slate-400 text-sm mb-6">
              The Document you are looking for either does not exist or you do not
              have permission to view it.
            </p>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DocumentPage;