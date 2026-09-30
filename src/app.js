import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Creates and configures Express application with Realtime SSE and In-Memory Sync.
 *
 * @param {import('./config.js').config} config
 * @param {import('./store.js').RateStore} store
 * @param {import('./socket.js').HaremSocketClient} socketClient
 */
export function createApp(config, store, socketClient) {
  const app = express();

  // Global Middlewares
  app.use(cors());
  app.use(express.json());

  // Prevent caching for all dynamic and JSON routes
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  const publicDir = path.resolve(process.cwd(), 'public');
  const outputDir = path.dirname(config.outputPath);

  // Serve static assets from public folder
  app.use(express.static(publicDir));
  app.use('/assets', express.static(path.join(publicDir, 'assets')));
  app.use('/tmp', express.static(outputDir));

  /**
   * Synchronous /tmp/altin.json endpoint
   */
  app.get(['/tmp/altin.json', '/altin.json'], async (req, res) => {
    let state = store.getState();
    if (state.total_items === 0 && store.waitForData) {
      state = await store.waitForData(3500);
    }

    if (state.total_items > 0) {
      return res.status(200).json(state);
    }

    if (fs.existsSync(config.outputPath)) {
      return res.sendFile(config.outputPath);
    }

    return res.status(503).json({
      error: 'Data is being collected. Please retry in 1 second.'
    });
  });

  /**
   * Fast In-Memory API Endpoint
   */
  app.get('/api/altin', async (req, res) => {
    let state = store.getState();
    if (state.total_items === 0 && store.waitForData) {
      state = await store.waitForData(3500);
    }
    return res.status(200).json(state);
  });

  /**
   * Single symbol query endpoint
   */
  app.get('/api/altin/:code', async (req, res) => {
    const code = req.params.code?.toUpperCase();
    let state = store.getState();
    if (state.total_items === 0 && store.waitForData) {
      state = await store.waitForData(3500);
    }
    const item = state.data?.[code];

    if (!item) {
      return res.status(404).json({
        error: `Symbol "${code}" not found.`,
        available_symbols: Object.keys(state.data || {})
      });
    }

    return res.status(200).json({
      last_updated_at: state.last_updated_at,
      symbol: code,
      data: item
    });
  });

  /**
   * ⚡ Real-Time Server-Sent Events (SSE) Live Stream Endpoint
   */
  app.get(['/api/stream', '/api/altin/stream', '/events'], async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    let initialState = store.getState();
    if (initialState.total_items === 0 && store.waitForData) {
      initialState = await store.waitForData(3500);
    }
    res.write(`event: initial\ndata: ${JSON.stringify(initialState)}\n\n`);

    const onRatesUpdated = (updateData) => {
      res.write(`event: update\ndata: ${JSON.stringify(updateData)}\n\n`);
    };

    store.on('rates_updated', onRatesUpdated);

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      store.removeListener('rates_updated', onRatesUpdated);
      res.end();
    });
  });

  /**
   * Health Check & Diagnostics Endpoint
   */
  app.get('/health', (req, res) => {
    const socketStatus = socketClient.getStatus();
    const storeMetrics = store.getMetrics();
    const isHealthy = socketStatus.connected && storeMetrics.activeItemCount > 0;

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      socket: socketStatus,
      store: storeMetrics,
      memory: {
        rss_mb: (process.memoryUsage().rss / (1024 * 1024)).toFixed(2),
        heap_used_mb: (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)
      },
      endpoints: {
        memory_api: '/api/altin',
        stream_sse: '/api/stream',
        static_file: '/tmp/altin.json',
        health: '/health'
      }
    };

    return res.status(isHealthy ? 200 : 503).json(healthData);
  });

  /**
   * 🖥️ Canlı Otomatik Senkronize Web Arayüzü (Favorites + Atlas Software PNG Logo + GitHub Link)
   */
  app.get(['/', '/live'], (req, res) => {
    if (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html')) {
      return res.json(store.getState());
    }

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Atlas Gold - Canlı Piyasa & Fiyat Takip</title>
  <meta name="description" content="Canlı altın, döviz ve emtia fiyatları takip platformu. Açık kaynak kodlu, anlık WebSocket ve SSE akışlı piyasa takip sistemi.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --bg-gradient: radial-gradient(circle at 50% 0%, #172033 0%, #0b0f19 75%);
      --card-bg: rgba(18, 26, 43, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-hover: rgba(255, 255, 255, 0.18);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --gold: #f59e0b;
      --gold-glow: rgba(245, 158, 11, 0.25);
      --green: #10b981;
      --green-bg: rgba(16, 185, 129, 0.18);
      --red: #ef4444;
      --red-bg: rgba(239, 68, 68, 0.18);
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.3);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      background-image: var(--bg-gradient);
      background-attachment: fixed;
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 16px 12px;
      line-height: 1.5;
    }
    .container {
      width: 100%;
      max-width: 1320px;
      margin: 0 auto;
      flex: 1;
    }

    /* HEADER */
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 18px 24px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      margin-bottom: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.36);
    }
    .brand-link {
      display: flex;
      align-items: center;
      text-decoration: none;
      transition: transform 0.2s, opacity 0.2s;
    }
    .brand-link:hover { transform: scale(1.02); opacity: 0.95; }
    .brand-logo {
      height: 44px;
      width: auto;
      max-width: 170px;
      object-fit: contain;
    }
    .header-center {
      text-align: center;
    }
    .header-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.3px;
      background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      padding: 8px 14px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }
    .dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* FILTERS & CATEGORIES */
    .controls-panel {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 14px 18px;
      margin-bottom: 20px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .filter-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .filter-tabs::-webkit-scrollbar { display: none; }
    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .tab-btn:hover {
      background: rgba(255, 255, 255, 0.09);
      color: #fff;
    }
    .tab-btn.active {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      border-color: #3b82f6;
      box-shadow: 0 4px 16px var(--primary-glow);
    }
    .tab-btn.active-fav {
      background: linear-gradient(135deg, #d97706, #b45309) !important;
      border-color: #f59e0b !important;
      box-shadow: 0 4px 16px var(--gold-glow) !important;
    }
    .tab-badge {
      background: rgba(0, 0, 0, 0.35);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 800;
    }

    .toolbar-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .search-box {
      flex: 1;
      min-width: 240px;
      position: relative;
    }
    .search-box input {
      width: 100%;
      padding: 11px 16px 11px 40px;
      background: rgba(11, 15, 25, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      color: #fff;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .search-box input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }
    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
      font-size: 14px;
    }
    .stats-info {
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    /* GRID & CARDS */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 16px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s, box-shadow 0.2s;
      position: relative;
      overflow: hidden;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: var(--card-hover);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .symbol-badge {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .symbol-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.06);
    }
    .code {
      font-weight: 800;
      font-size: 16px;
      letter-spacing: 0.3px;
      color: #fff;
    }
    .card-top-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .time {
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    .fav-btn {
      background: transparent;
      border: none;
      font-size: 17px;
      cursor: pointer;
      color: #64748b;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 6px;
    }
    .fav-btn:hover {
      transform: scale(1.25);
      color: #f59e0b;
    }
    .fav-btn.active {
      color: #f59e0b;
      text-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
    }
    .rates {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .rate-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.04);
      padding: 10px 8px;
      border-radius: 12px;
      text-align: center;
      transition: background-color 0.4s, border-color 0.4s;
    }
    .rate-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .rate-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
      letter-spacing: -0.2px;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.03);
    }

    /* FLASH ANIMATIONS */
    .flash-up { animation: flashGreen 1s ease-out; }
    .flash-down { animation: flashRed 1s ease-out; }
    @keyframes flashGreen {
      0% { background: var(--green-bg); border-color: rgba(16, 185, 129, 0.6); }
      100% { background: rgba(0, 0, 0, 0.35); border-color: rgba(255, 255, 255, 0.04); }
    }
    @keyframes flashRed {
      0% { background: var(--red-bg); border-color: rgba(239, 68, 68, 0.6); }
      100% { background: rgba(0, 0, 0, 0.35); border-color: rgba(255, 255, 255, 0.04); }
    }

    /* EMPTY FAVORITES STATE */
    .empty-state {
      grid-column: 1 / -1;
      padding: 60px 24px;
      text-align: center;
      background: var(--card-bg);
      border-radius: 16px;
      border: 1px dashed var(--card-border);
      display: none;
    }
    .empty-state-icon { font-size: 40px; margin-bottom: 12px; }
    .empty-state-title { font-size: 17px; font-weight: 700; margin-bottom: 6px; color: #f8fafc; }
    .empty-state-desc { font-size: 13px; color: var(--text-muted); max-width: 440px; margin: 0 auto; }

    /* FOOTER */
    footer {
      margin-top: auto;
      padding: 28px 16px 20px;
      border-top: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      text-align: center;
    }
    .footer-powered {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
    }
    .footer-logo-link {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      text-decoration: none;
    }
    .footer-logo-link:hover {
      background: rgba(255, 255, 255, 0.09);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .footer-logo {
      height: 30px;
      width: auto;
      max-width: 125px;
      object-fit: contain;
    }
    .footer-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 16px;
      font-size: 13px;
    }
    .github-badge-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      color: #f1f5f9;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    .github-badge-link:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: #3b82f6;
      color: #60a5fa;
      transform: translateY(-1px);
    }
    .github-icon {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .footer-contact {
      font-size: 12px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
    }
    .footer-contact a {
      color: #94a3b8;
      text-decoration: none;
      transition: color 0.2s;
    }
    .footer-contact a:hover {
      color: var(--primary);
    }

    /* RESPONSIVE BREAKPOINTS */
    @media (max-width: 768px) {
      body { padding: 12px 8px; }
      header {
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 16px 14px;
        gap: 12px;
      }
      .brand-logo { height: 38px; }
      .header-title { font-size: 18px; }
      .controls-panel { padding: 12px; border-radius: 14px; }
      .grid { grid-template-columns: 1fr; gap: 12px; }
      .tab-btn { padding: 8px 14px; font-size: 12px; }
      .rate-val { font-size: 15px; }
      .footer-links { flex-direction: column; gap: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <header>
      <a href="mailto:berker9@icloud.com" class="brand-link" title="Atlas Software İletişim">
        <img src="/assets/logo.png" alt="Atlas Software" class="brand-logo">
      </a>

      <div class="header-center">
        <h1 class="header-title">Canlı Piyasa Fiyatları</h1>
        <p class="header-subtitle">Anlık Senkronize Altın, Döviz & Emtia Takip Ekranı</p>
      </div>

      <div class="header-actions">
        <div class="status-badge" id="statusBadge">
          <div class="dot"></div>
          <span id="statusText">Canlı Senkronize</span>
        </div>
      </div>
    </header>

    <!-- FILTERS & SEARCH CONTROLS -->
    <div class="controls-panel">
      <!-- Filter Tabs -->
      <div class="filter-tabs" id="filterTabs">
        <button class="tab-btn active" data-filter="all">
          <span>🌟 Tümü</span>
          <span class="tab-badge" id="badge-all">0</span>
        </button>
        <button class="tab-btn" data-filter="favorites" id="tabFavorites">
          <span>⭐ Favoriler</span>
          <span class="tab-badge" id="badge-favorites">0</span>
        </button>
        <button class="tab-btn" data-filter="gold">
          <span>🪙 Altın</span>
          <span class="tab-badge" id="badge-gold">0</span>
        </button>
        <button class="tab-btn" data-filter="forex">
          <span>💵 Döviz</span>
          <span class="tab-badge" id="badge-forex">0</span>
        </button>
        <button class="tab-btn" data-filter="ziynet">
          <span>💍 Ziynet & Sikke</span>
          <span class="tab-badge" id="badge-ziynet">0</span>
        </button>
        <button class="tab-btn" data-filter="commodity">
          <span>🥈 Gümüş & Emtia</span>
          <span class="tab-badge" id="badge-commodity">0</span>
        </button>
      </div>

      <!-- Search and Meta -->
      <div class="toolbar-row">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" placeholder="Sembol veya kur ara (Örn: ALTIN, USDTRY, ONS, CEYREK)...">
        </div>
        <div class="stats-info" id="statsInfo">
          Son Güncelleme: <span id="lastUpdateText">-</span>
        </div>
      </div>
    </div>

    <!-- CARDS GRID -->
    <div class="grid" id="ratesGrid">
      <div class="empty-state" id="emptyFavoritesState">
        <div class="empty-state-icon">⭐</div>
        <div class="empty-state-title">Henüz Favori Eklenmedi</div>
        <div class="empty-state-desc">İlginizi çeken kurların sağ üst köşesindeki yıldız butonuna tıklayarak favorilerinize ekleyebilir ve anlık takip edebilirsiniz.</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <footer>
    <div class="footer-powered">
      <span>Powered by</span>
      <a href="mailto:berker9@icloud.com" class="footer-logo-link" title="Atlas Software İletişim: berker9@icloud.com">
        <img src="/assets/logo.png" alt="Atlas Software" class="footer-logo">
      </a>
    </div>

    <div class="footer-links">
      <a href="https://github.com/berker00/canli_piyasalar" target="_blank" rel="noopener noreferrer" class="github-badge-link" title="GitHub Deposu - Açık Kaynak & Katkıda Bulunun">
        <svg class="github-icon" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        <span>GitHub: berker00/canli_piyasalar (Açık Kaynak)</span>
      </a>
    </div>

    <div class="footer-contact">
      Açık kaynak geliştirmeye açıktır • İletişim: <a href="mailto:berker9@icloud.com">berker9@icloud.com</a>
    </div>
  </footer>

  <script>
    const ratesGrid = document.getElementById('ratesGrid');
    const searchInput = document.getElementById('searchInput');
    const statusText = document.getElementById('statusText');
    const statusBadge = document.getElementById('statusBadge');
    const lastUpdateText = document.getElementById('lastUpdateText');
    const filterTabs = document.getElementById('filterTabs');
    const emptyFavoritesState = document.getElementById('emptyFavoritesState');

    let currentFilter = 'all';
    let localRates = {};

    // Load Favorites from LocalStorage
    let favorites = new Set();
    try {
      const saved = localStorage.getItem('atlas_gold_favorites');
      if (saved) {
        favorites = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('LocalStorage favorites error:', e);
    }

    function saveFavorites() {
      try {
        localStorage.setItem('atlas_gold_favorites', JSON.stringify(Array.from(favorites)));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
      updateBadgeCounts();
    }

    function toggleFavorite(code, e) {
      if (e) e.stopPropagation();
      if (favorites.has(code)) {
        favorites.delete(code);
      } else {
        favorites.add(code);
      }
      saveFavorites();

      const btn = document.getElementById('fav-btn-' + code);
      if (btn) {
        if (favorites.has(code)) {
          btn.classList.add('active');
          btn.innerHTML = '★';
          btn.title = 'Favorilerden Çıkar';
        } else {
          btn.classList.remove('active');
          btn.innerHTML = '☆';
          btn.title = 'Favorilere Ekle';
        }
      }

      filterAllCards();
    }

    // Category Matchers
    const CATEGORIES = {
      gold: ['ALTIN', 'KULCEALTIN', 'AYAR24', 'AYAR22', 'AYAR18', 'AYAR14', 'ONS', 'XAUUSD', 'USDPURE', 'EURPURE', 'HASALTIN', 'HAS_ALTIN'],
      ziynet: ['CEYREK', 'YARIM', 'TEK', 'ATA', 'GREMSE', 'BESLI', 'RESAT', 'HAMIT', 'ZIYNET', 'CEYREK_YENI', 'CEYREK_ESKI', 'YARIM_YENI', 'YARIM_ESKI', 'TEK_YENI', 'TEK_ESKI', 'ATA_YENI', 'ATA_ESKI', 'ATA5_YENI', 'ATA5_ESKI', 'GREMSE_YENI', 'GREMSE_ESKI', 'BESLI_YENI', 'BESLI_ESKI'],
      forex: ['USDTRY', 'EURTRY', 'GBPTRY', 'CHFTRY', 'CADTRY', 'AUDTRY', 'JPYTRY', 'SARTRY', 'AEDTRY', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'USDCHF', 'AUDUSD', 'NZDUSD', 'EURGBP', 'EURCHF', 'EURJPY', 'GBPJPY', 'KWDTRY', 'QARTRY', 'SEKTRY', 'NOKTRY', 'DKKTRY', 'RUBTRY', 'CNYTRY'],
      commodity: ['GUMUS', 'GUMUSTRY', 'GUMUSUSD', 'GUMUSTL', 'XAGUSD', 'PLATIN', 'XPTUSD', 'PALADYUM', 'XPDUSD', 'BRENT']
    };

    function getItemCategory(code) {
      const c = (code || '').toUpperCase();
      if (CATEGORIES.ziynet.some(k => c.includes(k))) return 'ziynet';
      if (CATEGORIES.commodity.some(k => c.includes(k))) return 'commodity';
      if (CATEGORIES.forex.some(k => c.includes(k))) return 'forex';
      if (CATEGORIES.gold.some(k => c.includes(k))) return 'gold';
      return 'gold';
    }

    function getCategoryIcon(cat) {
      switch(cat) {
        case 'gold': return '🪙';
        case 'ziynet': return '💍';
        case 'forex': return '💵';
        case 'commodity': return '🥈';
        default: return '📊';
      }
    }

    function formatNumber(val) {
      if (val === undefined || val === null || val === '') return '-';
      return val;
    }

    function updateBadgeCounts() {
      const items = Object.keys(localRates);
      const counts = { all: items.length, favorites: favorites.size, gold: 0, forex: 0, ziynet: 0, commodity: 0 };

      items.forEach(code => {
        const cat = getItemCategory(code);
        if (counts[cat] !== undefined) counts[cat]++;
      });

      document.getElementById('badge-all').innerText = counts.all;
      document.getElementById('badge-favorites').innerText = counts.favorites;
      document.getElementById('badge-gold').innerText = counts.gold;
      document.getElementById('badge-forex').innerText = counts.forex;
      document.getElementById('badge-ziynet').innerText = counts.ziynet;
      document.getElementById('badge-commodity').innerText = counts.commodity;
    }

    function renderCard(item) {
      const code = item.code || item.kod;
      if (!code) return;

      const category = getItemCategory(code);
      let card = document.getElementById('card-' + code);
      const isNew = !card;

      if (isNew) {
        card = document.createElement('div');
        card.id = 'card-' + code;
        card.className = 'card';
        card.setAttribute('data-category', category);
        ratesGrid.appendChild(card);
      }

      const prev = localRates[code];
      let alisFlash = '';
      let satisFlash = '';

      if (prev) {
        const currAlis = parseFloat(item.alis);
        const prevAlis = parseFloat(prev.alis);
        if (!isNaN(currAlis) && !isNaN(prevAlis)) {
          if (currAlis > prevAlis) alisFlash = 'flash-up';
          else if (currAlis < prevAlis) alisFlash = 'flash-down';
        }

        const currSatis = parseFloat(item.satis);
        const prevSatis = parseFloat(prev.satis);
        if (!isNaN(currSatis) && !isNaN(prevSatis)) {
          if (currSatis > prevSatis) satisFlash = 'flash-up';
          else if (currSatis < prevSatis) satisFlash = 'flash-down';
        }
      }

      const icon = getCategoryIcon(category);
      const isFav = favorites.has(code);

      card.innerHTML = \`
        <div class="card-top">
          <div class="symbol-badge">
            <span class="symbol-icon">\${icon}</span>
            <span class="code">\${code}</span>
          </div>
          <div class="card-top-actions">
            <span class="time">\${item.tarih || new Date().toLocaleTimeString('tr-TR')}</span>
            <button class="fav-btn \${isFav ? 'active' : ''}" id="fav-btn-\${code}" onclick="toggleFavorite('\${code}', event)" title="\${isFav ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}">
              \${isFav ? '★' : '☆'}
            </button>
          </div>
        </div>
        <div class="rates">
          <div class="rate-box \${alisFlash}">
            <div class="rate-label">Alış</div>
            <div class="rate-val">\${formatNumber(item.alis)}</div>
          </div>
          <div class="rate-box \${satisFlash}">
            <div class="rate-label">Satış</div>
            <div class="rate-val">\${formatNumber(item.satis)}</div>
          </div>
        </div>
        <div class="card-footer">
          <span>D: \${formatNumber(item.dusuk)}</span>
          <span>Y: \${formatNumber(item.yuksek)}</span>
          <span>K: \${formatNumber(item.kapanis)}</span>
        </div>
      \`;

      applyFilter(card);
    }

    function applyFilter(card) {
      const query = searchInput.value.trim().toUpperCase();
      const code = card.id.replace('card-', '').toUpperCase();
      const category = card.getAttribute('data-category');

      const matchesSearch = query === '' || code.includes(query);
      let matchesCategory = false;

      if (currentFilter === 'all') {
        matchesCategory = true;
      } else if (currentFilter === 'favorites') {
        matchesCategory = favorites.has(code);
      } else {
        matchesCategory = category === currentFilter;
      }

      card.style.display = (matchesSearch && matchesCategory) ? '' : 'none';
    }

    function filterAllCards() {
      let visibleCount = 0;
      document.querySelectorAll('.card').forEach(card => {
        applyFilter(card);
        if (card.style.display !== 'none') visibleCount++;
      });

      if (currentFilter === 'favorites' && visibleCount === 0) {
        emptyFavoritesState.style.display = 'block';
      } else {
        emptyFavoritesState.style.display = 'none';
      }
    }

    // Tab click listeners
    filterTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterTabs.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.classList.remove('active-fav');
        });

        const filter = btn.getAttribute('data-filter');
        if (filter === 'favorites') {
          btn.classList.add('active-fav');
        } else {
          btn.classList.add('active');
        }

        currentFilter = filter;
        filterAllCards();
      });
    });

    searchInput.addEventListener('input', filterAllCards);

    // Connect to Server-Sent Events for instant live push updates
    const evtSource = new EventSource('/api/stream');

    evtSource.addEventListener('initial', (e) => {
      const payload = JSON.parse(e.data);
      if (payload.last_updated_at) {
        lastUpdateText.innerText = new Date(payload.last_updated_at).toLocaleTimeString('tr-TR');
      }
      if (payload.data) {
        Object.entries(payload.data).forEach(([code, item]) => {
          localRates[code] = item;
          renderCard(item);
        });
        updateBadgeCounts();
        filterAllCards();
      }
    });

    evtSource.addEventListener('update', (e) => {
      const payload = JSON.parse(e.data);
      if (payload.last_updated_at) {
        lastUpdateText.innerText = new Date(payload.last_updated_at).toLocaleTimeString('tr-TR');
      }
      const changes = payload.changes || payload.data || {};
      Object.entries(changes).forEach(([code, item]) => {
        renderCard(item);
        localRates[code] = item;
      });
      updateBadgeCounts();
    });

    evtSource.onerror = () => {
      statusText.innerText = 'Yeniden Bağlanıyor...';
      statusBadge.style.borderColor = '#ef4444';
      statusBadge.style.color = '#ef4444';
    };

    evtSource.onopen = () => {
      statusText.innerText = 'Canlı Senkronize';
      statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      statusBadge.style.color = '#34d399';
    };

    // Instant initial fetch & serverless resilience fallback
    async function fetchLatestRates() {
      try {
        const res = await fetch('/api/altin');
        if (!res.ok) return;
        const payload = await res.json();
        if (payload.last_updated_at) {
          lastUpdateText.innerText = new Date(payload.last_updated_at).toLocaleTimeString('tr-TR');
        }
        if (payload.data && Object.keys(payload.data).length > 0) {
          Object.entries(payload.data).forEach(([code, item]) => {
            localRates[code] = item;
            renderCard(item);
          });
          updateBadgeCounts();
          filterAllCards();
        }
      } catch (err) {
        // Silent catch for resilience
      }
    }

    // Call immediately on page load
    fetchLatestRates();

    // Auto-refresh fallback every 10 seconds if SSE is closed/throttled by serverless limits
    setInterval(fetchLatestRates, 10000);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  });

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
}

export default createApp;
