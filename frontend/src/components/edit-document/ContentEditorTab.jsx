import { useMemo, useState } from "react";
import Button from "../ui/Button";
import Dropdown, { DropdownItem } from "../ui/Dropdown";
import ImportButton from "./ImportButton";
import {
  Sparkles,
  ChevronDown,
  Bold,
  Italic,
  Code,
  Image,
  Maximize,
  Minimize,
  Columns2,
  AlignLeft,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import CodeMirrorEditor from "./CodeMirrorEditor";
import { formatMdContent } from "../../utils/helpers";

function ToolbarBtn({ onClick, title, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-50 ${
        active ? "bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-slate-50" : ""
      }`}
    >
      {children}
    </button>
  );
}

function ContentEditorTab({
  chunks = [],
  initialContent = "",
  editorRef,
  isGenerating,
  onAIAction = () => {},
  onCancelGeneration = () => {},
  onOpenAISettings = () => {},
  onDocumentEdit = () => {},
  documentId,
  onImportComplete,
}) {
  const [editorMode, setEditorMode] = useState("mde");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stats = useMemo(() => {
    const text = chunks.map((it) => it.content).join("");
    return {
      words: text.split(/\s+/).filter(Boolean).length,
      characters: text.length,
    };
  }, [chunks]);

  const previewHtml = useMemo(
    () => chunks.map((it) => it.content).join(""),
    [chunks]
  );

  const handleFormat = (type) => {
    const ref = editorRef.current;
    if (!ref) return;
    switch (type) {
      case "bold":  ref.wrapSelection("**", "**"); break;
      case "italic": ref.wrapSelection("_", "_"); break;
      case "code":  ref.wrapSelection("```\n", "\n```"); break;
      case "image": ref.insertAtCursor("![Alt text](url)"); break;
      case "h1":    ref.prependLinePrefix("# "); break;
      case "h2":    ref.prependLinePrefix("## "); break;
      case "h3":    ref.prependLinePrefix("### "); break;
    }
  };

  return (
    <article
      className={`flex flex-col bg-white dark:bg-slate-900 ${
        isFullscreen ? "fixed inset-0 z-50 overflow-hidden" : "flex-1"
      }`}
    >
      {/* AI Actions header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-4">
          <div>
            <h1 className="text-slate-900 dark:text-slate-50 text-xl font-bold">Editor</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Focused writing workspace</p>
          </div>

          <div className="flex items-center gap-2">
            {documentId && onImportComplete && (
              <ImportButton documentId={documentId} onImportComplete={onImportComplete} />
            )}

            <Dropdown
              trigger={
                isGenerating ? (
                  <Button
                    type="button"
                    onClick={onCancelGeneration}
                    size="sm"
                    variant="destructive"
                  >
                    Stop
                  </Button>
                ) : (
                  <Button type="button" icon={Sparkles} size="sm">
                    <span className="flex items-center gap-2">
                      AI Actions
                      <ChevronDown className="size-4" />
                    </span>
                  </Button>
                )
              }
            >
              <DropdownItem onClick={() => onAIAction("generate")}>Generate Draft</DropdownItem>
              <DropdownItem onClick={() => onAIAction("continue")}>Continue Writing</DropdownItem>
              <DropdownItem onClick={() => onAIAction("rewrite")}>Rewrite</DropdownItem>
              <DropdownItem onClick={() => onAIAction("expand")}>Expand</DropdownItem>
              <DropdownItem onClick={() => onAIAction("shorten")}>Shorten</DropdownItem>
              <DropdownItem onClick={() => onAIAction("grammar")}>Fix Grammar</DropdownItem>
              <DropdownItem onClick={() => onAIAction("simplify")}>Simplify</DropdownItem>
              <DropdownItem onClick={onOpenAISettings}>Change AI Settings</DropdownItem>
              <DropdownItem onClick={() => onAIAction("custom")}>Custom Prompt</DropdownItem>
            </Dropdown>
          </div>
        </div>
      </header>

      {/* Formatting toolbar */}
      <div className="border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-2 shrink-0 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-0.5">
          <ToolbarBtn onClick={() => handleFormat("h1")} title="Heading 1"><Heading1 className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => handleFormat("h2")} title="Heading 2"><Heading2 className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => handleFormat("h3")} title="Heading 3"><Heading3 className="size-4" /></ToolbarBtn>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

          <ToolbarBtn onClick={() => handleFormat("bold")} title="Bold"><Bold className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => handleFormat("italic")} title="Italic"><Italic className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => handleFormat("code")} title="Code block"><Code className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => handleFormat("image")} title="Image (URL)"><Image className="size-4" /></ToolbarBtn>
        </div>

        <div className="flex items-center gap-0.5">
          <ToolbarBtn onClick={() => setEditorMode("mde")} title="Editor only" active={editorMode === "mde"}>
            <AlignLeft className="size-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setEditorMode("split")} title="Split: editor + preview" active={editorMode === "split"}>
            <Columns2 className="size-4" />
          </ToolbarBtn>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

          <ToolbarBtn onClick={() => setIsFullscreen((v) => !v)} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </ToolbarBtn>
        </div>
      </div>

      {/* Editor + optional preview */}
      <section
        className={`flex-1 overflow-hidden flex ${
          editorMode === "split" ? "flex-row" : "flex-col"
        }`}
      >
        {/* Editor pane */}
        <div
          className={`${
            editorMode === "split"
              ? "w-1/2 border-r border-slate-200 dark:border-slate-700"
              : "w-full"
          } overflow-y-auto px-4 sm:px-6 lg:px-8 py-6`}
        >
          <div className="max-w-5xl mx-auto">
            <CodeMirrorEditor
              key={initialContent}
              ref={editorRef}
              initialContent={initialContent}
              onDocumentEdit={onDocumentEdit}
            />
          </div>
        </div>

        {/* Preview pane (split mode) */}
        {editorMode === "split" && (
          <div className="w-1/2 overflow-y-auto px-6 sm:px-8 py-6 bg-slate-50 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700">
            {previewHtml.trim() ? (
              <div
                className="max-w-3xl mx-auto reading-content"
                style={{ fontSize: 16, lineHeight: 1.75, fontFamily: "Inter, sans-serif" }}
                dangerouslySetInnerHTML={{
                  __html: formatMdContent(previewHtml),
                }}
              />
            ) : (
              <p className="text-slate-400 dark:text-slate-500 text-sm text-center mt-12">
                Preview will appear here as you write.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Stats footer */}
      <footer className="text-slate-500 dark:text-slate-400 text-sm border-t border-slate-100 dark:border-slate-800 px-6 py-4 shrink-0 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-6">
          <span>Words: <strong className="text-slate-700 dark:text-slate-200">{stats.words}</strong></span>
          <span>Characters: <strong className="text-slate-700 dark:text-slate-200">{stats.characters}</strong></span>
          <span>Chunks: <strong className="text-slate-700 dark:text-slate-200">{chunks.length}</strong></span>
        </div>
      </footer>
    </article>
  );
}

export default ContentEditorTab;
