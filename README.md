<div align="center">

# 📊 Canlı Piyasalar — Gerçek Zamanlı Altın & Döviz Veri Toplayıcı ve API

<p align="center">
  <strong>Node.js tabanlı, yüksek performanslı In-Memory Cache, Server-Sent Events (SSE) ve Atomik Dosya Yazma mimarisine sahip açık kaynaklı finansal piyasa veri akış servisi.</strong>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/berker00/canli_piyasalar/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/berker00/canli_piyasalar?style=social)](https://github.com/berker00/canli_piyasalar)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/berker00/canli_piyasalar)

[Canlı Demo](#-canlı-web-paneli--ekran-görüntüsü) • [Özellikler](#-öne-çıkan-özellikler) • [Hızlı Başlangıç](#-hızlı-başlangıç) • [API Uç Noktaları](#-api-kullanımı) • [Katkıda Bulunma](#-katkıda-bulunma-ve-geliştirme) • [Yasal Uyarı](#-yasal-uyarı--iyi-niyet-beyanı)

</div>

---

## 🔍 SEO & Proje Hakkında

Bu proje; Türkiye serbest piyasa ve Kapalıçarşı canlı altın fiyatları (Gram Altın, Çeyrek Altın, Has Altın, Ons, Ata Lira, 22 Ayar Bilezik), serbest piyasa döviz kurları (USD/TRY, EUR/TRY, GBP/TRY vb.) ve kıymetli maden (Gümüş, Platin, Paladyum) fiyatlarını gerçek zamanlı WebSocket üzerinden toplayan, verileri **RAM üzerinde sıfır gecikmeyle (in-memory)** işleyen, **Server-Sent Events (SSE)** ile istemcilere push eden ve **Atomik Dosya Sistemi (Atomic Write)** ile bozulma korumalı JSON çıktısı üreten modern bir Node.js mikro servisidir.

> **Anahtar Kelimeler (Keywords):** `canlı altın fiyatları api`, `serbest piyasa döviz api`, `kapalıçarşı canlı altın`, `nodejs realtime price collector`, `socket.io client streaming`, `financial data sse api`, `gram altin api`, `ceyrek altin anlik fiyat`, `open source finance ticker`.

---

## 🌟 Öne Çıkan Özellikler

- ⚡ **Sıfır Gecikmeli In-Memory API:** Gelen fiyat paketleri doğrudan RAM havuzunda birleştirilir. `/api/altin` istekleri diske uğramadan mikrosaniye hızında yanıtlanır.
- 📡 **Server-Sent Events (SSE) Canlı Akış:** `/api/stream` endpoint'i ile React, Vue, Flutter, Next.js, mobil ve masaüstü uygulamalarınıza anlık fiyat hareketleri canlı push edilir (Polling gerekmez).
- ⭐ **Yerel Favoriler Sistemi (LocalStorage):** Kullanıcılar ilgilendikleri kurları yıldızlayarak favorilerine ekleyebilir ve "Favoriler" sekmesinden kolayca filtreleyebilir.
- 🏷️ **Gelişmiş Kategori Filtreleme:** Altın, Döviz, Ziynet & Sikke, Gümüş & Emtia ve Arama çubuğu ile anında filtreleme.
- 🛡️ **Atomik Dosya Yazma (Atomic Write & Throttling):** Fiyatlar saniyede onlarca kez güncellense bile disk I/O darboğazını önlemek için saniyede en fazla 1 kez yazılır. Veri önce geçici `.tmp` dosyasına yazılıp `fs.rename` ile taşındığı için yarım veya bozuk JSON oluşması imkansızdır.
- 📱 **Mobil Uyumlu Modern Arayüz (Dark Mode):** Atlas Software temalı, dokunmatik uyumlu, fiyat artış/azalışlarında yeşil/kırmızı canlı animasyonlu modern kullanıcı paneli.
- 🩺 **Health Check & Telemetri:** `/health` uç noktası üzerinden soket bağlantı durumu, uptime, RAM kullanımı ve disk flush metrikleri.
- 🛑 **Graceful Shutdown & Dayanıklılık:** `SIGINT` / `SIGTERM` sinyallerinde askıda bekleyen veri diske flush edilir ve bağlantılar güvenle sonlandırılır.

---

## 🏗️ Mimari Şema

```text
 ┌─────────────────────────────────────────────────────────┐
 │               Canlı WebSocket Veri Akışı                │
 └────────────────────────────┬────────────────────────────┘
                              │ (Auto-reconnect & Headers)
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │               HaremSocketClient (Socket.IO)             │
 └────────────────────────────┬────────────────────────────┘
                              │ Wildcard onAny & Parse
                              ▼
 ┌─────────────────────────────────────────────────────────┐
 │                 RateStore (In-Memory RAM)               │
 │  - Merged State (Active Symbols)                        │
 │  - EventEmitter (Instant Broadcast)                     │
 └─────────────┬───────────────────────────┬───────────────┘
               │                           │
  (1000ms Throttled Flush)      (Synchronous Push Events)
               ▼                           ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │ Atomic File System Writer │ │ Server-Sent Events (SSE)  │
 │ (temp.json -> rename)     │ │ Endpoint: /api/stream     │
 └─────────────┬─────────────┘ └───────────┬───────────────┘
               ▼                           ▼
 ┌───────────────────────────┐ ┌───────────────────────────┐
 │ Static: /tmp/altin.json   │ │ Web Dashboard & Mobile UI │
 │ API: /api/altin           │ │ React / Vue / Flutter Apps│
 └───────────────────────────┘ └───────────────────────────┘
```

---

## 📁 Proje Dizin Yapısı

```text
canli_piyasalar/
├── .env                  # Çalışma ortam değişkenleri
├── .env.example          # Ortam değişkenleri şablonu
├── ecosystem.config.cjs  # PM2 Production konfigürasyonu
├── package.json          # Proje bağımlılıkları ve scriptler
├── server.js             # Ana sunucu başlatıcı (Entry Point)
├── LICENSE               # MIT Açık Kaynak Lisansı
├── DISCLAIMER.md         # Yasal Uyarı & Adil Kullanım Beyanı
├── README.md             # Dokümantasyon ve SEO
├── public/
│   ├── assets/
│   │   ├── logo.png      # Atlas Software PNG logosu
│   │   └── logo.svg      # Atlas Software Vektörel SVG logo
│   └── tmp/
│       └── altin.json    # Atomik güncellenen yerel JSON dosyası
└── src/
    ├── app.js            # Express REST API, SSE & Dashboard UI
    ├── config.js         # Çevresel değişken yönetimi
    ├── socket.js         # WebSocket istemcisi & hata yönetimi
    └── store.js          # In-Memory Store & EventEmitter & Throttler
```

---

## 🚀 Hızlı Başlangıç

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/berker00/canli_piyasalar.git
cd canli_piyasalar
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Ortam Değişkenlerini Tanımlayın
```bash
cp .env.example .env
```

`.env` dosya ayarları:
```env
PORT=3000
OUTPUT_PATH=./public/tmp/altin.json
FLUSH_INTERVAL_MS=1000
```

### 4. Sunucuyu Başlatın
- **Geliştirme Modu (İzleme / Watch):**
  ```bash
  npm run dev
  ```
- **Canlı Mod (Production):**
  ```bash
  npm start
  ```

Tarayıcınızda **[http://localhost:3000](http://localhost:3000)** adresine giderek canlı piyasa panelini açabilirsiniz.

---

## 📡 API Kullanımı

### 1. Anlık Fiyatlar (In-Memory JSON API)
Tüm aktif kurların son halini disk gecikmesi olmadan bellekten döner:
```http
GET /api/altin
```

### 2. Tekil Kur Sorgusu
Belirli bir sembole ait fiyat detayını döner:
```http
GET /api/altin/ALTIN
GET /api/altin/USDTRY
GET /api/altin/CEYREK_YENI
```

### 3. Server-Sent Events (SSE) Canlı Veri Akışı
Tüm fiyat hareketlerini canlı olarak dinlemek için:
```http
GET /api/stream
```

**JavaScript / Frontend Entegrasyon Örneği:**
```javascript
const stream = new EventSource('http://localhost:3000/api/stream');

stream.addEventListener('initial', (e) => {
  const snapshot = JSON.parse(e.data);
  console.log('Başlangıç kurları:', snapshot.data);
});

stream.addEventListener('update', (e) => {
  const payload = JSON.parse(e.data);
  console.log('Değişen kurlar:', payload.changes || payload.data);
});
```

### 4. Statik Atomik JSON Dosyası
Diske atomik olarak yazılan dosya çıktısı:
```http
GET /tmp/altin.json
```

### 5. Sistem Sağlık & Telemetri Kontrolü
```http
GET /health
```

---

## 🏭 Production (PM2 & Systemd) Dağıtımı

### PM2 ile Arka Planda Kesintisiz Çalıştırma:
```bash
# PM2 ile başlatın
pm2 start ecosystem.config.cjs

# Logları canlı takip edin
pm2 logs haremaltin-collector

# Sistem açılışında otomatik başlama
pm2 startup
pm2 save
```

---

## 🤝 Katkıda Bulunma ve Geliştirme

Bu proje **açık kaynaklıdır** ve topluluk katkılarına açıktır! Fikirlerinizi, hata bildirimlerinizi ve yeni özelliklerinizi bekliyoruz:

1. Bu depoyu Fork edin (`Fork` butonuna basın).
2. Yeni bir özellik dalı oluşturun (`git checkout -b feature/harika-ozellik`).
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Yeni özellik eklendi'`).
4. Dalınıza push yapın (`git push origin feature/harika-ozellik`).
5. Bir **Pull Request (PR)** açın.

🔗 **GitHub Depomuz:** [https://github.com/berker00/canli_piyasalar](https://github.com/berker00/canli_piyasalar)

---

## ⚖️ Yasal Uyarı & İyi Niyet Beyanı

Bu proje eğitim, araştırma, veri mimarisi demonstrasyonu ve kişisel geliştirme amacıyla hazırlanmıştır. Ticari bir finansal veri lisanslama hizmeti değildir. Sunulan veriler yatırım tavsiyesi içermez. Detaylı bilgi için [DISCLAIMER.md](DISCLAIMER.md) dosyasını inceleyiniz.

---

## 👨‍💻 Geliştirici & İletişim

- **Geliştirici:** Atlas Software
- **E-Posta:** [berker9@icloud.com](mailto:berker9@icloud.com)
- **GitHub:** [@berker00](https://github.com/berker00)
- **Depo:** [https://github.com/berker00/canli_piyasalar](https://github.com/berker00/canli_piyasalar)

---

<div align="center">
  <sub>MIT Lisansı ile korunmaktadır. © 2026 Atlas Software.</sub>
</div>
