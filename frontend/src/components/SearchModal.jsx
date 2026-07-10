import { useEffect, useRef } from "react";
import { Search, X, FileText, ChevronRight } from "lucide-react";
import useSearch from "../hooks/useSearch";

function SnippetText({ snippet, matchStart, matchEnd }) {
  if (matchStart < 0) return <span className="text-gray-500 dark:text-slate-400">{snippet}</span>;
  return (
    <span className="text-gray-500 dark:text-slate-400">
      {snippet.slice(0, matchStart)}
      <mark className="bg-violet-100 dark:bg-violet-500/25 text-violet-800 dark:text-violet-300 rounded px-0.5 not-italic font-medium">
        {snippet.slice(matchStart, matchEnd)}
      </mark>
      {snippet.slice(matchEnd)}
    </span>
  );
}

function SearchModal({ isOpen, onClose, onNavigate }) {
  const inputRef = useRef(null);
  const { query, results, isSearching, search, clearSearch } = useSearch();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      clearSearch();
    }
  }, [isOpen, clearSearch]);

  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) onNavigate?.(null);
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, onNavigate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-16 flex justify-center items-start">
        {/* Backdrop */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search documents"
          className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl dark:shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-200"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <Search className="size-4 text-gray-400 dark:text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search by title or content..."
              className="flex-1 text-sm text-gray-900 dark:text-slate-50 placeholder-gray-400 dark:placeholder-slate-500 bg-transparent outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => { clearSearch(); inputRef.current?.focus(); }}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isSearching && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                Searching...
              </div>
            )}

            {!isSearching && query.length >= 2 && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {!isSearching && results.length > 0 && (
              <ul className="py-2">
                {results.map((doc) => (
                  <li key={doc.documentId}>
                    <button
                      type="button"
                      onClick={() => { onNavigate(doc.documentId); onClose(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left"
                    >
                      {doc.coverImage ? (
                        <img
                          src={doc.coverImage}
                          alt=""
                          className="size-8 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="size-8 rounded bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                          <FileText className="size-4 text-violet-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-50 truncate">
                          {doc.title}
                        </p>
                        {doc.subtitle && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{doc.subtitle}</p>
                        )}
                      </div>
                      <ChevronRight className="size-3.5 text-gray-300 dark:text-slate-600 shrink-0" />
                    </button>

                    {doc.chunkMatches?.map((match) => (
                      <button
                        key={match.order}
                        type="button"
                        onClick={() => { onNavigate(doc.documentId, match.order); onClose(); }}
                        className="w-full flex items-start gap-3 pl-14 pr-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left"
                      >
                        <p className="text-xs leading-relaxed line-clamp-2">
                          <SnippetText
                            snippet={match.snippet}
                            matchStart={match.matchStart}
                            matchEnd={match.matchEnd}
                          />
                        </p>
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            )}

            {!query && (
              <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
                Type to search across your documents
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-gray-50 dark:border-slate-700 flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500">
            <span><kbd className="font-mono bg-gray-100 dark:bg-slate-700 dark:text-slate-400 px-1 py-0.5 rounded">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono bg-gray-100 dark:bg-slate-700 dark:text-slate-400 px-1 py-0.5 rounded">↵</kbd> open</span>
            <span><kbd className="font-mono bg-gray-100 dark:bg-slate-700 dark:text-slate-400 px-1 py-0.5 rounded">Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
