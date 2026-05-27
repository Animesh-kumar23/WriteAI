import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { useTheme } from "../../contexts/ThemeContext";

const CodeMirrorEditor = forwardRef(
  (
    {
      initialContent = "",
      onDocumentEdit = () => {},
    },
    ref
  ) => {
    const editorRef = useRef(null);
    const { isDark } = useTheme();

    useImperativeHandle(ref, () => ({
      getText() {
        if (!editorRef.current) return "";
        return editorRef.current.state.doc.toString();
      },

      insertTextAt(position, text) {
        if (!editorRef.current) return;
        editorRef.current.dispatch({
          changes: { from: position, to: position, insert: text },
        });
      },

      replaceRange(from, to, text) {
        if (!editorRef.current) return;
        editorRef.current.dispatch({
          changes: { from, to, insert: text },
        });
      },

      getDocLength() {
        if (!editorRef.current) return 0;
        return editorRef.current.state.doc.length;
      },

      isReady() {
        return !!editorRef.current;
      },

      wrapSelection(before, after) {
        if (!editorRef.current) return;
        const view = editorRef.current;
        const sel = view.state.selection.main;
        const selected = view.state.sliceDoc(sel.from, sel.to);
        const insert = before + selected + after;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert },
          selection: {
            anchor: sel.from + before.length,
            head: sel.from + before.length + selected.length,
          },
        });
        view.focus();
      },

      prependLinePrefix(prefix) {
        if (!editorRef.current) return;
        const view = editorRef.current;
        const sel = view.state.selection.main;
        const line = view.state.doc.lineAt(sel.from);
        view.dispatch({
          changes: { from: line.from, to: line.from, insert: prefix },
          selection: { anchor: sel.from + prefix.length },
        });
        view.focus();
      },

      insertAtCursor(text) {
        if (!editorRef.current) return;
        const view = editorRef.current;
        const sel = view.state.selection.main;
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: text },
          selection: { anchor: sel.from + text.length },
        });
        view.focus();
      },
    }));

    return (
      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-black/20">
        <CodeMirror
          value={initialContent}
          height="700px"
          extensions={[markdown(), EditorView.lineWrapping]}
          theme={isDark ? "dark" : "light"}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
          }}
          onCreateEditor={(view) => {
            editorRef.current = view;
          }}
          onChange={(_, update) => {
            update.changes.iterChanges(
              (fromA, toA, _fromB, _toB, inserted) => {
                onDocumentEdit(fromA, toA, inserted.toString());
              }
            );
          }}
        />
      </div>
    );
  }
);

export default CodeMirrorEditor;
