// Opslaan in Supabase via de functies save_record en delete_record (migratie 0008).
// De server controleert zelf wie je bent en voor welk bedrijf je mag schrijven.
import { supabase } from './supabase';

export type Project = {
  id: string; tenant_id: string; building_id: string | null; name: string;
  address: string; postal_code: string; city: string; order_reference: string;
  building_address_snapshot: string; organization_name_snapshot: string;
  contact_name_snapshot: string; status: 'active' | 'archived';
  version: number; created_at: string; updated_at: string; deleted_at: string | null;
};
export type Relatie = {
  id: string; company_name: string; customer_number: string; city: string;
  email_address: string; phone_number: string; is_archived: boolean; version: number; deleted_at: string | null;
};
export type ProjectRelatie = {
  id: string; project_id: string; party_id: string; role: string; version: number; deleted_at: string | null;
};
export type AlgemeneOpname = {
  id: string; project_id: string; status: 'not_reviewed' | 'in_progress' | 'completed';
  roof_accessibility: string | null; roof_access: string[]; custom_roof_access: string | null;
  crane_possible: string | null; crane_permit_required: boolean | null;
  aerial_platform_possible: string | null; parking_type: string | null;
  parking_available: boolean | null; parking_costs: boolean | null; parking_cost_per_day: number | null;
  direct_roof_material_supply: boolean | null; building_in_use: boolean | null;
  power_available: string | null; water_available: string | null; notes: string | null;
  version: number; deleted_at: string | null;
};

export const nieuweId = () => crypto.randomUUID();

// Fouten van de server in gewoon Nederlands.
function vertaal(fout: { code?: string; message?: string }): string {
  switch (fout.code) {
    case 'R3014': return 'Iemand anders heeft dit intussen gewijzigd. Open het opnieuw en probeer het nog eens.';
    case 'R3015': return 'Dit is intussen verwijderd.';
    case 'R3016': return 'Dit is te groot om op te slaan.';
    case 'R3006': return 'Dit gebouw hoort niet bij je bedrijf.';
    case '42501': return 'Je hebt geen rechten om dit op te slaan. Vraag je beheerder om de rol opnemer of planner.';
    case '23505': return 'Dit bestaat al (bijvoorbeeld hetzelfde klantnummer).';
    case '23514': return 'Niet alles is goed ingevuld (bijvoorbeeld een lege naam).';
  }
  if (/failed to fetch|network/i.test(fout.message ?? '')) return 'Geen verbinding met de server. Controleer je internet.';
  return `Opslaan lukte niet: ${fout.message ?? 'onbekende fout'}`;
}

// Een record opslaan. Alleen de meegegeven velden veranderen.
// Met verwachteVersie weigert de server als iemand anders het intussen wijzigde.
export async function bewaar<T>(tenantId: string, tabel: string, record: Record<string, unknown> & { id: string },
  verwachteVersie?: number): Promise<T> {
  const { data, error } = await supabase.rpc('save_record', {
    p_tenant_id: tenantId,
    p_mutation_id: nieuweId(),
    p_table: tabel,
    p_record: record,
    p_expected_version: verwachteVersie ?? null,
  });
  if (error) throw new Error(vertaal(error));
  return data as T;
}

export async function verwijder(tenantId: string, tabel: string, id: string, verwachteVersie?: number) {
  const { error } = await supabase.rpc('delete_record', {
    p_tenant_id: tenantId, p_mutation_id: nieuweId(), p_table: tabel, p_id: id,
    p_expected_version: verwachteVersie ?? null,
  });
  if (error) throw new Error(vertaal(error));
}

async function lees<T>(vraag: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await vraag;
  if (error) throw new Error(vertaal(error));
  return data as T;
}

export const haalProjecten = (tenantId: string, gebouwId?: string) => {
  let v = supabase.from('projects').select('*').eq('tenant_id', tenantId).is('deleted_at', null)
    .order('updated_at', { ascending: false }).limit(500);
  if (gebouwId) v = v.eq('building_id', gebouwId);
  return lees<Project[]>(v);
};
export const haalProject = (id: string) =>
  lees<Project | null>(supabase.from('projects').select('*').eq('id', id).is('deleted_at', null).maybeSingle());
export const haalRelaties = (tenantId: string) =>
  lees<Relatie[]>(supabase.from('parties').select('*').eq('tenant_id', tenantId).is('deleted_at', null)
    .eq('is_archived', false).order('company_name').limit(1000));
export const haalProjectRelaties = (projectId: string) =>
  lees<ProjectRelatie[]>(supabase.from('project_parties').select('*').eq('project_id', projectId).is('deleted_at', null));
export const haalRelatie = (id: string) =>
  lees<Relatie | null>(supabase.from('parties').select('*').eq('id', id).maybeSingle());
export const haalAlgemeneOpname = (projectId: string) =>
  lees<AlgemeneOpname | null>(supabase.from('project_general_surveys').select('*').eq('project_id', projectId)
    .is('deleted_at', null).maybeSingle());

// Keuzelijsten, met dezelfde waarden als de iOS-app (ProjectGeneralSurvey.swift).
export const keuzes = {
  status: [['not_reviewed', 'Nog niet bekeken'], ['in_progress', 'Bezig'], ['completed', 'Klaar']],
  bereikbaarheid: [['good', 'Goed'], ['limited', 'Beperkt']],
  toegang: [['roof_hatch', 'Dakluik'], ['door', 'Deur'], ['adjacent_roof', 'Via aangrenzend dak'],
    ['folding_ladder', 'Vlizotrap'], ['long_ladder', 'Lange ladder'], ['stair_tower', 'Trappentoren'], ['other', 'Anders']],
  kraan: [['yes', 'Ja'], ['no', 'Nee'], ['to_be_determined', 'Nog bepalen']],
  hoogwerker: [['yes', 'Ja'], ['no', 'Nee'], ['not_applicable', 'N.v.t.']],
  parkeren: [['open_private_site', 'Eigen terrein'], ['paid_parking', 'Betaald parkeren'], ['not_applicable', 'N.v.t.']],
  voorziening: [['yes', 'Ja'], ['no', 'Nee'], ['unknown', 'Onbekend']],
} as const;
export const label = (lijst: readonly (readonly [string, string])[], waarde: string | null | undefined) =>
  lijst.find(([w]) => w === waarde)?.[1] ?? '';
