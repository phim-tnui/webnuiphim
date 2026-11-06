import express from 'express';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const apiApp = require('./api/index.js');
const scraper = require('./scraper.js');
const musicRouter = require('./api/music-router.js');

// Dev server must run on port 3000 per environment constraints
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  const app = express();

  // Direct download route for compiled Android APKs & GitHub.io ZIP bundle
  app.get('/apk/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'public', 'apk', safeName);
    if (fs.existsSync(filePath)) {
      const contentType = safeName.endsWith('.zip')
        ? 'application/zip'
        : 'application/vnd.android.package-archive';
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      return res.sendFile(filePath);
    }
    res.status(404).send('File not found');
  });

  // Mount all backend API and Stremio addon routes from api/index.js
  app.use(apiApp);
  app.use('/api/music', musicRouter);
  app.use('/api/auth', musicRouter);
  app.use('/api/user', musicRouter);

  const isProd = process.env.NODE_ENV === 'production' || (fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')) && !process.env.VITE_DEV);

  if (!isProd || process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Handle Stremio configure and Preview SPA routes in dev
    app.get(['/', '/preview', '/preview/*', '/configure', '/:options/configure', '/config/:options/configure'], async (req, res, next) => {
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        const template = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'frontend', 'dist', 'index.html'))
      ? path.join(process.cwd(), 'frontend', 'dist')
      : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    app.get(['/', '/preview', '/preview/*', '/configure', '/:options/configure', '/config/:options/configure'], (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Nuvio Addon React server running on http://${HOST}:${PORT}`);

    // Initialize Auraflix 30-min Auto-Crawler
    try {
      scraper.initAuraflixAutoCrawler(30);
    } catch (e: unknown) {
      console.error('Auraflix auto-crawler init error:', e instanceof Error ? e.message : String(e));
    }

    // Initialize Live TV (.mpd) Health Scheduler
    try {
      const liveTvHealth = require('./live-tv-health.js');
      liveTvHealth.initLiveTvHealthScheduler(10);
    } catch (e: unknown) {
      console.error('Live TV Health scheduler init error:', e instanceof Error ? e.message : String(e));
    }

    // Prewarm top movie catalogs
    if (typeof apiApp.prewarmTopCatalogs === 'function') {
      apiApp.prewarmTopCatalogs().catch(() => {});
      setInterval(() => {
        apiApp.prewarmTopCatalogs().catch(() => {});
      }, 20 * 60 * 1000);
    }

    // Background ClearKey & IPTV Bot Harvester
    setTimeout(() => {
      try {
        const { runMultiSourceBot } = require('./bot-checker.js');
        if (typeof runMultiSourceBot === 'function') {
          runMultiSourceBot().catch((err: Error) => console.error('Initial bot run error:', err.message));
        }
      } catch (e: unknown) {
        console.error('Bot checker load error:', e instanceof Error ? e.message : String(e));
      }
    }, 4000);

    setInterval(() => {
      try {
        const { runMultiSourceBot } = require('./bot-checker.js');
        if (typeof runMultiSourceBot === 'function') {
          runMultiSourceBot().catch((err: Error) => console.error('Recurring bot run error:', err.message));
        }
      } catch (_e) {}
    }, 30 * 60 * 1000);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
