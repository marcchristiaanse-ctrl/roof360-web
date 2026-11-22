// Daktekening tekenen uit detection_json (zelfde vorm als de iOS-app opslaat).
// Coördinaten zijn RD New (meters, x naar het oosten, y naar het noorden).
// Met onKiesLijn kun je een lijn aantikken om er een echte maat bij in te vullen.
import type { DakDeel, DakvlakSamenvatting, Detectie, MeetLijn, RDPunt } from '../gegevens';

export function naam(d: DakDeel) {
  const eigen = d.customName?.trim();
  return eigen || (d.kind === 'roof' ? `Dak ${d.number}` : `Luifel ${d.number}`);
}

export function oppervlakte(d: DakDeel, schaal: number, dakvlakken: DakvlakSamenvatting[]): number {
  const id = `${d.kind}-${d.number}`;
  const vlak = dakvlakken.find(v => v.detected_part_id === id && typeof v.area_m2 === 'number');
  return vlak?.area_m2 ?? d.areaSquareMeters * schaal * schaal;
}

// Lijnen van alle dakdelen; een gedeelde rand van twee delen telt één keer (zoals in de iOS-app).
export type Lijn = { start: RDPunt; end: RDPunt; lengte: number };
const MARGE = 0.01; // eindpunten binnen 1 cm zijn dezelfde lijn
const afst = (a: RDPunt, b: RDPunt) => Math.hypot(a.x - b.x, a.y - b.y);
export const zelfdeLijn = (l: { start: RDPunt; end: RDPunt }, a: RDPunt, b: RDPunt) =>
  (afst(l.start, a) <= MARGE && afst(l.end, b) <= MARGE) || (afst(l.start, b) <= MARGE && afst(l.end, a) <= MARGE);

export function lijnen(delen: DakDeel[]): Lijn[] {
  const uit: Lijn[] = [];
  for (const d of delen) for (const ring of d.rings ?? []) {
    if (ring.length < 2) continue;
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      if (afst(a, b) <= MARGE || uit.some(l => zelfdeLijn(l, a, b))) return;
      uit.push({ start: a, end: b, lengte: afst(a, b) });
    });
  }
  return uit;
}

export function DakTekening({ detectie, schaal, dakvlakken, metingen = [], gekozen, onKiesLijn, waarschuwing = [] }: {
  detectie: Detectie; schaal: number; dakvlakken: DakvlakSamenvatting[];
  metingen?: MeetLijn[]; gekozen?: Lijn | null; onKiesLijn?: (l: Lijn) => void; waarschuwing?: MeetLijn[];
}) {
  const delen = (detectie.parts ?? []).filter(d => d.rings?.[0]?.length >= 3);
  if (delen.length === 0) return <p className="r360-leeg">Deze tekening heeft geen dakdelen.</p>;

  const punten = delen.flatMap(d => d.rings.flat());
  const minX = Math.min(...punten.map(p => p.x)), maxX = Math.max(...punten.map(p => p.x));
  const minY = Math.min(...punten.map(p => p.y)), maxY = Math.max(...punten.map(p => p.y));
  const rand = Math.max(maxX - minX, maxY - minY) * 0.06 + 1;
  const breedte = maxX - minX + 2 * rand, hoogte = maxY - minY + 2 * rand;
  // SVG telt y naar beneden, kaarten naar boven: daarom spiegelen.
  const sx = (x: number) => x - minX + rand;
  const sy = (y: number) => maxY - y + rand;
  const pad = (d: DakDeel) => d.rings
    .map(r => 'M' + r.map(p => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join('L') + 'Z')
    .join(' ');
  const letter = Math.max(breedte, hoogte) / 32;
  const alleLijnen = onKiesLijn || metingen.length ? lijnen(delen) : [];
  const meting = (l: Lijn) => metingen.find(m => zelfdeLijn(l, m.start, m.end));

  return (
    <svg className="r360-tekening" viewBox={`0 0 ${breedte} ${hoogte}`} role="img" aria-label="Daktekening">
      {delen.map(d => (
        <path key={`${d.kind}-${d.number}`} d={pad(d)} fillRule="evenodd"
          className={d.kind === 'roof' ? 'r360-tekening__dak' : 'r360-tekening__luifel'}
          strokeWidth={letter / 8} />
      ))}
      {alleLijnen.map((l, i) => {
        const m = meting(l);
        const isGekozen = gekozen && zelfdeLijn(gekozen, l.start, l.end);
        const wijkt = m && waarschuwing.some(w => zelfdeLijn(l, w.start, w.end));
        const klasse = isGekozen ? 'r360-lijn--gekozen' : wijkt ? 'r360-lijn--afwijking' : m ? 'r360-lijn--gemeten' : 'r360-lijn';
        const mx = sx((l.start.x + l.end.x) / 2), my = sy((l.start.y + l.end.y) / 2);
        return (
          <g key={i} onClick={onKiesLijn ? () => onKiesLijn(l) : undefined} style={onKiesLijn ? { cursor: 'pointer' } : undefined}>
            {/* brede onzichtbare strook: makkelijker aantikken met een vinger */}
            {onKiesLijn && <line x1={sx(l.start.x)} y1={sy(l.start.y)} x2={sx(l.end.x)} y2={sy(l.end.y)}
              stroke="transparent" strokeWidth={letter * 1.2} />}
            <line x1={sx(l.start.x)} y1={sy(l.start.y)} x2={sx(l.end.x)} y2={sy(l.end.y)}
              className={klasse} strokeWidth={letter / (isGekozen || m ? 3 : 6)} strokeLinecap="round" />
            {(m || isGekozen) && (
              <text x={mx} y={my - letter * 0.35} textAnchor="middle" fontSize={letter * 0.75} className="r360-lijn__tekst">
                {(m ? m.lengthMeters : l.lengte * schaal).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} m
              </text>
            )}
          </g>
        );
      })}
      {delen.map(d => (
        <g key={`label-${d.kind}-${d.number}`} transform={`translate(${sx(d.labelPoint.x)},${sy(d.labelPoint.y)})`} pointerEvents="none">
          <text textAnchor="middle" fontSize={letter} className="r360-tekening__naam">{naam(d)}</text>
          <text textAnchor="middle" y={letter * 1.15} fontSize={letter * 0.8} className="r360-tekening__maat">
            {Math.round(oppervlakte(d, schaal, dakvlakken))} m²
          </text>
        </g>
      ))}
    </svg>
  );
}
