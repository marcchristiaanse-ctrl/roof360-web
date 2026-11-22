// Gegevens ophalen uit Supabase: ALLEEN LEZEN. (Een tekening opslaan staat in opslaan.ts.)
//
// We gebruiken hier alleen gewone SELECT-opvragingen. Supabase laat via de RLS-regels
// alleen zien wat bij jouw bedrijf (tenant) hoort. Er wordt niets opgeslagen of gewijzigd.
//
// Bewust NIET gebruikt: find_building_drawing en lookup_building_candidates. Die tellen
// mee voor de zoekgrens (60 per uur, 300 per dag) omdat ze iets in een logboek schrijven.
//
// Welke tabellen (zelfde als de iOS-app, zie supabase/migrations in Roof360Measure):
//   tenant_building_links  welke gebouwen jouw bedrijf kent
//   buildings              adres en ligging van het gebouw (centraal)
//   roof_models            het dakmodel per gebouw per bedrijf
//   roof_model_versions    elke opgeslagen versie van de daktekening
//
// Opnames (dakvlakken, details, foto's) staan nog alleen op de iPhone, niet in Supabase.
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { foutInHetNederlands, supabase, type Lidmaatschap } from './supabase';

export type Gebouw = {
  id: string;
  roof360_building_id: string;
  name: string | null;
  complex_name: string | null;
  street: string | null;
  house_number: string | null;
  house_number_addition: string | null;
  postal_code: string | null;
  city: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  matching_status: string;
};

export type GebouwLink = {
  id: string;
  local_display_name: string | null;
  status: string;
  last_used_at: string | null;
  building: Gebouw | null;
};

export type TekeningVersie = {
  id: string;
  version_number: number;
  source_type: 'auto_detected' | 'corrected' | 'measured';
  state: 'published' | 'superseded';
  total_area_m2: number | null;
  scale_factor: number | null;
  bag_pand_id: string | null;
  created_at: string;
};

export type RDPunt = { x: number; y: number };
export type DakDeel = {
  kind: 'roof' | 'canopy';
  number: number;
  rings: RDPunt[][];
  areaSquareMeters: number;
  labelPoint: RDPunt;
  customName?: string | null;
};
// Een met de hand gemeten lijn op de tekening (zelfde vorm als MeasuredRoofEdge in de iOS-app).
export type MeetLijn = { start: RDPunt; end: RDPunt; lengthMeters: number; measuredAt: string; isDeviationConfirmed?: boolean };
// Overige velden van de iOS-app blijven ongewijzigd mee bewaard.
export type Detectie = { pandID?: string; parts?: DakDeel[]; measuredEdges?: MeetLijn[]; isEdited?: boolean; [veld: string]: unknown };
export type DakvlakSamenvatting = { code: string; source: string; detected_part_id?: string | null; area_m2?: number | null };

export const bronNaam: Record<TekeningVersie['source_type'], string> = {
  measured: 'Ingemeten',
  corrected: 'Gecorrigeerd',
  auto_detected: 'Automatisch herkend',
};

// Zelfde volgorde als de server: ingemeten > gecorrigeerd > automatisch, daarbinnen de nieuwste.
const rang = { measured: 3, corrected: 2, auto_detected: 1 } as const;
export function besteVersie(versies: TekeningVersie[]): TekeningVersie | undefined {
  return [...versies].sort((a, b) =>
    rang[b.source_type] - rang[a.source_type]
    || b.created_at.localeCompare(a.created_at)
    || b.version_number - a.version_number)[0];
}

export function adresRegel(g: Gebouw | null | undefined): string {
  if (!g) return 'Onbekend gebouw';
  if (g.formatted_address) return g.formatted_address;
  const straat = [g.street, g.house_number, g.house_number_addition].filter(Boolean).join(' ');
  return [straat, [g.postal_code, g.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || g.roof360_building_id;
}

export function gebouwTitel(l: GebouwLink): string {
  return l.local_display_name || l.building?.name || adresRegel(l.building);
}

// ---------------------------------------------------------------------
// Inloggen en bedrijf (tenant)
// ---------------------------------------------------------------------

export function useSessie() {
  const [sessie, setSessie] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessie(data.session));
    const { data } = supabase.auth.onAuthStateChange((_g, nieuw) => setSessie(nieuw));
    return () => data.subscription.unsubscribe();
  }, []);
  return sessie; // undefined = nog aan het laden, null = niet ingelogd
}

const BEDRIJF_SLEUTEL = 'r360.gekozenBedrijf';
export function gekozenBedrijf(): string | null {
  try { return localStorage.getItem(BEDRIJF_SLEUTEL); } catch { return null; }
}
export function kiesBedrijf(tenantId: string) {
  try { localStorage.setItem(BEDRIJF_SLEUTEL, tenantId); } catch { /* geen opslag: dan kies je opnieuw */ }
}

export async function haalLidmaatschappen(): Promise<Lidmaatschap[]> {
  const { data, error } = await supabase.rpc('my_memberships');
  if (error) throw new Error(foutInHetNederlands(error));
  return (data ?? []) as Lidmaatschap[];
}

// Het bedrijf waarvoor we gegevens tonen: het gekozen bedrijf, anders het eerste actieve.
export function actiefBedrijf(lijst: Lidmaatschap[]): Lidmaatschap | undefined {
  const actief = lijst.filter(l => l.is_effective);
  const keuze = gekozenBedrijf();
  return actief.find(l => l.tenant_id === keuze) ?? actief[0];
}

// ---------------------------------------------------------------------
// Gebouwen en tekeningen
// ---------------------------------------------------------------------

const GEBOUW_VELDEN =
  'id, roof360_building_id, name, complex_name, street, house_number, house_number_addition, ' +
  'postal_code, city, formatted_address, latitude, longitude, matching_status';

export async function haalGebouwen(tenantId: string): Promise<GebouwLink[]> {
  const { data, error } = await supabase
    .from('tenant_building_links')
    .select(`id, local_display_name, status, last_used_at, building:buildings(${GEBOUW_VELDEN})`)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(foutInHetNederlands(error));
  return (data ?? []) as unknown as GebouwLink[];
}

export async function haalGebouw(tenantId: string, gebouwId: string): Promise<GebouwLink | null> {
  const { data, error } = await supabase
    .from('tenant_building_links')
    .select(`id, local_display_name, status, last_used_at, building:buildings(${GEBOUW_VELDEN})`)
    .eq('tenant_id', tenantId)
    .eq('building_id', gebouwId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(foutInHetNederlands(error));
  return data as unknown as GebouwLink | null;
}

// Per gebouw: welke tekeningversies er zijn (zonder de grote tekening zelf, dat scheelt data).
export async function haalVersies(tenantId: string, gebouwId?: string): Promise<(TekeningVersie & { building_id: string })[]> {
  let vraag = supabase
    .from('roof_model_versions')
    .select('id, building_id, version_number, source_type, state, total_area_m2, scale_factor, bag_pand_id, created_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (gebouwId) vraag = vraag.eq('building_id', gebouwId);
  const { data, error } = await vraag;
  if (error) throw new Error(foutInHetNederlands(error));
  return (data ?? []) as (TekeningVersie & { building_id: string })[];
}

// De tekening zelf van één versie.
export type Tekening = { detectie: Detectie | null; dakvlakken: DakvlakSamenvatting[]; origineel: unknown };
export async function haalTekening(versieId: string): Promise<Tekening> {
  const { data, error } = await supabase
    .from('roof_model_versions')
    .select('detection_json, roof_planes_json, original_detection_json')
    .eq('id', versieId)
    .maybeSingle();
  if (error) throw new Error(foutInHetNederlands(error));
  return {
    detectie: (data?.detection_json ?? null) as Detectie | null,
    dakvlakken: (data?.roof_planes_json ?? []) as DakvlakSamenvatting[],
    origineel: data?.original_detection_json ?? null,
  };
}
