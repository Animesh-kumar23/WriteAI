const SOFT_LIMIT = 4000;
const HARD_LIMIT = 6000;

function findParagraphSplitPoint(text, maxLen) {
  const limit = Math.min(maxLen, text.length);

  const doubleNewline = text.lastIndexOf('\n\n', limit - 1);
  if (doubleNewline > 0) return doubleNewline + 2;

  const singleNewline = text.lastIndexOf('\n', limit - 1);
  if (singleNewline > 0) return singleNewline + 1;

  return limit;
}

class DocumentModel {
  constructor(chunks = []) {
    this.chunks = [...chunks]
      .sort((a, b) => a.order - b.order)
      .map((it) => ({
        order: it.order,
        content: it.content || "",
        dirty: false,
        // version is kept when chunks come from the server; undefined for new/split chunks
        version: it.version,
      }));

    if (!this.chunks.length) {
      this.chunks = [
        {
          order: 0,
          content: "",
          dirty: false,
        },
      ];
    }

    this.rebuildOffsets();
  }

  rebuildOffsets() {
    let cursor = 0;

    this.offsets = this.chunks.map((chunk) => {
      const start = cursor;
      const end = start + chunk.content.length;

      cursor = end;

      return {
        order: chunk.order,
        start,
        end,
      };
    });
  }

  getChunks() {
    return this.chunks.map((it) => ({
      order: it.order,
      content: it.content,
    }));
  }

  getFullText() {
    return this.chunks
      .map((it) => it.content)
      .join("");
  }

  getDirtyChunks() {
    return this.chunks.filter((it) => it.dirty);
  }

  markChunkSaved(order) {
    const chunk = this.chunks.find((it) => it.order === order);
    if (chunk) chunk.dirty = false;
  }

  // Only clears dirty if the chunk's content matches what was actually saved.
  // Prevents a race where a concurrent edit rebuilds this.chunks during an
  // in-flight save, causing markChunkSaved to clear dirty on the new,
  // unsaved content.
  markChunkSavedIfUnchanged(order, savedContent) {
    const chunk = this.chunks.find((it) => it.order === order);
    if (chunk && chunk.content === savedContent) {
      chunk.dirty = false;
    }
  }

  updateChunkVersion(order, newVersion) {
    const chunk = this.chunks.find((it) => it.order === order);
    if (chunk) {
      chunk.version = newVersion;
    }
  }

  // Used after conflict resolution to force-save without version check
  clearChunkVersion(order) {
    const chunk = this.chunks.find((it) => it.order === order);
    if (chunk) {
      chunk.version = undefined;
    }
  }

  findChunkByOffset(position) {
    for (let i = 0; i < this.offsets.length; i++) {
      const offset = this.offsets[i];

      if (
        position >= offset.start &&
        position <= offset.end
      ) {
        return i;
      }
    }

    return this.offsets.length - 1;
  }

  replaceRange(from, to, insertText) {
    const startIndex = this.findChunkByOffset(from);
    const endIndex = this.findChunkByOffset(to);

    const startOffset = this.offsets[startIndex];
    const endOffset = this.offsets[endIndex];

    const before =
      this.chunks[startIndex].content.slice(
        0,
        from - startOffset.start
      );

    const after =
      this.chunks[endIndex].content.slice(
        to - endOffset.start
      );

    const merged =
      before + insertText + after;

    this.chunks.splice(
      startIndex,
      endIndex - startIndex + 1,
      {
        order: this.chunks[startIndex].order,
        content: merged,
        dirty: true,
      }
    );

    this.normalizeAndSplit();
    this.rebuildOffsets();
  }

  normalizeAndSplit() {
    const rebuilt = [];
    let order = 0;

    for (const chunk of this.chunks) {
      if (chunk.content.length <= HARD_LIMIT) {
        rebuilt.push({
          order,
          content: chunk.content,
          dirty: chunk.dirty || (order !== chunk.order),
        });
        order++;
        continue;
      }

      let remaining = chunk.content;

      while (remaining.length > HARD_LIMIT) {
        const splitAt = findParagraphSplitPoint(remaining, HARD_LIMIT);
        rebuilt.push({ order, content: remaining.slice(0, splitAt), dirty: true });
        remaining = remaining.slice(splitAt);
        order++;
      }

      if (remaining.length > 0) {
        rebuilt.push({ order, content: remaining, dirty: true });
        order++;
      }
    }

    if (!rebuilt.length) {
      rebuilt.push({ order: 0, content: "", dirty: false });
    }

    this.chunks = rebuilt;
  }
}

export default DocumentModel;
export { SOFT_LIMIT, HARD_LIMIT };