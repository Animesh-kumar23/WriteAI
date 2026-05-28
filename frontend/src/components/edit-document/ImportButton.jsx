import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "../../lib/axios";
import { API_ENDPOINTS } from "../../utils/api-endpoints";

function ImportButton({ documentId, onImportComplete }) {
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected after an error
    e.target.value = "";

    setIsImporting(true);
    const loadingToast = toast.loading("Importing document...");

    try {
      const formData = new FormData();
      formData.append("importFile", file);

      await axiosInstance.post(
        `${API_ENDPOINTS.DOCUMENTS.IMPORT}/${documentId}/import`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      toast.dismiss(loadingToast);
      toast.success("Document imported successfully.");
      onImportComplete?.();
    } catch (error) {
      toast.dismiss(loadingToast);

      const status = error?.response?.status;
      const message = error?.response?.data?.error;

      if (status === 413) {
        toast.error("File is too large. Maximum size is 10MB.");
      } else if (status === 422) {
        toast.error(message || "Could not parse file. It may be corrupted.");
      } else if (status === 400) {
        toast.error(message || "Invalid file type. Only PDF and DOCX are supported.");
      } else {
        toast.error("Import failed. Please try again.");
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={handleFileChange}
        disabled={isImporting}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        title="Import PDF or DOCX"
        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Import document"
      >
        {isImporting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
      </button>
    </>
  );
}

export default ImportButton;
