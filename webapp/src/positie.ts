// Live positie voor de Emlid-meting, met dezelfde regels als de iOS-app
// (MeasurementQualityPolicy.productionRTK en PositionStabilityEvaluator):
//   * nauwkeurigheid 2 cm of beter (alleen haalbaar met RTK FIX van de Emlid)
//   * positie niet ouder dan 5 seconden
//   * stabiel: minstens 3 metingen in de laatste 4 seconden, onderling hooguit 3 cm uit elkaar
// De browser krijgt van de iPhone alleen positie en nauwkeurigheid door, geen fix-type of tilt.
// Daarom geldt de nauwkeurigheid als teken van RTK FIX.
// Alleen aan zolang het scherm het vraagt: GPS kost batterij.
import { useEffect, useState } from 'react';
import { afstand } from './meetkunde';

export const RTK_NAUWKEURIGHEID = 0.02;
const MAX_LEEFTIJD_MS = 5000, VENSTER_MS = 4000, MIN_METINGEN = 3, MAX_SPREIDING = 0.03;

export type Monsterpunt = { latitude: number; longitude: number; altitude: number | null; accuracy: number;
  altitudeAccuracy: number | null; tijd: number };
export type LivePositie = {
  laatste: Monsterpunt | null;
  klaar: boolean;          // mag als RTK-punt vastgelegd worden
  stabiel: boolean;
  reden: string;           // in gewone woorden, voor op het scherm
  fout: string | null;
};

export function beoordeel(monsters: Monsterpunt[], nu: number): Omit<LivePositie, 'fout'> {
  const laatste = monsters[monsters.length - 1] ?? null;
  if (!laatste) return { laatste, klaar: false, stabiel: false, reden: 'Wacht op positie…' };
  if (nu - laatste.tijd > MAX_LEEFTIJD_MS) return { laatste, klaar: false, stabiel: false, reden: 'Positie is niet actueel' };
  if (laatste.accuracy > RTK_NAUWKEURIGHEID) {
    return { laatste, klaar: false, stabiel: false,
      reden: laatste.accuracy <= 0.5 ? 'Nog geen RTK FIX: wacht even' : 'Geen RTK: is de Emlid verbonden met de iPhone?' };
  }
  const recent = monsters.filter(m => nu - m.tijd <= VENSTER_MS && m.accuracy <= RTK_NAUWKEURIGHEID);
  if (recent.length < MIN_METINGEN) return { laatste, klaar: false, stabiel: false, reden: 'Stilhouden: positie wordt stabiel…' };
  const spreiding = Math.max(...recent.map(m => afstand(recent[0], m)));
  if (spreiding > MAX_SPREIDING) return { laatste, klaar: false, stabiel: false, reden: 'Stok stilhouden: positie beweegt nog' };
  return { laatste, klaar: true, stabiel: true, reden: 'RTK FIX en stabiel' };
}

export function useLivePositie(aan: boolean): LivePositie {
  const [monsters, setMonsters] = useState<Monsterpunt[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [nu, setNu] = useState(() => Date.now());

  useEffect(() => {
    if (!aan) { setMonsters([]); return; }
    if (!('geolocation' in navigator)) { setFout('Dit apparaat of deze browser kan geen locatie meten.'); return; }
    setFout(null);
    const id = navigator.geolocation.watchPosition(p => {
      const c = p.coords;
      setFout(null);
      setMonsters(oud => [...oud.filter(m => Date.now() - m.tijd <= VENSTER_MS * 2), {
        latitude: c.latitude, longitude: c.longitude, altitude: c.altitude, accuracy: c.accuracy,
        altitudeAccuracy: c.altitudeAccuracy, tijd: Date.now(),
      }]);
    }, e => setFout(e.code === e.PERMISSION_DENIED
      ? 'Geef de web-app toestemming voor je locatie (in de instellingen van je browser).'
      : 'Geen positie. Sta je buiten, en staat de Emlid aan?'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    const klok = setInterval(() => setNu(Date.now()), 1000);
    return () => { navigator.geolocation.clearWatch(id); clearInterval(klok); };
  }, [aan]);

  return { ...beoordeel(monsters, nu), fout };
}
