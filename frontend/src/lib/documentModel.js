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
    const sortedChunks = [...chunks].sort((a, b) => a.order - b.order);

    // Versions belong to server-side orders, not to pieces of text. Keeping
    // them separately lets a structural edit compare-and-swap the destination
    // order and lets us emit tombstones for orders removed by a merge/delete.
    this.serverVersionsByOrder = new Map(
      sortedChunks
        .filter((chunk) => chunk.version !== undefined)
        .map((chunk) => [chunk.order, chunk.version])
    );
    this.forcedDeletedOrders = new Set();

    this.chunks = sortedChunks
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

  getDeletedChunks() {
    const currentOrders = new Set(this.chunks.map((chunk) => chunk.order));
    const deleted = [];

    this.serverVersionsByOrder.forEach((version, order) => {
      if (!currentOrders.has(order)) {
        deleted.push({ order, version });
      }
    });

    this.forcedDeletedOrders.forEach((order) => {
      if (!currentOrders.has(order)) {
        deleted.push({ order, version: undefined });
      }
    });

    return deleted.sort((a, b) => a.order - b.order);
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
    this.serverVersionsByOrder.set(order, newVersion);
    this.forcedDeletedOrders.delete(order);
  }

  markChunkDeleted(order) {
    this.serverVersionsByOrder.delete(order);
    this.forcedDeletedOrders.delete(order);
  }

  // Used after conflict resolution to force-save without version check
  clearChunkVersion(order) {
    const chunk = this.chunks.find((it) => it.order === order);
    if (chunk) {
      chunk.version = undefined;
    } else {
      this.forcedDeletedOrders.add(order);
    }
    this.serverVersionsByOrder.delete(order);
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

    // Keep the version of the chunk where the edit started. The server uses
    // this value to reject a save when another tab changed the same chunk.
    const version = this.chunks[startIndex].version;

    this.chunks.splice(
      startIndex,
      endIndex - startIndex + 1,
      {
        order: this.chunks[startIndex].order,
        content: merged,
        dirty: true,
        version,
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
          version: this.serverVersionsByOrder.get(order),
        });
        order++;
        continue;
      }

      let remaining = chunk.content;

      while (remaining.length > HARD_LIMIT) {
        const splitAt = findParagraphSplitPoint(remaining, HARD_LIMIT);
        rebuilt.push({
          order,
          content: remaining.slice(0, splitAt),
          dirty: true,
          version: this.serverVersionsByOrder.get(order),
        });
        remaining = remaining.slice(splitAt);
        order++;
      }

      if (remaining.length > 0) {
        rebuilt.push({
          order,
          content: remaining,
          dirty: true,
          version: this.serverVersionsByOrder.get(order),
        });
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
