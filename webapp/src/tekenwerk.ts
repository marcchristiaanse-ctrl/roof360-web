// Een dakdeel met de hand toevoegen aan de daktekening van het gebouw, zoals de iOS-app
// (DetectedRoofPartEditing.adding): hoeken aantikken, controleren, als nieuw deel opslaan
// in een nieuwe tekeningversie. Bestaande delen houden hun nummer, zodat dakvlakken die al
// naar een deel verwijzen kloppen; het nieuwe deel krijgt het volgende nummer.
import { besteVersie, haalTekening, haalVersies, type DakDeel, type Detectie, type RDPunt, type Tekening, type TekeningVersie } from './gegevens';
import { lijnen, oppervlakte as deelOppervlakte, zelfdeLijn } from './components/DakTekening';
import { schaalFactor } from './schaal';
import { nieuweId } from './opslaan';

const MIN_OPPERVLAKTE = 1.0, GELIJK = 0.001;

const getekendeOppervlakte = (r: RDPunt[]) =>
  r.reduce((s, a, i) => { const b = r[(i + 1) % r.length]; return s + a.x * b.y - b.x * a.y; }, 0) / 2;

function snijden(a1: RDPunt, a2: RDPunt, b1: RDPunt, b2: RDPunt) {
  const k = (p: RDPunt, q: RDPunt, r: RDPunt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = k(b1, b2, a1), d2 = k(b1, b2, a2), d3 = k(a1, a2, b1), d4 = k(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function kruistZichzelf(r: RDPunt[]) {
  const n = r.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue; // buren delen een hoek
    if (snijden(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true;
  }
  return false;
}

function binnen(p: RDPunt, r: RDPunt[]) {
  let in_ = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if ((r[i].y > p.y) !== (r[j].y > p.y) && p.x < (r[j].x - r[i].x) * (p.y - r[i].y) / (r[j].y - r[i].y) + r[i].x) in_ = !in_;
  }
  return in_;
}

// Hoeken controleren: dubbele punten eruit, minstens 3 hoeken, niet over zichzelf, minstens 1 m².
export function controleerHoeken(hoeken: RDPunt[]): RDPunt[] {
  const ring: RDPunt[] = [];
  for (const p of hoeken) {
    const l = ring[ring.length - 1];
    if (!l || Math.hypot(l.x - p.x, l.y - p.y) > GELIJK) ring.push(p);
  }
  if (ring.length > 1 && Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].y - ring[ring.length - 1].y) <= GELIJK) ring.pop();
  if (ring.length < 3) throw new Error('Tik minstens 3 hoeken aan.');
  if (kruistZichzelf(ring)) throw new Error('De lijnen kruisen elkaar. Haal de laatste hoek weg en tik de hoeken rondom aan.');
  let opp = getekendeOppervlakte(ring);
  if (opp < 0) { ring.reverse(); opp = -opp; }
  if (opp < MIN_OPPERVLAKTE) throw new Error('Dit dakdeel is kleiner dan 1 m².');
  return ring;
}

function binnenPunt(r: RDPunt[]): RDPunt {
  const c = { x: r.reduce((s, p) => s + p.x, 0) / r.length, y: r.reduce((s, p) => s + p.y, 0) / r.length };
  if (binnen(c, r)) return c;
  for (let i = 0; i < r.length; i++) {
    const a = r[(i + r.length - 1) % r.length], b = r[i], d = r[(i + 1) % r.length];
    const k = { x: (a.x + b.x + d.x) / 3, y: (a.y + b.y + d.y) / 3 };
    if (binnen(k, r)) return k;
  }
  return c;
}

export function deelToevoegen(detectie: Detectie, hoeken: RDPunt[]): { detectie: Detectie; deel: DakDeel } {
  const ring = controleerHoeken(hoeken);
  const delen = detectie.parts ?? [];
  const deel: DakDeel = {
    kind: 'roof', number: Math.max(0, ...delen.filter(d => d.kind === 'roof').map(d => d.number)) + 1,
    rings: [ring], areaSquareMeters: getekendeOppervlakte(ring), labelPoint: binnenPunt(ring), customName: null,
  };
  // Velden die de iOS-app verwacht voor een deel; hoogte en helling onbekend (0), zoals daar.
  Object.assign(deel, { areaOutsideBAGSquareMeters: 0, medianHeightNAP: 0, slopeDegrees: 0 });
  return { detectie: { ...detectie, parts: [...delen, deel], isEdited: true }, deel };
}

// Gegevens voor save_roof_model_version, zoals de iOS-app (RoofModelVersionPayload).
export function versieGegevens(versie: TekeningVersie, tekening: Tekening, detectie: Detectie, schaal: number) {
  const totaal = (detectie.parts ?? []).filter(d => d.kind === 'roof')
    .reduce((s, d) => s + deelOppervlakte(d, schaal, tekening.dakvlakken), 0);
  return {
    source_type: versie.source_type === 'measured' ? 'measured' : 'corrected',
    source_app: 'measure_web',
    bag_pand_id: versie.bag_pand_id ?? detectie.pandID ?? null,
    detection_json: detectie,
    original_detection_json: tekening.origineel ?? null,
    roof_planes_json: tekening.dakvlakken,
    scale_factor: schaal,
    total_area_m2: totaal,
    client_created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------
// Daktekening van het gebouw laden en dakdelen overnemen in de opname
// (zoals DetectedRoofTakeOver in de iOS-app).
// ---------------------------------------------------------------------
export type GebouwTekening = { versie: TekeningVersie; tekening: Tekening; schaal: number };

// Beste versie van de tekening met de schaal van het gebouw (uit de gemeten lijnen, anders de versie).
export async function laadGebouwTekening(tenantId: string, gebouwId: string): Promise<GebouwTekening | null> {
  const versie = besteVersie(await haalVersies(tenantId, gebouwId));
  if (!versie) return null;
  const tekening = await haalTekening(versie.id);
  if (!tekening.detectie?.parts?.length) return null;
  const alle = lijnen(tekening.detectie.parts);
  const m = (tekening.detectie.measuredEdges ?? []).flatMap(e => {
    const l = alle.find(x => zelfdeLijn(x, e.start, e.end));
    return l ? [{ gemeten: e.lengthMeters, getekend: l.lengte }] : [];
  });
  return { versie, tekening, schaal: m.length ? schaalFactor(m) : versie.scale_factor ?? 1 };
}

export const deelId = (d: DakDeel) => `${d.kind}-${d.number}`;

// Randen (op de schaal van het gebouw) voor een overgenomen deel.
export function randenVoorDeel(deel: DakDeel, g: GebouwTekening, dakvlakId: string) {
  const ring = deel.rings[0];
  return ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const lengte = Math.hypot(a.x - b.x, a.y - b.y) * g.schaal;
    if (lengte < 0.01) return [];
    return [{ id: nieuweId(), roof_plane_id: dakvlakId, sequence_number: i + 1, code: `R${i + 1}`,
      length_m: Math.round(lengte * 1000) / 1000, source: 'manual', measurement_source: 'bag_reference',
      source_description: `Uit daktekening versie ${g.versie.version_number}`,
      bag_reference_pand_id: g.versie.bag_pand_id, bag_reference_edge_id: `${deelId(deel)}:${i}` }];
  });
}

// Velden van het dakvlak bij overname van een deel.
export const dakvlakVoorDeel = (deel: DakDeel, g: GebouwTekening) => ({
  measurement_method: 'manual', detected_part_id: deelId(deel), roof_model_version_id: g.versie.id,
  contour_status: 'closed', gross_area_source: 'geometry',
  calculated_area_m2: Math.round(deelOppervlakte(deel, g.schaal, []) * 100) / 100,
  measurement_status: 'in_progress', scale_factor: null,
});
