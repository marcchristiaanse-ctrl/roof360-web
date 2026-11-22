// Op schaal zetten met echte maten (meetlint), dezelfde rekenregels als de iOS-app
// (DetectedRoofEdgeMeasurement.swift). Eén schaal voor het hele gebouw of dakvlak:
// alle lijnen x schaal, alle oppervlaktes x schaal x schaal. Wat gemeten of getekend is
// blijft onveranderd bewaard; de schaal komt er alleen bovenop.

export type Monster = { gemeten: number; getekend: number };

export const TOEGESTANE_AFWIJKING = 0.02;          // meer dan 2% verschil: waarschuwen
export const MIN_SCHAAL = 0.5, MAX_SCHAAL = 2.0;   // daarbuiten bijna zeker een tikfout
const MIN_UITSCHIETER = 0.03;

function mediaan(w: number[]): number {
  const s = [...w].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Eén maat: die verhouding. Twee: het gemiddelde. Drie of meer: een gewogen best passende
// schaal, zonder duidelijke uitschieters. De volgorde van meten maakt niet uit.
export function schaalFactor(monsters: Monster[]): number {
  const m = monsters.filter(s => s.getekend > 0 && s.gemeten > 0);
  if (m.length === 0) return 1;
  const verhoudingen = m.map(s => s.gemeten / s.getekend);
  const med = mediaan(verhoudingen);
  if (m.length < 3) return med;
  const spreiding = mediaan(verhoudingen.map(v => Math.abs(v - med)));
  const grens = Math.max(2 * spreiding, MIN_UITSCHIETER * med);
  const over = m.filter(s => Math.abs(s.gemeten / s.getekend - med) <= grens);
  const noemer = over.reduce((t, s) => t + s.getekend * s.getekend, 0);
  return noemer > 0 ? over.reduce((t, s) => t + s.gemeten * s.getekend, 0) / noemer : med;
}

// Afwijking van een maat ten opzichte van wat de schaal voorspelt (0,03 = 3%).
export const afwijking = (s: Monster, schaal: number) => {
  const verwacht = s.getekend * schaal;
  return verwacht > 0 ? Math.abs(s.gemeten - verwacht) / verwacht : 0;
};

// Controle bij het invullen van een maat. Geeft een foutmelding of null.
export function controleerMaat(gemeten: number | null, getekend: number): string | null {
  if (gemeten == null || !Number.isFinite(gemeten) || !(gemeten > 0)) return 'Vul een lengte in meters in, groter dan 0.';
  if (!(getekend > 0)) return 'Deze lijn heeft geen lengte.';
  const v = gemeten / getekend;
  if (v < MIN_SCHAAL || v > MAX_SCHAAL) {
    return `Deze maat wijkt te veel af van de tekening (${getekend.toLocaleString('nl-NL', { maximumFractionDigits: 2 })} m). Controleer de lijn en de maat.`;
  }
  return null;
}

export const procent = (f: number) => `${(f * 100).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%`;
