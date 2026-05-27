import { useNavigate } from "react-router";
import { API_BASE_URL } from "../utils/api-endpoints";
import { Edit, Trash2, FileText } from "lucide-react";

function DocumentCard({ document, onDelete }) {
  const navigate = useNavigate();

  if (!document?._id) return null;

  const { _id, title, subtitle, coverImage } = document;

  const coverImageUrl = coverImage
    ? `${API_BASE_URL}${coverImage}`.replace(/\\/g, "/")
    : null;

  return (
    <li
      onClick={() => navigate(`/documents/${_id}`)}
      aria-label={`Open document ${title || "Untitled Document"}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/documents/${_id}`);
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
          <div className="w-full aspect-16/10 bg-linear-to-br from-violet-50 via-purple-50 to-slate-50 dark:from-violet-900/20 dark:via-purple-900/20 dark:to-slate-800 flex flex-col items-center justify-center gap-3">
            <div className="size-14 bg-white dark:bg-slate-700 shadow-md rounded-2xl flex items-center justify-center">
              <FileText className="size-7 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              No cover
            </span>
          </div>
        )}

        <div className="opacity-0 flex items-center gap-2 absolute top-3 right-3 transition-opacity duration-200 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/documents/${_id}/edit`);
            }}
            aria-label="Edit document"
            title="Edit document"
            className="size-9 bg-white dark:bg-slate-700 rounded-xl shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-slate-50 dark:hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Edit className="size-4 text-slate-700 dark:text-slate-300" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            aria-label="Delete document"
            title="Delete document"
            className="size-9 bg-white dark:bg-slate-700 rounded-xl shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-red-50 dark:hover:bg-red-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Trash2 className="size-4 text-red-500 dark:text-red-400" />
          </button>
        </div>
      </div>

      <section className="p-5">
        <h3 className="text-slate-900 dark:text-slate-50 font-semibold text-base leading-tight line-clamp-2 mb-2">
          {title || "Untitled Document"}
        </h3>

        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
          {subtitle || "Writing project"}
        </p>
      </section>

      <div className="h-1 bg-linear-to-r from-violet-500 to-purple-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </li>
  );
}

export default DocumentCard;
