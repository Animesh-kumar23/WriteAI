function AISettingsModal({ isOpen, onClose, aiConfig, setAiConfig }) {
  if (!isOpen) return null;

  const selectClass =
    "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              AI Settings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Customize how AI writes and transforms your content
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Writing Style
            </label>
            <select
              value={aiConfig.style}
              onChange={(e) => setAiConfig((prev) => ({ ...prev, style: e.target.value }))}
              className={selectClass}
            >
              <option>Professional</option>
              <option>Casual</option>
              <option>Friendly</option>
              <option>Academic</option>
              <option>Technical</option>
              <option>Persuasive</option>
              <option>Creative</option>
              <option>Inquisitive</option>
              <option>Storytelling</option>
              <option>Formal</option>
              <option>Minimalist</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Target Audience
            </label>
            <select
              value={aiConfig.audience}
              onChange={(e) => setAiConfig((prev) => ({ ...prev, audience: e.target.value }))}
              className={selectClass}
            >
              <option value="">General Readers</option>
              <option>Developers</option>
              <option>Students</option>
              <option>Executives</option>
              <option>Founders</option>
              <option>Researchers</option>
              <option>Children</option>
              <option>Beginners</option>
              <option>Experts</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Document Format
            </label>
            <select
              value={aiConfig.format}
              onChange={(e) => setAiConfig((prev) => ({ ...prev, format: e.target.value }))}
              className={selectClass}
            >
              <option value="">Freeform</option>
              <option>Article</option>
              <option>Guide</option>
              <option>Tutorial</option>
              <option>Listicle</option>
              <option>Essay</option>
              <option>Proposal</option>
              <option>Report</option>
              <option>Documentation</option>
              <option>FAQ</option>
              <option>Newsletter</option>
              <option>Story</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Length
            </label>
            <select
              value={aiConfig.length}
              onChange={(e) => setAiConfig((prev) => ({ ...prev, length: e.target.value }))}
              className={selectClass}
            >
              <option value="">Medium</option>
              <option>Short</option>
              <option>Long</option>
              <option>Very Long</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Additional Instructions
            </label>
            <textarea
              value={aiConfig.extraInstructions}
              onChange={(e) => setAiConfig((prev) => ({ ...prev, extraInstructions: e.target.value }))}
              rows={4}
              placeholder="Use startup examples. Avoid jargon. Include actionable takeaways."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                "Confident", "Conversational", "Analytical", "Inspirational",
                "Humorous", "Serious", "Neutral", "Empathetic", "Bold",
              ].map((toneOption) => {
                const isSelected = aiConfig.tone.includes(toneOption);
                return (
                  <button
                    key={toneOption}
                    type="button"
                    onClick={() =>
                      setAiConfig((prev) => ({
                        ...prev,
                        tone: isSelected
                          ? prev.tone.filter((it) => it !== toneOption)
                          : [...prev.tone, toneOption],
                      }))
                    }
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      isSelected
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                    }`}
                  >
                    {toneOption}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default AISettingsModal;
