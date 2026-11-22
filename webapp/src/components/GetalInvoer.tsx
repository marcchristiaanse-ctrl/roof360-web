// Getal invoeren met komma of punt (zoals je in Nederland typt). Houdt de getypte tekst zelf bij,
// zodat "12," niet verdwijnt terwijl je nog typt.
import { IonInput } from '@ionic/react';
import { useEffect, useState } from 'react';

export const leesGetal = (t: string): number | null => {
  const s = t.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) && n >= 0 ? n : null;
};

export function GetalInvoer({ label, waarde, onWijzig }: { label: string; waarde: number | null; onWijzig: (n: number | null) => void }) {
  const [tekst, setTekst] = useState(waarde == null ? '' : String(waarde).replace('.', ','));
  useEffect(() => {
    if (leesGetal(tekst) !== waarde) setTekst(waarde == null ? '' : String(waarde).replace('.', ','));
  }, [waarde]);
  return (
    <IonInput label={label} labelPlacement="stacked" type="text" inputmode="decimal" value={tekst}
      onIonInput={e => { const t = String(e.detail.value ?? ''); setTekst(t); onWijzig(leesGetal(t)); }} />
  );
}
