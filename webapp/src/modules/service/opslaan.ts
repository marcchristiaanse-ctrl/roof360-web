// Roof360 Service: opslaan, ook zonder internet.
//
// Alles gaat via save_record op de server; die controleert rol en module (migratie 0012).
// Geen verbinding? Dan komt de wijziging in een wachtrij op dit apparaat en gaat ze vanzelf
// weg zodra er weer internet is. Elke wijziging houdt haar eigen mutation-id, zodat de server
// een dubbel verstuurde wijziging maar een keer uitvoert.
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { nieuweId } from '../../opslaan';

type Wijziging = {
  mutatie: string; tenant: string; tabel: string;
  record: Record<string, unknown> & { id: string }; versie: number | null; tijd: string;
};

const WACHTRIJ = 'r360.service.wachtrij';
const luisteraars = new Set<() => void>();

function lees(): Wijziging[] {
  try { return JSON.parse(localStorage.getItem(WACHTRIJ) ?? '[]'); } catch { return []; }
}
function schrijf(lijst: Wijziging[]) {
  try { localStorage.setItem(WACHTRIJ, JSON.stringify(lijst)); } catch { /* vol of geblokkeerd */ }
  luisteraars.forEach(f => f());
}

function vertaal(fout: { code?: string; message?: string }): string {
  switch (fout.code) {
    case 'R3014': return 'Iemand anders heeft dit intussen gewijzigd. Open het opnieuw en probeer het nog eens.';
    case 'R3015': return 'Dit is intussen verwijderd.';
    case '42501': return 'Je mag dit niet opslaan, of Roof360 Service staat niet aan voor je bedrijf.';
    case '23505': return 'Dit nummer bestaat al. Probeer het nog eens.';
    case '23503': return 'Dit gebouw of deze melding hoort niet bij je bedrijf.';
    case '23514': return 'Niet alles is goed ingevuld.';
  }
  return `Opslaan lukte niet: ${fout.message ?? 'onbekende fout'}`;
}

const isNetwerkfout = (e: unknown) =>
  !navigator.onLine || /failed to fetch|network|load failed/i.test(String((e as Error)?.message ?? e));

async function verstuur(w: Wijziging) {
  const { data, error } = await supabase.rpc('save_record', {
    p_tenant_id: w.tenant, p_mutation_id: w.mutatie, p_table: w.tabel,
    p_record: w.record, p_expected_version: w.versie,
  });
  if (error) {
    const e = new Error(vertaal(error)) as Error & { netwerk?: boolean };
    e.netwerk = isNetwerkfout(error);
    throw e;
  }
  return data;
}

export type Resultaat<T> = { opgeslagen: true; rij: T } | { opgeslagen: false; inWachtrij: true };

// Opslaan; zonder internet in de wachtrij. Andere fouten (geen rechten, verouderd) gooien.
export async function bewaarService<T>(tenant: string, tabel: string,
  record: Record<string, unknown> & { id: string }, versie?: number): Promise<Resultaat<T>> {
  const w: Wijziging = { mutatie: nieuweId(), tenant, tabel, record, versie: versie ?? null, tijd: new Date().toISOString() };
  if (!navigator.onLine) { schrijf([...lees(), w]); return { opgeslagen: false, inWachtrij: true }; }
  try {
    return { opgeslagen: true, rij: await verstuur(w) as T };
  } catch (e) {
    if ((e as { netwerk?: boolean }).netwerk || isNetwerkfout(e)) {
      schrijf([...lees(), w]);
      return { opgeslagen: false, inWachtrij: true };
    }
    throw e;
  }
}

// Wachtrij versturen, in volgorde. Stopt bij de eerste netwerkfout; een geweigerde wijziging
// (bv. verouderd) wordt eruit gehaald en gemeld, zodat de rest niet blijft hangen.
let bezig = false;
export async function verstuurWachtrij(): Promise<string[]> {
  if (bezig || !navigator.onLine) return [];
  bezig = true;
  const meldingen: string[] = [];
  try {
    for (const w of lees()) {
      try {
        await verstuur(w);
      } catch (e) {
        if ((e as { netwerk?: boolean }).netwerk) break;
        meldingen.push((e as Error).message);
      }
      schrijf(lees().filter(x => x.mutatie !== w.mutatie));
    }
  } finally { bezig = false; }
  return meldingen;
}

// Aantal wijzigingen dat nog op dit apparaat wacht; verstuurt automatisch bij weer online.
export function useWachtrij(): { aantal: number; online: boolean; fouten: string[] } {
  const [aantal, setAantal] = useState(() => lees().length);
  const [online, setOnline] = useState(navigator.onLine);
  const [fouten, setFouten] = useState<string[]>([]);
  useEffect(() => {
    const ververs = () => setAantal(lees().length);
    const aan = () => { setOnline(true); verstuurWachtrij().then(f => f.length && setFouten(f)); };
    const uit = () => setOnline(false);
    luisteraars.add(ververs);
    window.addEventListener('online', aan);
    window.addEventListener('offline', uit);
    aan();
    return () => { luisteraars.delete(ververs); window.removeEventListener('online', aan); window.removeEventListener('offline', uit); };
  }, []);
  return { aantal, online, fouten };
}

// Laatst geladen gegevens bewaren, zodat een werkbon ook zonder internet te openen is.
const CACHE = 'r360.service.cache.';
export function bewaarKopie(sleutel: string, waarde: unknown) {
  try { localStorage.setItem(CACHE + sleutel, JSON.stringify(waarde)); } catch { /* geen ruimte: dan niet */ }
}
export function leesKopie<T>(sleutel: string): T | null {
  try { const v = localStorage.getItem(CACHE + sleutel); return v ? JSON.parse(v) as T : null; } catch { return null; }
}

// Leesbaar nummer, uniek genoeg per bedrijf: M-221126-1435-K7 (datum, tijd, 2 tekens).
export function nieuwNummer(voorvoegsel: 'M' | 'W'): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  const tekens = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = Array.from({ length: 2 }, () => tekens[Math.floor(Math.random() * tekens.length)]).join('');
  return `${voorvoegsel}-${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}-${p(d.getHours())}${p(d.getMinutes())}-${r}`;
}
