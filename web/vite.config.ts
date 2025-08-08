import { defineConfig } from 'vite';
import path from 'node:path';
import type { Plugin } from 'vite';
import { fetch as undiciFetch } from 'undici';

function googleProxy(): Plugin {
  return {
    name: 'google-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url) return next();
          const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
          if (req.url.startsWith('/api/geocode') && apiKey) {
            const urlObj = new URL(req.url, 'http://localhost');
            const address = urlObj.searchParams.get('address') || '';
            const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
            url.searchParams.set('address', address);
            url.searchParams.set('key', apiKey);
            const r = await undiciFetch(url.toString());
            const txt = await r.text();
            res.setHeader('content-type', 'application/json');
            res.end(txt);
            return;
          }
          if (req.url.startsWith('/api/reverse') && apiKey) {
            const urlObj = new URL(req.url, 'http://localhost');
            const lat = urlObj.searchParams.get('lat') || '';
            const lon = urlObj.searchParams.get('lon') || '';
            const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
            url.searchParams.set('latlng', `${lat},${lon}`);
            url.searchParams.set('key', apiKey);
            const r = await undiciFetch(url.toString());
            const txt = await r.text();
            res.setHeader('content-type', 'application/json');
            res.end(txt);
            return;
          }
          if (req.url.startsWith('/api/google-search')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const q = (urlObj.searchParams.get('query') || '').trim();
            const gUrl = new URL('https://www.google.com/search');
            gUrl.searchParams.set('q', `${q} gps coordinates`);
            gUrl.searchParams.set('hl', 'en');
            const r = await undiciFetch(gUrl.toString(), {
              headers: {
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
                'accept-language': 'en-US,en;q=0.9',
              },
            });
            const txt = await r.text();
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end(txt);
            return;
          }
          if (req.url.startsWith('/api/free-geocode')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const q = (urlObj.searchParams.get('query') || '').trim();
            const lang = (urlObj.searchParams.get('lang') || 'en').trim();
            const apiUrl = new URL('https://nominatim.openstreetmap.org/search');
            apiUrl.searchParams.set('q', q);
            apiUrl.searchParams.set('format', 'jsonv2');
            apiUrl.searchParams.set('limit', '1');
            // Respect Nominatim usage policy: identify the app
            const r = await undiciFetch(apiUrl.toString(), {
              headers: {
                'user-agent': 'BIP39GeocodingDev/0.1 (+https://example.com)',
                'accept-language': lang,
              },
            });
            const txt = await r.text();
            res.setHeader('content-type', 'application/json');
            res.end(txt);
            return;
          }
          next();
        } catch (e) {
          next(e as any);
        }
      });
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, 'public'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020'
  },
  server: {
    fs: {
      // allow importing from project root (../src)
      allow: [path.resolve(__dirname, '..')],
    },
    port: 5173,
    open: false,
  },
  plugins: [googleProxy()],
});


