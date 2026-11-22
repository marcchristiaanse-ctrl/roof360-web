// Verbinding met Supabase (project roof360-dev).
//
// Dit is de OPENBARE sleutel (anon key, rol "anon"). Die is bedoeld om in apps te staan;
// de iOS-app heeft dezelfde. De beveiliging zit in Supabase zelf (inloggen + RLS-regels).
// Zet hier NOOIT de service_role-sleutel of een andere geheime sleutel: deze repo is openbaar.
// Akkoord van Marc voor deze openbare sleutel: 14-11-2026.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ppfrmpdmjixpuhewfihd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZnJtcGRtaml4cHVoZXdmaWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODA1ODQsImV4cCI6MjEwNzA1NjU4NH0.p7-CR-8XUo1Cy8Yl2d-cXf8B7inuyOLroygRXV0jKTE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Lidmaatschap, zoals de iOS-app het ophaalt met de functie my_memberships.
export type Lidmaatschap = {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  role: string;
  is_effective: boolean;
};

// Foutmeldingen in gewoon Nederlands.
export function foutInHetNederlands(fout: unknown): string {
  const tekst = fout instanceof Error ? fout.message : String(fout ?? '');
  if (/invalid login credentials/i.test(tekst)) return 'E-mailadres of wachtwoord klopt niet.';
  if (/email not confirmed/i.test(tekst)) return 'Je e-mailadres is nog niet bevestigd. Kijk in je mail.';
  if (/failed to fetch|network/i.test(tekst)) return 'Geen verbinding met de server. Controleer je internet.';
  if (/rate limit|too many/i.test(tekst)) return 'Te veel pogingen. Wacht even en probeer het opnieuw.';
  return `Er ging iets mis: ${tekst}`;
}
