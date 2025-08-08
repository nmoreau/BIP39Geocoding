import { fetch as undiciFetch } from 'undici';

export type GeocodeResult = { lat: number; lon: number; raw: unknown };
export type ReverseGeocodeResult = { formattedAddress: string; raw: unknown };

export async function geocodeAddress(apiKey: string, address: string): Promise<GeocodeResult> {
  if (!apiKey) throw new Error('Missing Google Maps API key');
  const f = undiciFetch ?? fetch;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);
  const res = await f(url.toString());
  if (!res.ok) throw new Error(`Geocode HTTP error ${res.status}`);
  const data: any = await res.json();
  if (data.status !== 'OK' || !(data.results && data.results.length)) {
    throw new Error(`Geocode failed: ${data?.status || 'NO_RESULTS'}`);
  }
  const first = data.results[0];
  const location = first.geometry?.location;
  if (!location) throw new Error('Geocode missing geometry.location');
  return { lat: location.lat, lon: location.lng, raw: data };
}

export async function reverseGeocode(apiKey: string, lat: number, lon: number): Promise<ReverseGeocodeResult> {
  if (!apiKey) throw new Error('Missing Google Maps API key');
  const f = undiciFetch ?? fetch;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lon}`);
  url.searchParams.set('key', apiKey);
  const res = await f(url.toString());
  if (!res.ok) throw new Error(`Reverse geocode HTTP error ${res.status}`);
  const data: any = await res.json();
  if (data.status !== 'OK' || !(data.results && data.results.length)) {
    throw new Error(`Reverse geocode failed: ${data?.status || 'NO_RESULTS'}`);
  }
  const first = data.results[0];
  const formattedAddress = first.formatted_address || '';
  return { formattedAddress, raw: data };
}


