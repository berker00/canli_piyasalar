import path from 'node:path';
import os from 'node:os';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

/**
 * Resolves output file path (relative or absolute).
 */
const resolveOutputPath = (rawPath) => {
  if (!rawPath) {
    return path.resolve(process.cwd(), 'public/tmp/altin.json');
  }
  return path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);
};

/**
 * Dynamically detects the host OS, architecture, and environment
 * to generate a modern, realistic, and compatible browser User-Agent string.
 * Falls back to custom SOCKET_USER_AGENT if specified in .env.
 *
 * @param {string} [customAgent]
 * @returns {string}
 */
export function resolveUserAgent(customAgent) {
  if (customAgent && customAgent.trim() !== '') {
    return customAgent.trim();
  }

  const platform = os.platform(); // 'darwin', 'linux', 'win32', etc.
  const arch = os.arch();         // 'x64', 'arm64', etc.

  // 1. macOS (Darwin) - Apple Silicon / Intel
  if (platform === 'darwin') {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  }

  // 2. Windows 10 / 11
  if (platform === 'win32') {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  }

  // 3. Linux (Ubuntu, Debian, CentOS, Alpine, Raspberry Pi / ARM)
  if (platform === 'linux') {
    if (arch === 'arm64' || arch === 'aarch64') {
      return 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    }
    return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
  }

  // Universal Fallback
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  outputPath: resolveOutputPath(process.env.OUTPUT_PATH),
  flushIntervalMs: Math.max(100, parseInt(process.env.FLUSH_INTERVAL_MS || process.env.POLL_INTERVAL_MS, 10) || 1000),
  system: {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release()
  },
  socket: {
    url: process.env.SOCKET_URL || 'wss://hrmsocketonly.haremaltin.com',
    path: process.env.SOCKET_PATH || '/socket.io',
    origin: process.env.SOCKET_ORIGIN || 'https://www.haremaltin.com',
    userAgent: resolveUserAgent(process.env.SOCKET_USER_AGENT)
  }
};
