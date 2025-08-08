import { encode, decode } from '../../src/index';

function $(id: string): HTMLInputElement | HTMLButtonElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as any;
}

function parseCoordinatesFromHtml(html: string): { lat: number; lon: number } | null {
  const text = html;
  // 1) Try URL patterns like !3d<lat>!4d<lon>
  {
    const m = text.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
    if (m) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { lat, lon };
      }
    }
  }
  // 2) Try visible decimal pair in text
  {
    const re = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { lat, lon };
      }
    }
  }
  // 3) Try query=lat,lon patterns (URL encoded or plain)
  {
    const m = text.match(/query=(-?\d{1,2}\.\d+)[,%2C]+(-?\d{1,3}\.\d+)/);
    if (m) {
      const lat = Number(m[1]);
      const lon = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { lat, lon };
      }
    }
  }
  return null;
}

function onReady() {
  const lat = $('lat') as HTMLInputElement;
  const lon = $('lon') as HTMLInputElement;
  const wordsOut = $('wordsOut') as HTMLInputElement;
  const wordsIn = $('wordsIn') as HTMLInputElement;
  const coordOut = $('coordOut') as HTMLInputElement;
  const locQuery = $('locQuery') as HTMLInputElement;
  const locStatus = $('locStatus') as unknown as HTMLSpanElement;
  const langSelect = $('langSelect') as HTMLSelectElement;
  
  async function performSearch(): Promise<void> {
    const q = locQuery.value.trim();
    if (!q) { locStatus.textContent = 'Enter a place first'; return; }
    try {
      locStatus.textContent = 'Searching… (Nominatim)';
      const url = new URL('/api/free-geocode', window.location.origin);
      url.searchParams.set('query', q);
      url.searchParams.set('lang', langSelect.value || 'en');
      const res = await fetch(url.toString());
      const data: any[] = await res.json();
      const first = data?.[0];
      if (!first) { locStatus.textContent = `No results for "${q}"`; return; }
      const plat = Number(first.lat);
      const plon = Number(first.lon);
      const formatted = `${plat.toFixed(6)}, ${plon.toFixed(6)}`;
      locStatus.textContent = `Found: ${formatted}`;
      lat.value = String(plat);
      lon.value = String(plon);
      // Auto-encode
      const words = encode(plat, plon);
      wordsOut.value = words.join(' ');
    } catch (e: any) {
      locStatus.textContent = `Error: ${e?.message || e}`;
    }
  }

  $('openGoogleBtn').addEventListener('click', performSearch);
  locQuery.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      performSearch();
    }
  });
  

  $('encodeBtn').addEventListener('click', () => {
    try {
      const latNum = Number(lat.value);
      const lonNum = Number(lon.value);
      const words = encode(latNum, lonNum);
      wordsOut.value = words.join(' ');
    } catch (e: any) {
      wordsOut.value = `Error: ${e?.message || e}`;
    }
  });

  $('decodeBtn').addEventListener('click', () => {
    try {
      const words = wordsIn.value.trim().split(/\s+/);
      const { lat, lon } = decode(words);
      coordOut.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch (e: any) {
      coordOut.value = `Error: ${e?.message || e}`;
    }
  });

  
}

onReady();


