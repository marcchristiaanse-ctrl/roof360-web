// Roof360 Service: werkbon afwerken op de telefoon van de monteur.
// Werkt ook zonder internet: de werkbon komt uit de laatst geladen kopie en wijzigingen gaan
// in de wachtrij (zie opslaan.ts). Prijzen, rijtijd en materiaal uit een artikellijst volgen.
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList,
  IonNote, IonPage, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonText,
  IonTextarea, IonTitle, IonToggle, IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adresRegel } from '../../gegevens';
import { nieuweId } from '../../opslaan';
import { useBedrijf } from '../../useBedrijf';
import { Melding, NietIngelogd } from '../../pages/Gebouwen';
import { Regel } from './MeldingScherm';
import { WachtrijBalk } from './ServiceOverzicht';
import {
  haalWerkbon, haalWerkbonRegels, regelSoortNaam, tijdKort, werkbonStatusNaam,
  type Werkbon, type WerkbonRegel, type WerkbonStatus,
} from './gegevens';
import { bewaarKopie, bewaarService, leesKopie, useWachtrij } from './opslaan';
import '../../pages/Account.css';
import '../../pages/Gebouwen.css';
import './service.css';

const stappen: WerkbonStatus[] = ['planned', 'en_route', 'on_site', 'completed'];
const tekstVelden = [
  ['findings', 'Bevindingen'], ['cause', 'Oorzaak'], ['work_performed', 'Uitgevoerde werkzaamheden'],
] as const;

export default function WerkbonScherm() {
  const { id } = useParams<{ id: string }>();
  const { sessie, laden, bedrijf } = useBedrijf();
  const wachtrij = useWachtrij();
  const [werkbon, setWerkbon] = useState<Werkbon | null | undefined>(undefined);
  const [regels, setRegels] = useState<WerkbonRegel[]>([]);
  const [uitKopie, setUitKopie] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bericht, setBericht] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  // Nieuwe regel
  const [soort, setSoort] = useState<WerkbonRegel['line_type']>('labour');
  const [omschrijving, setOmschrijving] = useState('');
  const [aantal, setAantal] = useState('');
  const [eenheid, setEenheid] = useState('uur');
  const [tekenaar, setTekenaar] = useState('');

  useEffect(() => {
    if (!bedrijf) return;
    Promise.all([haalWerkbon(id), haalWerkbonRegels(id)])
      .then(([w, r]) => { setWerkbon(w); setRegels(r); setUitKopie(false); bewaarKopie(`werkbon.${id}`, { w, r }); })
      .catch(e => {
        const kopie = leesKopie<{ w: Werkbon; r: WerkbonRegel[] }>(`werkbon.${id}`);
        if (kopie) { setWerkbon(kopie.w); setRegels(kopie.r); setUitKopie(true); } else setFout(e.message);
      });
  }, [bedrijf?.tenant_id, id]);

  // Wijziging opslaan en meteen op het scherm tonen (ook als hij nog in de wachtrij staat).
  async function wijzig(velden: Partial<Werkbon>) {
    if (!bedrijf || !werkbon) return;
    setFout(null); setBericht(null); setBezig(true);
    try {
      const r = await bewaarService<Werkbon>(bedrijf.tenant_id, 'work_orders', { id: werkbon.id, ...velden });
      const nieuw = r.opgeslagen ? { ...werkbon, ...r.rij, building: werkbon.building } : { ...werkbon, ...velden };
      setWerkbon(nieuw); bewaarKopie(`werkbon.${id}`, { w: nieuw, r: regels });
      setBericht(r.opgeslagen ? 'Opgeslagen.' : 'Bewaard op dit apparaat; wordt verstuurd zodra er internet is.');
    } catch (e) { setFout((e as Error).message); } finally { setBezig(false); }
  }

  async function regelToevoegen() {
    if (!bedrijf || !werkbon) return;
    const hoeveel = Number(aantal.replace(',', '.'));
    if (!omschrijving.trim() || !(hoeveel >= 0)) { setFout('Vul een omschrijving en een aantal in.'); return; }
    const regel: WerkbonRegel = { id: nieuweId(), line_type: soort, description: omschrijving.trim(),
      quantity: hoeveel, unit: eenheid.trim() || null, work_date: new Date().toISOString().slice(0, 10) };
    setFout(null); setBezig(true);
    try {
      await bewaarService(bedrijf.tenant_id, 'work_order_lines', { ...regel, work_order_id: werkbon.id });
      const nieuw = [...regels, regel];
      setRegels(nieuw); bewaarKopie(`werkbon.${id}`, { w: werkbon, r: nieuw });
      setOmschrijving(''); setAantal('');
    } catch (e) { setFout((e as Error).message); } finally { setBezig(false); }
  }

  const afgerond = werkbon && ['completed', 'invoiced', 'cancelled'].includes(werkbon.status);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={werkbon?.incident_id ? `/calamiteiten/meldingen/${werkbon.incident_id}` : '/calamiteiten'} text="Terug" />
          </IonButtons>
          <IonTitle>{werkbon?.number ?? 'Werkbon'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          <WachtrijBalk {...wachtrij} />
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : fout && werkbon === undefined ? <Melding tekst={fout} />
            : werkbon === undefined ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : werkbon === null ? <Melding tekst="Deze werkbon bestaat niet (meer)." />
            : (
              <>
                <h1 className="r360-paginakop">{werkbon.title}</h1>
                {uitKopie && <p className="r360-uitleg">Je ziet de laatst geladen versie (geen verbinding).</p>}
                <IonList inset>
                  <IonItem button detail routerLink={`/gebouwen/${werkbon.building_id}`}>
                    <IonLabel>Gebouw</IonLabel>
                    <IonNote slot="end" className="r360-waarde">{adresRegel(werkbon.building as never)}</IonNote>
                  </IonItem>
                  {werkbon.planned_start && <Regel label="Gepland" waarde={tijdKort(werkbon.planned_start)} />}
                </IonList>
                {werkbon.instructions && (
                  <>
                    <div className="r360-section">Opdracht</div>
                    <IonList inset><IonItem><IonLabel className="ion-text-wrap">{werkbon.instructions}</IonLabel></IonItem></IonList>
                  </>
                )}

                <div className="r360-section">Status · {werkbonStatusNaam[werkbon.status]}</div>
                <IonSegment value={werkbon.status} disabled={bezig || werkbon.status === 'invoiced'} className="r360-service__segment"
                  onIonChange={e => {
                    const s = e.detail.value as WerkbonStatus;
                    if (s !== werkbon.status) wijzig({ status: s, completed_at: s === 'completed' ? new Date().toISOString() : werkbon.completed_at });
                  }}>
                  {stappen.map(s => <IonSegmentButton key={s} value={s}><IonLabel>{werkbonStatusNaam[s]}</IonLabel></IonSegmentButton>)}
                </IonSegment>

                <div className="r360-section">Verslag</div>
                <IonList inset>
                  {tekstVelden.map(([veld, label]) => (
                    <IonItem key={veld}>
                      <IonTextarea label={label} labelPlacement="stacked" autoGrow rows={2} value={werkbon[veld] ?? ''}
                        onIonChange={e => { const v = String(e.detail.value ?? '').trim() || null; if (v !== werkbon[veld]) wijzig({ [veld]: v }); }} />
                    </IonItem>
                  ))}
                  <IonItem>
                    <IonSelect label="Reparatie" value={werkbon.repair_type} interface="action-sheet" placeholder="Kies"
                      onIonChange={e => wijzig({ repair_type: e.detail.value })}>
                      <IonSelectOption value="temporary">Noodreparatie</IonSelectOption>
                      <IonSelectOption value="permanent">Definitief</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem>
                    <IonToggle checked={werkbon.follow_up_needed} onIonChange={e => wijzig({ follow_up_needed: e.detail.checked })}>
                      Vervolgactie nodig
                    </IonToggle>
                  </IonItem>
                  {werkbon.follow_up_needed && (
                    <IonItem>
                      <IonTextarea label="Wat moet er nog gebeuren?" labelPlacement="stacked" autoGrow value={werkbon.follow_up_note ?? ''}
                        onIonChange={e => wijzig({ follow_up_note: String(e.detail.value ?? '').trim() || null })} />
                    </IonItem>
                  )}
                </IonList>

                <div className="r360-section">Uren en materiaal</div>
                {regels.length > 0 && (
                  <IonList inset>
                    {regels.map(r => (
                      <IonItem key={r.id}>
                        <IonLabel><h2>{r.description}</h2><p>{regelSoortNaam[r.line_type]}{r.work_date ? ` · ${r.work_date}` : ''}</p></IonLabel>
                        <IonNote slot="end">{String(r.quantity).replace('.', ',')} {r.unit ?? ''}</IonNote>
                      </IonItem>
                    ))}
                  </IonList>
                )}
                {!afgerond && (
                  <IonList inset>
                    <IonItem>
                      <IonSelect label="Soort" value={soort} interface="action-sheet"
                        onIonChange={e => { const s = e.detail.value; setSoort(s); setEenheid(s === 'labour' ? 'uur' : 'stuks'); }}>
                        <IonSelectOption value="labour">Uren</IonSelectOption>
                        <IonSelectOption value="material">Materiaal</IonSelectOption>
                        <IonSelectOption value="other">Overig</IonSelectOption>
                      </IonSelect>
                    </IonItem>
                    <IonItem><IonInput label="Omschrijving" value={omschrijving} onIonInput={e => setOmschrijving(String(e.detail.value ?? ''))} /></IonItem>
                    <IonItem><IonInput label="Aantal" inputmode="decimal" value={aantal} onIonInput={e => setAantal(String(e.detail.value ?? ''))} /></IonItem>
                    <IonItem><IonInput label="Eenheid" value={eenheid} onIonInput={e => setEenheid(String(e.detail.value ?? ''))} /></IonItem>
                    <IonItem button detail={false} disabled={bezig} onClick={regelToevoegen}>
                      <IonLabel color="primary">Regel toevoegen</IonLabel>
                    </IonItem>
                  </IonList>
                )}

                <div className="r360-section">Aftekenen</div>
                <IonList inset>
                  {werkbon.signed_at ? (
                    <Regel label="Getekend door" waarde={`${werkbon.signed_by_name ?? ''} · ${tijdKort(werkbon.signed_at)}`} />
                  ) : (
                    <>
                      <IonItem><IonInput label="Naam klant" value={tekenaar} onIonInput={e => setTekenaar(String(e.detail.value ?? ''))} /></IonItem>
                      <IonItem button detail={false} disabled={bezig || !tekenaar.trim()}
                        onClick={() => wijzig({ signed_by_name: tekenaar.trim(), signed_at: new Date().toISOString() })}>
                        <IonLabel color="primary">Laten aftekenen</IonLabel>
                      </IonItem>
                    </>
                  )}
                </IonList>

                {fout && <IonText color="danger"><p className="r360-uitleg">{fout}</p></IonText>}
                {bericht && <p className="r360-uitleg">{bericht}</p>}
                {!afgerond && (
                  <div className="r360-form__actions">
                    <IonButton expand="block" disabled={bezig}
                      onClick={() => wijzig({ status: 'completed', completed_at: new Date().toISOString() })}>
                      Werkbon afronden
                    </IonButton>
                  </div>
                )}
              </>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}
