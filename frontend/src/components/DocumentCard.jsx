import { useNavigate } from "react-router";
import { API_BASE_URL } from "../utils/api-endpoints";
import { Edit, Trash2, FileText, MoreVertical, PencilLine } from "lucide-react";
import { relativeTime } from "../utils/relativeTime";

function DocumentCard({ document, onDelete, onRename }) {
  const navigate = useNavigate();

  if (!document?._id) return null;

  const { _id, title, subtitle, coverImage, updatedAt, wordCount } = document;

  const coverImageUrl = coverImage
    ? `${API_BASE_URL}${coverImage}`.replace(/\\/g, "/")
    : null;

  const stopProp = (event) => event.stopPropagation();

  return (
    <li
      onClick={() => navigate(`/documents/${_id}/edit`)}
      aria-label={`Open document ${title || "Untitled Document"}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/documents/${_id}/edit`);
        }
      }}
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden cursor-pointer relative group transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-black/30 hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 active:shadow-xl active:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
    >
      <div className="relative bg-slate-50 dark:bg-slate-900">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={`${title || "Document"} cover`}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="w-full aspect-16/10 object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-full aspect-16/10 bg-linear-to-br from-violet-50 via-purple-50 to-slate-50 dark:from-violet-900/20 dark:via-purple-900/20 dark:to-slate-800 flex items-center justify-center"
          >
            <div className="relative transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-1">
              <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-2xl border border-violet-200/70 bg-violet-100/70 dark:border-violet-700/40 dark:bg-violet-900/30" />
              <div className="relative w-28 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-xl shadow-violet-200/40 dark:border-slate-600 dark:bg-slate-700 dark:shadow-black/20">
                <FileText className="size-7 text-violet-600 dark:text-violet-400" />
                <div className="mt-5 space-y-2">
                  <span className="block h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-500" />
                  <span className="block h-1.5 w-4/5 rounded-full bg-slate-200 dark:bg-slate-500" />
                  <span className="block h-1.5 w-3/5 rounded-full bg-violet-200 dark:bg-violet-500/60" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          onClick={stopProp}
          onKeyDown={stopProp}
          className="opacity-0 absolute top-3 right-3 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <details className="relative">
            <summary
              aria-label="Document actions"
              title="More actions"
              className="size-9 bg-white dark:bg-slate-700 rounded-xl shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-slate-50 dark:hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer list-none"
            >
              <MoreVertical className="size-4 text-slate-700 dark:text-slate-300" />
            </summary>
            <div className="w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mt-2 py-1 shadow-lg dark:shadow-black/30 absolute right-0 z-20 overflow-hidden">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/documents/${_id}/edit`);
              }}
              className="w-full text-slate-700 dark:text-slate-300 px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Edit className="text-slate-500 size-4" />
              Edit
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.currentTarget.closest("details")?.removeAttribute("open");
                onRename?.();
              }}
              className="w-full text-slate-700 dark:text-slate-300 px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <PencilLine className="text-slate-500 size-4" />
              Rename
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                event.currentTarget.closest("details")?.removeAttribute("open");
                onDelete?.();
              }}
              className="w-full text-slate-700 dark:text-slate-300 px-4 py-2 text-sm text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Trash2 className="text-red-500 size-4" />
              <span className="text-red-600 dark:text-red-400">Delete</span>
            </button>
            </div>
          </details>
        </div>
      </div>

      <section className="p-5">
        <h3 className="text-slate-900 dark:text-slate-50 font-semibold text-base leading-tight line-clamp-2 mb-2">
          {title || "Untitled Document"}
        </h3>

        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
          {subtitle || "Writing project"}
        </p>

        {(updatedAt || wordCount) && (
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-3 truncate">
            {updatedAt && <>Edited {relativeTime(updatedAt)}</>}
            {updatedAt && wordCount > 0 && <span className="mx-1.5">·</span>}
            {wordCount > 0 && <>~{wordCount.toLocaleString()} words</>}
          </p>
        )}
      </section>

      <div className="h-1 bg-linear-to-r from-violet-500 to-purple-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </li>
  );
}

export default DocumentCard;
