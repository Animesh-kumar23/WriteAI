import { useState } from "react";
import { Search } from "lucide-react";
import { formatMdContent } from "../../utils/helpers";

function DocumentView({ document, chunks, sentinelRef, loadingMore, onSearchOpen }) {
  const [fontSize, setFontSize] = useState(18);

  return (
    <div className="h-[calc(100vh-64px)] bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-50 flex">
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 dark:border-slate-800 p-4 flex justify-between items-center bg-white dark:bg-slate-900">
          <div>
            <h1 className="text-base md:text-lg font-semibold truncate text-gray-900 dark:text-slate-50">
              {document.title}
            </h1>
          </div>

          <div className="mr-4 flex items-center gap-2">
            {onSearchOpen && (
              <button
                type="button"
                onClick={onSearchOpen}
                aria-label="Search documents"
                className="p-2 rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <Search className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              className="font-bold text-sm rounded-lg p-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              A-
            </button>

            <span className="text-gray-500 dark:text-slate-400 text-sm">{fontSize}px</span>

            <button
              type="button"
              onClick={() => setFontSize(Math.min(24, fontSize + 2))}
              className="font-bold text-lg rounded-lg p-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              A+
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          <div className="max-w-4xl px-6 py-4 mx-auto">
            <div
              style={{ fontFamily: "Inter, sans-serif", fontSize, lineHeight: 1.7 }}
              className="space-y-8"
            >
              {chunks.map((it) => (
                <div
                  key={it.order}
                  className="reading-content"
                  dangerouslySetInnerHTML={{ __html: formatMdContent(it.content) }}
                />
              ))}

              <div ref={sentinelRef} className="h-12" />

              {loadingMore && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
                  Loading more...
                </p>
              )}

              {!loadingMore && chunks.length === 0 && (
                <p className="text-center text-gray-500 dark:text-slate-400 py-8">
                  No document content available.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default DocumentView;
