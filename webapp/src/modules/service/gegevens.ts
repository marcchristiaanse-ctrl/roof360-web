// Roof360 Service (calamiteiten): gegevens ophalen uit Supabase. ALLEEN LEZEN.
//
// Hier staat bewust geen slimme logica: deze repo is openbaar. Welke modules een bedrijf heeft,
// wie wat mag zien en de verwerking van binnenkomende meldingen regelt de server
// (zie migratie 0009 in Roof360Measure/supabase). De app toont alleen wat de server teruggeeft.
//
// Tabellen: service_intake_messages (inbox), service_incidents (meldingen),
//           work_orders + work_order_lines (werkbon, gedeeld met Maintenance).
import { useEffect, useState } from 'react';
import { supabase, foutInHetNederlands } from '../../supabase';
import { type Gebouw } from '../../gegevens';

export type Kanaal = 'manual' | 'form' | 'email' | 'whatsapp' | 'api';
export type Urgentie = 'emergency' | 'within_24h' | 'normal';
export type MeldingStatus = 'new' | 'planned' | 'in_progress' | 'resolved' | 'closed' | 'cancelled';
export type WerkbonStatus = 'draft' | 'planned' | 'en_route' | 'on_site' | 'completed' | 'invoiced' | 'cancelled';

export type InboxBericht = {
  id: string; channel: Kanaal; received_at: string;
  sender_name: string | null; sender_email: string | null; sender_phone: string | null;
  subject: string | null; body: string | null; external_reference: string | null;
  status: 'new' | 'processed' | 'ignored'; incident_id: string | null;
};

type GebouwKort = Pick<Gebouw, 'id' | 'name' | 'street' | 'house_number' | 'house_number_addition' |
  'postal_code' | 'city' | 'formatted_address' | 'roof360_building_id'>;

export type ServiceMelding = {
  id: string; number: string; building_id: string; reported_at: string; channel: Kanaal;
  contact_name: string | null; contact_phone: string | null; contact_email: string | null;
  description: string; location_note: string | null; roof_plane_code: string | null;
  urgency: Urgentie; status: MeldingStatus; resolved_at: string | null;
  building: GebouwKort | null;
};

export type Werkbon = {
  id: string; number: string; title: string; building_id: string; source_module: 'service' | 'maintenance';
  incident_id: string | null; instructions: string | null; status: WerkbonStatus;
  assigned_user_id: string | null; planned_start: string | null; planned_end: string | null;
  findings: string | null; cause: string | null; work_performed: string | null;
  repair_type: 'temporary' | 'permanent' | null; follow_up_needed: boolean; follow_up_note: string | null;
  signed_by_name: string | null; signed_at: string | null; completed_at: string | null;
  building: GebouwKort | null;
};

export type WerkbonRegel = {
  id: string; line_type: 'labour' | 'material' | 'other'; description: string;
  quantity: number; unit: string | null; work_date: string | null;
};

// Nederlandse namen, zelfde termen overal in Roof360.
export const kanaalNaam: Record<Kanaal, string> = {
  manual: 'Ingevoerd', form: 'Formulier', email: 'Mail', whatsapp: 'WhatsApp', api: 'Koppeling',
};
export const urgentieNaam: Record<Urgentie, string> = {
  emergency: 'Spoed', within_24h: 'Binnen 24 uur', normal: 'Normaal',
};
export const meldingStatusNaam: Record<MeldingStatus, string> = {
  new: 'Nieuw', planned: 'Ingepland', in_progress: 'In behandeling',
  resolved: 'Opgelost', closed: 'Gesloten', cancelled: 'Vervallen',
};
export const werkbonStatusNaam: Record<WerkbonStatus, string> = {
  draft: 'Concept', planned: 'Ingepland', en_route: 'Onderweg', on_site: 'Ter plaatse',
  completed: 'Afgerond', invoiced: 'Gefactureerd', cancelled: 'Vervallen',
};
export const regelSoortNaam: Record<WerkbonRegel['line_type'], string> = {
  labour: 'Uren', material: 'Materiaal', other: 'Overig',
};

const GEBOUW_KORT = 'building:buildings(id, name, street, house_number, house_number_addition, postal_code, city, formatted_address, roof360_building_id)';

// Fouten: als de tabellen er nog niet zijn (migratie 0009 nog niet toegepast) zeggen we dat gewoon.
function fout(e: { code?: string; message?: string }): Error {
  if (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202')
    return new Error('Roof360 Service is nog niet beschikbaar op de server.');
  if (e.code === '42501') return new Error('Roof360 Service staat niet aan voor je bedrijf.');
  return new Error(foutInHetNederlands(e.message ?? e));
}

async function lees<T>(vraag: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>): Promise<T> {
  const { data, error } = await vraag;
  if (error) throw fout(error);
  return data as T;
}

// Staat de module aan voor dit bedrijf? Bij elke fout: nee (dan tonen we de tegel niet).
export async function heeftService(tenantId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('my_modules', { p_tenant_id: tenantId });
  if (error) return false;
  return ((data ?? []) as { module_key: string }[]).some(m => m.module_key === 'service');
}

export const haalInbox = (tenantId: string) =>
  lees<InboxBericht[]>(supabase.from('service_intake_messages')
    .select('id, channel, received_at, sender_name, sender_email, sender_phone, subject, body, external_reference, status, incident_id')
    .eq('tenant_id', tenantId).eq('status', 'new').is('deleted_at', null)
    .order('received_at', { ascending: false }).limit(500));

const MELDING_VELDEN = 'id, number, building_id, reported_at, channel, contact_name, contact_phone, contact_email, ' +
  `description, location_note, roof_plane_code, urgency, status, resolved_at, ${GEBOUW_KORT}`;

export const haalMeldingen = (tenantId: string, gebouwId?: string) => {
  let v = supabase.from('service_incidents').select(MELDING_VELDEN)
    .eq('tenant_id', tenantId).is('deleted_at', null);
  if (gebouwId) v = v.eq('building_id', gebouwId);
  return lees<ServiceMelding[]>(v.order('reported_at', { ascending: false }).limit(1000));
};

export const haalMelding = (id: string) =>
  lees<ServiceMelding | null>(supabase.from('service_incidents').select(MELDING_VELDEN)
    .eq('id', id).is('deleted_at', null).maybeSingle());

const WERKBON_VELDEN = 'id, number, title, building_id, source_module, incident_id, instructions, status, ' +
  'assigned_user_id, planned_start, planned_end, findings, cause, work_performed, repair_type, ' +
  `follow_up_needed, follow_up_note, signed_by_name, signed_at, completed_at, ${GEBOUW_KORT}`;

export const haalWerkbonnen = (tenantId: string, filter?: { meldingId?: string }) => {
  let v = supabase.from('work_orders').select(WERKBON_VELDEN)
    .eq('tenant_id', tenantId).is('deleted_at', null);
  if (filter?.meldingId) v = v.eq('incident_id', filter.meldingId);
  return lees<Werkbon[]>(v.order('planned_start', { ascending: true, nullsFirst: false }).limit(1000));
};

export const haalWerkbon = (id: string) =>
  lees<Werkbon | null>(supabase.from('work_orders').select(WERKBON_VELDEN)
    .eq('id', id).is('deleted_at', null).maybeSingle());

export const haalWerkbonRegels = (werkbonId: string) =>
  lees<WerkbonRegel[]>(supabase.from('work_order_lines')
    .select('id, line_type, description, quantity, unit, work_date')
    .eq('work_order_id', werkbonId).is('deleted_at', null).order('created_at'));

// Open = nog niet opgelost, gesloten of vervallen. Spoed eerst, dan de oudste.
const rangUrgentie: Record<Urgentie, number> = { emergency: 0, within_24h: 1, normal: 2 };
export const isOpen = (m: ServiceMelding) => !['resolved', 'closed', 'cancelled'].includes(m.status);
export function sorteerOpUrgentie(lijst: ServiceMelding[]): ServiceMelding[] {
  return [...lijst].sort((a, b) =>
    rangUrgentie[a.urgency] - rangUrgentie[b.urgency] || a.reported_at.localeCompare(b.reported_at));
}

export const tijdKort = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '';

// Voor het thuisscherm: tegel alleen tonen als Service aan staat voor het gekozen bedrijf.
export function useServiceAan(tenantId: string | undefined): boolean {
  const [aan, setAan] = useState(false);
  useEffect(() => {
    if (!tenantId) { setAan(false); return; }
    let actief = true;
    heeftService(tenantId).then(a => actief && setAan(a));
    return () => { actief = false; };
  }, [tenantId]);
  return aan;
}
