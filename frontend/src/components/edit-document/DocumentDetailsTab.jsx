import { UploadCloud, Image as ImageIcon } from "lucide-react";
import { API_BASE_URL } from "../../utils/api-endpoints";
import Button from "../ui/Button";
import Input from "../ui/Input";

function DocumentDetailsTab({
  document,
  onEditDocument,
  fileInputRef,
  isUploading,
  onCoverImageUpload,
}) {
  const coverImageUrl = document.coverImage
    ? `${API_BASE_URL}${document.coverImage}`.replace(/\\/g, "/")
    : null;

  return (
    <div className="max-w-4xl p-4 sm:p-6 lg:p-8 mx-auto">
      {/* Document Details */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-slate-900 dark:text-slate-50 text-base sm:text-lg font-semibold mb-4">
          Document Details
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <Input
            type="text"
            label="Title"
            name="title"
            value={document.title}
            onChange={onEditDocument}
          />

          <Input
            type="text"
            label="Description"
            name="subtitle"
            value={document.subtitle || ""}
            onChange={onEditDocument}
          />
        </div>
      </section>

      {/* Document Cover */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-6 mt-6 sm:mt-8 shadow-sm">
        <h3 className="text-slate-900 dark:text-slate-50 text-base sm:text-lg font-semibold mb-4">
          Document Cover
        </h3>

        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Document cover"
              className="w-full sm:w-32 h-48 bg-slate-100 dark:bg-slate-700 object-cover rounded-lg shadow-sm"
            />
          ) : (
            <div className="w-full sm:w-32 h-48 bg-linear-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-2 border-dashed border-violet-200 dark:border-violet-700 rounded-lg shadow-sm flex flex-col items-center justify-center gap-2 p-4">
              <div className="size-12 bg-violet-100 dark:bg-violet-500/20 rounded-full flex items-center justify-center">
                <ImageIcon className="size-6 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-xs text-center text-slate-500 dark:text-slate-400 font-medium">
                No document cover
              </p>
            </div>
          )}

          <div className="flex-1 w-full flex flex-col gap-y-3 sm:gap-y-4">
            <div className="space-y-1">
              <label
                htmlFor="cover-image"
                className="text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium block"
              >
                Upload Document Cover
              </label>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Recommended size: 1200×800px (max 2MB)
              </p>
            </div>

            <input
              type="file"
              name="coverImage"
              id="cover-image"
              ref={fileInputRef}
              onChange={onCoverImageUpload}
              accept="image/*"
              className="hidden"
            />

            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef?.current?.click()}
              isLoading={isUploading}
              icon={UploadCloud}
              size="sm"
              className="w-full sm:w-fit"
            >
              {coverImageUrl ? "Change Cover" : "Upload Cover"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DocumentDetailsTab;
