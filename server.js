import { config } from './src/config.js';
import { RateStore } from './src/store.js';
import { HaremSocketClient } from './src/socket.js';
import { createApp } from './src/app.js';

// Global Process Error Handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

async function main() {
  console.log('====================================================');
  console.log('    Atlas Realtime Price Collector & API Server     ');
  console.log('====================================================');
  console.log(`Port:           ${config.port}`);
  console.log(`Output Path:    ${config.outputPath}`);
  console.log(`Flush Interval: ${config.flushIntervalMs}ms`);
  console.log(`Socket Target:  ${config.socket.url}`);
  console.log('----------------------------------------------------');

  // 1. Initialize In-Memory Rate Store with Throttled Atomic Disk Flush
  const store = new RateStore({
    outputPath: config.outputPath,
    flushIntervalMs: config.flushIntervalMs
  });

  // 2. Initialize Socket.IO Client for Harem Altin
  const socketClient = new HaremSocketClient(config.socket, store);
  socketClient.connect();

  // 3. Initialize Express Application
  const app = createApp(config, store, socketClient);

  // 4. Start HTTP Server
  const server = app.listen(config.port, () => {
    console.log(`[HTTP Server] Listening on http://localhost:${config.port}`);
    console.log(`[HTTP Server] In-Memory API: http://localhost:${config.port}/api/altin`);
    console.log(`[HTTP Server] Static File:   http://localhost:${config.port}/tmp/altin.json`);
    console.log(`[HTTP Server] Health Check:  http://localhost:${config.port}/health`);
    console.log('----------------------------------------------------');
  });

  // Graceful Shutdown Logic
  let isShuttingDown = false;
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

    // 1. Disconnect Socket
    try {
      socketClient.disconnect();
    } catch (e) {
      console.error('[Shutdown] Error disconnecting socket:', e.message);
    }

    // 2. Flush pending store data to disk
    try {
      console.log('[Shutdown] Flushing latest rates to disk...');
      await store.stop();
      console.log('[Shutdown] Disk flush completed.');
    } catch (e) {
      console.error('[Shutdown] Error during final flush:', e.message);
    }

    // 3. Close HTTP Server
    server.close(() => {
      console.log('[Shutdown] HTTP server closed. Process exiting cleanly.');
      process.exit(0);
    });

    // Force exit if hanging
    setTimeout(() => {
      console.warn('[Shutdown] Forcefully terminating process after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Bootstrap Error]:', err);
  process.exit(1);
});
