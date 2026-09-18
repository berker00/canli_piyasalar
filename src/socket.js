import { io } from 'socket.io-client';

/**
 * Manages WebSocket connection to Harem Altın real-time price feed.
 */
export class HaremSocketClient {
  /**
   * @param {object} socketConfig
   * @param {import('./store.js').RateStore} store
   */
  constructor(socketConfig, store) {
    this.config = socketConfig;
    this.store = store;
    this.socket = null;
    this.status = {
      connected: false,
      socketId: null,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      disconnectReason: null,
      reconnectAttempts: 0,
      lastError: null,
      lastErrorAt: null
    };
  }

  /**
   * Initializes and establishes connection to the Socket.IO server.
   */
  connect() {
    console.log(`[HaremSocket] Initializing connection to ${this.config.url}...`);

    this.socket = io(this.config.url, {
      path: this.config.path || '/socket.io',
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 20000,
      extraHeaders: {
        'Origin': this.config.origin,
        'User-Agent': this.config.userAgent
      }
    });

    this.registerEventHandlers();
  }

  /**
   * Registers lifecycle and wildcard event handlers.
   */
  registerEventHandlers() {
    const socket = this.socket;

    // Successful connection
    socket.on('connect', () => {
      this.status.connected = true;
      this.status.socketId = socket.id;
      this.status.lastConnectedAt = new Date().toISOString();
      this.status.disconnectReason = null;
      this.status.reconnectAttempts = 0;
      console.log(`[HaremSocket] Connected successfully. Socket ID: ${socket.id}`);
    });

    // Disconnection event
    socket.on('disconnect', (reason) => {
      this.status.connected = false;
      this.status.lastDisconnectedAt = new Date().toISOString();
      this.status.disconnectReason = reason;
      console.warn(`[HaremSocket] Disconnected. Reason: ${reason}`);

      // If disconnected by server, automatically re-attempt connection
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    // Connection error event
    socket.on('connect_error', (error) => {
      this.status.connected = false;
      this.status.lastError = error.message;
      this.status.lastErrorAt = new Date().toISOString();
      console.error(`[HaremSocket] Connection Error: ${error.message}`);
    });

    // Reconnection attempt event
    socket.io.on('reconnect_attempt', (attempt) => {
      this.status.reconnectAttempts = attempt;
      console.log(`[HaremSocket] Reconnection attempt #${attempt}...`);
    });

    // Reconnected event
    socket.io.on('reconnect', (attempt) => {
      console.log(`[HaremSocket] Reconnected successfully after ${attempt} attempts.`);
    });

    // Reconnection failed
    socket.io.on('reconnect_failed', () => {
      console.error('[HaremSocket] Reconnection failed permanently.');
    });

    // Catch all incoming event messages (wildcard)
    socket.onAny((eventName, ...args) => {
      try {
        const payload = args.length > 0 ? args[0] : null;
        this.store.update(eventName, payload);
      } catch (err) {
        console.error(`[HaremSocket] Error processing event "${eventName}":`, err.message);
      }
    });
  }

  /**
   * Returns current socket status for health check endpoint.
   */
  getStatus() {
    return {
      connected: this.status.connected,
      socketId: this.status.socketId,
      lastConnectedAt: this.status.lastConnectedAt,
      lastDisconnectedAt: this.status.lastDisconnectedAt,
      disconnectReason: this.status.disconnectReason,
      reconnectAttempts: this.status.reconnectAttempts,
      lastError: this.status.lastError,
      lastErrorAt: this.status.lastErrorAt
    };
  }

  /**
   * Disconnects the socket gracefully.
   */
  disconnect() {
    if (this.socket) {
      console.log('[HaremSocket] Closing socket connection...');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.status.connected = false;
    }
  }
}
