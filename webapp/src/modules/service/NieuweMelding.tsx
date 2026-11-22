// Roof360 Service: nieuwe melding invoeren (kantoor). Gebouw is leidend: eerst het gebouw.
// Vanuit de inbox (?bericht=...) worden afzender en tekst alvast ingevuld.
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList, IonPage,
  IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonSpinner, IonText, IonTextarea, IonTitle,
  IonToggle, IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { adresRegel, gebouwTitel, haalGebouwen, type GebouwLink } from '../../gegevens';
import { nieuweId } from '../../opslaan';
import { useBedrijf } from '../../useBedrijf';
import { Melding, NietIngelogd } from '../../pages/Gebouwen';
import { haalInbox, urgentieNaam, type InboxBericht, type Urgentie } from './gegevens';
import { bewaarService, nieuwNummer } from './opslaan';
import '../../pages/Account.css';
import '../../pages/Gebouwen.css';
import './service.css';

export default function NieuweMelding() {
  const history = useHistory();
  const zoekParams = new URLSearchParams(useLocation().search);
  const berichtId = zoekParams.get('bericht');
  const { sessie, laden, bedrijf } = useBedrijf();
  const [gebouwen, setGebouwen] = useState<GebouwLink[] | null>(null);
  const [bericht, setBericht] = useState<InboxBericht | null>(null);
  const [zoek, setZoek] = useState('');
  const [gebouwId, setGebouwId] = useState(zoekParams.get('gebouw') ?? '');
  const [omschrijving, setOmschrijving] = useState('');
  const [waar, setWaar] = useState('');
  const [urgentie, setUrgentie] = useState<Urgentie>('normal');
  const [naam, setNaam] = useState('');
  const [telefoon, setTelefoon] = useState('');
  const [mail, setMail] = useState('');
  const [metWerkbon, setMetWerkbon] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!bedrijf) return;
    Promise.all([haalGebouwen(bedrijf.tenant_id), berichtId ? haalInbox(bedrijf.tenant_id) : Promise.resolve([])])
      .then(([g, inbox]) => {
        setGebouwen(g);
        const b = inbox.find(x => x.id === berichtId) ?? null;
        setBericht(b);
        if (b) {
          setOmschrijving([b.subject, b.body].filter(Boolean).join('\n'));
          setNaam(b.sender_name ?? ''); setTelefoon(b.sender_phone ?? ''); setMail(b.sender_email ?? '');
        }
      })
      .catch(e => setFout(e.message));
  }, [bedrijf?.tenant_id, berichtId]);

  const gekozen = gebouwen?.find(g => g.building?.id === gebouwId) ?? null;
  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase().replace(/\s+/g, '');
    if (!gebouwen || !z) return [];
    return gebouwen.filter(l => [gebouwTitel(l), adresRegel(l.building), l.building?.postal_code]
      .some(t => t?.toLowerCase().replace(/\s+/g, '').includes(z))).slice(0, 8);
  }, [gebouwen, zoek]);

  async function opslaan(e: FormEvent) {
    e.preventDefault();
    if (!bedrijf || !gekozen?.building) return;
    setFout(null); setBezig(true);
    try {
      const t = bedrijf.tenant_id;
      const meldingId = nieuweId();
      await bewaarService(t, 'service_incidents', {
        id: meldingId, building_id: gekozen.building.id, number: nieuwNummer('M'),
        description: omschrijving.trim(), location_note: waar.trim() || null, urgency: urgentie,
        contact_name: naam.trim() || null, contact_phone: telefoon.trim() || null, contact_email: mail.trim() || null,
        channel: bericht?.channel ?? 'manual', intake_message_id: bericht?.id ?? null,
        status: metWerkbon ? 'planned' : 'new', client_created_at: new Date().toISOString(),
      });
      if (bericht) {
        await bewaarService(t, 'service_intake_messages', { id: bericht.id, status: 'processed', incident_id: meldingId });
      }
      if (metWerkbon) {
        await bewaarService(t, 'work_orders', {
          id: nieuweId(), building_id: gekozen.building.id, source_module: 'service', incident_id: meldingId,
          number: nieuwNummer('W'), title: omschrijving.trim().split('\n')[0].slice(0, 120) || 'Lekkage',
          instructions: [waar.trim() && `Plek: ${waar.trim()}`, omschrijving.trim()].filter(Boolean).join('\n'),
          status: 'planned', client_created_at: new Date().toISOString(),
        });
      }
      history.replace(`/calamiteiten/meldingen/${meldingId}`);
    } catch (err) {
      setFout((err as Error).message);
    } finally { setBezig(false); }
  }

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/calamiteiten" text="Annuleer" /></IonButtons>
          <IonTitle>Nieuwe melding</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <form className="r360-form__body" onSubmit={opslaan}>
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : gebouwen === null && !fout ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : (
              <>
                <div className="r360-section">Gebouw</div>
                {gekozen ? (
                  <IonList inset>
                    <IonItem button detail={false} onClick={() => setGebouwId('')}>
                      <IonLabel><h2 className="r360-row-title">{gebouwTitel(gekozen)}</h2><p>Tik om een ander gebouw te kiezen</p></IonLabel>
                    </IonItem>
                  </IonList>
                ) : (
                  <>
                    <IonSearchbar placeholder="Zoek op adres of postcode" value={zoek}
                      onIonInput={e => setZoek(String(e.detail.value ?? ''))} />
                    {zichtbaar.length > 0 && (
                      <IonList inset>
                        {zichtbaar.map(l => (
                          <IonItem key={l.id} button onClick={() => setGebouwId(l.building!.id)}>
                            <IonLabel><h2>{gebouwTitel(l)}</h2><p>{l.building?.roof360_building_id}</p></IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    )}
                    {zoek && zichtbaar.length === 0 && <Melding tekst="Geen gebouw gevonden. Koppel het gebouw eerst via Gebouwen." />}
                  </>
                )}

                <div className="r360-section">Melding</div>
                <IonSegment value={urgentie} onIonChange={e => setUrgentie(e.detail.value as Urgentie)} className="r360-service__segment">
                  {(['emergency', 'within_24h', 'normal'] as Urgentie[]).map(u => (
                    <IonSegmentButton key={u} value={u}><IonLabel>{urgentieNaam[u]}</IonLabel></IonSegmentButton>
                  ))}
                </IonSegment>
                <IonList inset>
                  <IonItem>
                    <IonTextarea label="Wat is er aan de hand?" labelPlacement="stacked" autoGrow rows={3} required
                      value={omschrijving} onIonInput={e => setOmschrijving(String(e.detail.value ?? ''))} />
                  </IonItem>
                  <IonItem>
                    <IonInput label="Waar in het gebouw" labelPlacement="stacked" placeholder="Bijvoorbeeld boven de kantine"
                      value={waar} onIonInput={e => setWaar(String(e.detail.value ?? ''))} />
                  </IonItem>
                </IonList>

                <div className="r360-section">Contact ter plaatse</div>
                <IonList inset>
                  <IonItem><IonInput label="Naam" value={naam} onIonInput={e => setNaam(String(e.detail.value ?? ''))} /></IonItem>
                  <IonItem><IonInput label="Telefoon" type="tel" value={telefoon} onIonInput={e => setTelefoon(String(e.detail.value ?? ''))} /></IonItem>
                  <IonItem><IonInput label="Mail" type="email" value={mail} onIonInput={e => setMail(String(e.detail.value ?? ''))} /></IonItem>
                </IonList>

                <IonList inset>
                  <IonItem>
                    <IonToggle checked={metWerkbon} onIonChange={e => setMetWerkbon(e.detail.checked)}>Direct een werkbon maken</IonToggle>
                  </IonItem>
                </IonList>

                {fout && <IonText color="danger"><p className="r360-uitleg">{fout}</p></IonText>}
                <div className="r360-form__actions">
                  <IonButton expand="block" type="submit" disabled={bezig || !gekozen || !omschrijving.trim()}>
                    {bezig ? <IonSpinner name="crescent" /> : 'Melding opslaan'}
                  </IonButton>
                </div>
              </>
            )}
        </form>
      </IonContent>
    </IonPage>
  );
}
