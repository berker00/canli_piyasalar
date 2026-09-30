import { config } from '../src/config.js';
import { RateStore } from '../src/store.js';
import { HaremSocketClient } from '../src/socket.js';
import { createApp } from '../src/app.js';

// Singleton instances preserved across warm serverless container invocations
let appInstance = null;
let storeInstance = null;
let socketClientInstance = null;

function getApp() {
  if (!appInstance) {
    storeInstance = new RateStore({
      outputPath: config.outputPath,
      flushIntervalMs: config.flushIntervalMs
    });

    socketClientInstance = new HaremSocketClient(config.socket, storeInstance);
    socketClientInstance.connect();

    appInstance = createApp(config, storeInstance, socketClientInstance);
  }
  return { app: appInstance, store: storeInstance };
}

export default async function handler(req, res) {
  const { app, store } = getApp();

  // On cold start, wait for initial socket rates to arrive
  if (store && Object.keys(store.currentRates || {}).length === 0 && store.waitForData) {
    try {
      await store.waitForData(2500);
    } catch {
      // Continue anyway
    }
  }

  return app(req, res);
}
