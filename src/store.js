import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';

/**
 * Thread-safe / Event-loop safe in-memory rate store with atomic disk persistence
 * and EventEmitter for real-time live streaming (SSE / WebSockets).
 */
export class RateStore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.outputPath = options.outputPath;
    this.flushIntervalMs = options.flushIntervalMs || 1000;

    // In-memory rate state
    this.currentRates = {};
    this.lastUpdatedAt = null;
    this.lastFlushedAt = null;
    this.isDirty = false;
    this.isWriting = false;

    // Telemetry & metrics
    this.metrics = {
      totalEventsReceived: 0,
      totalItemsUpdated: 0,
      totalDiskFlushes: 0,
      totalDiskFlushErrors: 0,
      startedAt: new Date().toISOString()
    };

    // Ensure output directory exists and start background flush loop
    this.initOutputDir();
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  /**
   * Ensures the target directory for atomic JSON output exists.
   */
  async initOutputDir() {
    try {
      const dir = path.dirname(this.outputPath);
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      console.error(`[RateStore] Error creating directory for ${this.outputPath}:`, err.message);
    }
  }

  /**
   * Ingests and merges incoming socket payloads into in-memory state.
   * Emits 'rates_updated' event to notify all real-time listeners (SSE, etc.) synchronously.
   *
   * @param {string} eventName
   * @param {any} payload
   */
  update(eventName, payload) {
    if (!payload) return;

    this.metrics.totalEventsReceived++;
    let dataToMerge = null;

    // Handle parsed or unparsed payloads
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return;
      }
    }

    if (payload && typeof payload === 'object') {
      if (payload.data && typeof payload.data === 'object') {
        dataToMerge = payload.data;
      } else if (!payload.meta && !payload.event) {
        dataToMerge = payload;
      }
    }

    if (!dataToMerge) return;

    let updatedCount = 0;
    const changedEntries = {};

    // If dataToMerge is an array of items
    if (Array.isArray(dataToMerge)) {
      for (const item of dataToMerge) {
        const code = item?.code || item?.kod || item?.id;
        if (code) {
          this.currentRates[code] = {
            ...(this.currentRates[code] || {}),
            ...item
          };
          changedEntries[code] = this.currentRates[code];
          updatedCount++;
        }
      }
    } else if (typeof dataToMerge === 'object') {
      // If dataToMerge is an object of key-values { "ALTIN": { ... }, "USDTRY": { ... } }
      for (const [key, val] of Object.entries(dataToMerge)) {
        if (val && typeof val === 'object') {
          this.currentRates[key] = {
            ...(this.currentRates[key] || {}),
            ...val
          };
          changedEntries[key] = this.currentRates[key];
          updatedCount++;
        } else if (val !== undefined && val !== null) {
          this.currentRates[key] = val;
          changedEntries[key] = val;
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      this.lastUpdatedAt = new Date().toISOString();
      this.isDirty = true;
      this.metrics.totalItemsUpdated += updatedCount;

      // Broadcast immediately to all real-time subscribers (Synchronous push)
      this.emit('rates_updated', {
        last_updated_at: this.lastUpdatedAt,
        total_items: Object.keys(this.currentRates).length,
        data: this.currentRates,
        changes: changedEntries
      });
    }
  }

  /**
   * Atomically flushes in-memory rates to disk.
   * Uses write-to-temp-file and atomic rename (fs.rename) to prevent race conditions or corrupted JSON.
   */
  async flush() {
    if (!this.isDirty || this.isWriting) {
      return;
    }

    this.isWriting = true;
    const tempFile = `${this.outputPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;

    try {
      const payload = {
        last_updated_at: this.lastUpdatedAt || new Date().toISOString(),
        total_items: Object.keys(this.currentRates).length,
        data: this.currentRates
      };

      const jsonString = JSON.stringify(payload, null, 2);

      // 1. Write to temporary file
      await fs.writeFile(tempFile, jsonString, 'utf-8');

      // 2. Atomic rename over destination file
      await fs.rename(tempFile, this.outputPath);

      this.isDirty = false;
      this.lastFlushedAt = new Date().toISOString();
      this.metrics.totalDiskFlushes++;
    } catch (err) {
      this.metrics.totalDiskFlushErrors++;
      console.error('[RateStore] Atomic disk write failed:', err.message);

      // Clean up orphaned temp file if exists
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore unlink error
      }
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Returns a snapshot of current in-memory rates for instant HTTP response.
   */
  getState() {
    return {
      last_updated_at: this.lastUpdatedAt,
      total_items: Object.keys(this.currentRates).length,
      data: this.currentRates
    };
  }

  /**
   * Returns current internal store metrics.
   */
  getMetrics() {
    return {
      ...this.metrics,
      lastUpdatedAt: this.lastUpdatedAt,
      lastFlushedAt: this.lastFlushedAt,
      isDirty: this.isDirty,
      activeItemCount: Object.keys(this.currentRates).length
    };
  }

  /**
   * Graceful cleanup: stop timer and perform final flush.
   */
  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}
