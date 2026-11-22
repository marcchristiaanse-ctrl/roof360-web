// Daktekening tekenen uit detection_json (zelfde vorm als de iOS-app opslaat).
// Coördinaten zijn RD New (meters, x naar het oosten, y naar het noorden).
import type { DakDeel, DakvlakSamenvatting, Detectie } from '../gegevens';

function naam(d: DakDeel) {
  const eigen = d.customName?.trim();
  return eigen || (d.kind === 'roof' ? `Dak ${d.number}` : `Luifel ${d.number}`);
}

export function oppervlakte(d: DakDeel, schaal: number, dakvlakken: DakvlakSamenvatting[]): number {
  const id = `${d.kind}-${d.number}`;
  const vlak = dakvlakken.find(v => v.detected_part_id === id && typeof v.area_m2 === 'number');
  return vlak?.area_m2 ?? d.areaSquareMeters * schaal * schaal;
}

export function DakTekening({ detectie, schaal, dakvlakken }: {
  detectie: Detectie; schaal: number; dakvlakken: DakvlakSamenvatting[];
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

  return (
    <svg className="r360-tekening" viewBox={`0 0 ${breedte} ${hoogte}`} role="img" aria-label="Daktekening">
      {delen.map(d => (
        <path key={`${d.kind}-${d.number}`} d={pad(d)} fillRule="evenodd"
          className={d.kind === 'roof' ? 'r360-tekening__dak' : 'r360-tekening__luifel'}
          strokeWidth={letter / 8} />
      ))}
      {delen.map(d => (
        <g key={`label-${d.kind}-${d.number}`} transform={`translate(${sx(d.labelPoint.x)},${sy(d.labelPoint.y)})`}>
          <text textAnchor="middle" fontSize={letter} className="r360-tekening__naam">{naam(d)}</text>
          <text textAnchor="middle" y={letter * 1.15} fontSize={letter * 0.8} className="r360-tekening__maat">
            {Math.round(oppervlakte(d, schaal, dakvlakken))} m²
          </text>
        </g>
      ))}
    </svg>
  );
}
