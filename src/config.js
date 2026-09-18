import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const resolveOutputPath = (rawPath) => {
  if (!rawPath) {
    return path.resolve(process.cwd(), 'public/tmp/altin.json');
  }
  return path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(process.cwd(), rawPath);
};

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  outputPath: resolveOutputPath(process.env.OUTPUT_PATH),
  flushIntervalMs: Math.max(100, parseInt(process.env.FLUSH_INTERVAL_MS || process.env.POLL_INTERVAL_MS, 10) || 1000),
  socket: {
    url: process.env.SOCKET_URL || 'wss://hrmsocketonly.haremaltin.com',
    path: process.env.SOCKET_PATH || '/socket.io',
    origin: process.env.SOCKET_ORIGIN || 'https://www.haremaltin.com',
    userAgent: process.env.SOCKET_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15'
  }
};
