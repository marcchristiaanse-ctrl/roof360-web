// Rekenen met GPS-punten: afstand, lokale meters rond een nulpunt en oppervlakte.
// Voor daken (tientallen meters) is een vlakke benadering rond het nulpunt ruim nauwkeurig genoeg.
const AARDE = 6371008.8; // gemiddelde straal in meters
const rad = (g: number) => (g * Math.PI) / 180;

export type LatLon = { latitude: number; longitude: number };

// Afstand in meters (haversine)
export function afstand(a: LatLon, b: LatLon): number {
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * AARDE * Math.asin(Math.sqrt(h));
}

// Oost/noord in meters ten opzichte van een nulpunt
export function lokaal(p: LatLon, nul: LatLon): { x: number; y: number } {
  return {
    x: rad(p.longitude - nul.longitude) * AARDE * Math.cos(rad(nul.latitude)),
    y: rad(p.latitude - nul.latitude) * AARDE,
  };
}

// Oppervlakte van een gesloten veelhoek (shoelace) in m²
export function oppervlakte(punten: LatLon[]): number {
  if (punten.length < 3) return 0;
  const nul = punten[0];
  const xy = punten.map(p => lokaal(p, nul));
  let som = 0;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i], b = xy[(i + 1) % xy.length];
    som += a.x * b.y - b.x * a.y;
  }
  return Math.abs(som) / 2;
}

export const meter = (m: number | null | undefined, cijfers = 2) =>
  m == null ? '' : `${m.toLocaleString('nl-NL', { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers })} m`;

// Nauwkeurigheid in gewone woorden (voor een snelle blik op het dak)
export function kwaliteit(nauwkeurigheid: number): { tekst: string; klasse: string } {
  if (nauwkeurigheid <= 0.05) return { tekst: 'RTK-nauwkeurig', klasse: 'goed' };
  if (nauwkeurigheid <= 0.5) return { tekst: 'Redelijk', klasse: 'matig' };
  return { tekst: 'Onnauwkeurig', klasse: 'slecht' };
}
