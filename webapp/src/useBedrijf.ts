// Wie is ingelogd en voor welk bedrijf tonen we gegevens.
import { useEffect, useState } from 'react';
import { actiefBedrijf, haalLidmaatschappen, kiesBedrijf, useSessie } from './gegevens';
import type { Lidmaatschap } from './supabase';

export function useBedrijf() {
  const sessie = useSessie();
  const [lidmaatschappen, setLidmaatschappen] = useState<Lidmaatschap[] | null>(null);
  const [bedrijfId, setBedrijfId] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!sessie) { setLidmaatschappen(null); setBedrijfId(null); return; }
    let actief = true;
    haalLidmaatschappen()
      .then(lijst => {
        if (!actief) return;
        setLidmaatschappen(lijst);
        setBedrijfId(actiefBedrijf(lijst)?.tenant_id ?? null);
      })
      .catch(e => actief && setFout(e.message));
    return () => { actief = false; };
  }, [sessie?.user.id]);

  const wissel = (id: string) => { kiesBedrijf(id); setBedrijfId(id); };
  const actieveLijst = (lidmaatschappen ?? []).filter(l => l.is_effective);
  return {
    sessie,
    laden: sessie === undefined || (!!sessie && lidmaatschappen === null && !fout),
    fout,
    bedrijven: actieveLijst,
    bedrijf: actieveLijst.find(l => l.tenant_id === bedrijfId),
    wissel,
  };
}
