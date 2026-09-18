module.exports = {
  apps: [
    {
      name: 'haremaltin-collector',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        OUTPUT_PATH: './public/tmp/altin.json',
        FLUSH_INTERVAL_MS: 1000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
