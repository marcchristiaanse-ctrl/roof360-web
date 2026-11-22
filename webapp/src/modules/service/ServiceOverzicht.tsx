// Roof360 Service: overzicht voor kantoor en monteur. Drie tabs: inbox, meldingen, werkbonnen.
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonPage,
  IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToolbar, useIonViewWillEnter, IonButton, IonIcon,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useWachtrij } from './opslaan';
import { useCallback, useEffect, useState } from 'react';
import { adresRegel } from '../../gegevens';
import { useBedrijf } from '../../useBedrijf';
import { Melding, NietIngelogd } from '../../pages/Gebouwen';
import {
  haalInbox, haalMeldingen, haalWerkbonnen, isOpen, kanaalNaam, meldingStatusNaam, sorteerOpUrgentie,
  tijdKort, urgentieNaam, werkbonStatusNaam, type InboxBericht, type ServiceMelding, type Werkbon,
} from './gegevens';
import '../../pages/Account.css';
import '../../pages/Gebouwen.css';
import './service.css';

type Tab = 'inbox' | 'meldingen' | 'werkbonnen';

export default function ServiceOverzicht() {
  const { sessie, laden, fout: bedrijfFout, bedrijf } = useBedrijf();
  const [tab, setTab] = useState<Tab>('meldingen');
  const [inbox, setInbox] = useState<InboxBericht[] | null>(null);
  const [meldingen, setMeldingen] = useState<ServiceMelding[] | null>(null);
  const [werkbonnen, setWerkbonnen] = useState<Werkbon[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const ophalen = useCallback(() => {
    if (!bedrijf) return;
    setFout(null);
    const t = bedrijf.tenant_id;
    Promise.all([haalInbox(t), haalMeldingen(t), haalWerkbonnen(t)])
      .then(([i, m, w]) => { setInbox(i); setMeldingen(m); setWerkbonnen(w); })
      .catch(e => setFout(e.message));
  }, [bedrijf?.tenant_id]);
  useEffect(ophalen, [ophalen]);
  useIonViewWillEnter(ophalen, [ophalen]);

  const wachtrij = useWachtrij();
  const open = sorteerOpUrgentie((meldingen ?? []).filter(isOpen));
  const openWerkbonnen = (werkbonnen ?? []).filter(w => !['completed', 'invoiced', 'cancelled'].includes(w.status));

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/" text="Start" /></IonButtons>
          <IonTitle>Calamiteiten</IonTitle>
          {bedrijf && (
            <IonButtons slot="end">
              <IonButton routerLink="/calamiteiten/nieuwe-melding" aria-label="Nieuwe melding"><IonIcon icon={add} /></IonButton>
            </IonButtons>
          )}
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={tab} onIonChange={e => setTab(e.detail.value as Tab)}>
            <IonSegmentButton value="inbox"><IonLabel>Inbox{inbox?.length ? ` (${inbox.length})` : ''}</IonLabel></IonSegmentButton>
            <IonSegmentButton value="meldingen"><IonLabel>Meldingen{open.length ? ` (${open.length})` : ''}</IonLabel></IonSegmentButton>
            <IonSegmentButton value="werkbonnen"><IonLabel>Werkbonnen</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          <WachtrijBalk {...wachtrij} />
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : bedrijfFout ? <Melding tekst={bedrijfFout} />
            : !bedrijf ? <Melding tekst="Je bent nog geen actief lid van een bedrijf." />
            : fout ? <Melding tekst={fout} />
            : meldingen === null ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : tab === 'inbox' ? <InboxLijst lijst={inbox ?? []} />
            : tab === 'meldingen' ? <MeldingenLijst lijst={open} />
            : <WerkbonnenLijst lijst={openWerkbonnen} />}
        </div>
      </IonContent>
    </IonPage>
  );
}

function InboxLijst({ lijst }: { lijst: InboxBericht[] }) {
  if (lijst.length === 0) return <Melding tekst="Geen nieuwe berichten. Meldingen per mail, WhatsApp, formulier of koppeling komen hier binnen." />;
  return (
    <>
      <div className="r360-section">Nog te verwerken · {lijst.length} · tik om er een melding van te maken</div>
      <IonList inset>
        {lijst.map(b => (
          <IonItem key={b.id} button detail routerLink={`/calamiteiten/nieuwe-melding?bericht=${b.id}`}>
            <IonLabel>
              <h2 className="r360-row-title">{b.subject || b.sender_name || b.sender_email || b.sender_phone || 'Bericht'}</h2>
              <p>{[b.sender_name, b.sender_email, b.sender_phone].filter(Boolean).join(' · ')}</p>
              {b.body && <p className="r360-service__body">{b.body}</p>}
            </IonLabel>
            <IonNote slot="end">{kanaalNaam[b.channel]}<br />{tijdKort(b.received_at)}</IonNote>
          </IonItem>
        ))}
      </IonList>
    </>
  );
}

export function MeldingenLijst({ lijst, zonderGebouw }: { lijst: ServiceMelding[]; zonderGebouw?: boolean }) {
  if (lijst.length === 0) return <Melding tekst="Geen open meldingen." />;
  return (
    <>
      <div className="r360-section">Open meldingen · {lijst.length}</div>
      <IonList inset>
        {lijst.map(m => (
          <IonItem key={m.id} button detail routerLink={`/calamiteiten/meldingen/${m.id}`}>
            <span slot="start" className={`r360-urgentie r360-urgentie--${m.urgency}`}>{urgentieNaam[m.urgency]}</span>
            <IonLabel>
              <h2 className="r360-row-title">{zonderGebouw ? m.description : adresRegel(m.building as never)}</h2>
              {!zonderGebouw && <p>{m.description}</p>}
              <p>{m.number} · {tijdKort(m.reported_at)}</p>
            </IonLabel>
            <IonNote slot="end">{meldingStatusNaam[m.status]}</IonNote>
          </IonItem>
        ))}
      </IonList>
    </>
  );
}

export function WerkbonnenLijst({ lijst }: { lijst: Werkbon[] }) {
  if (lijst.length === 0) return <Melding tekst="Geen open werkbonnen." />;
  return (
    <>
      <div className="r360-section">Werkbonnen · {lijst.length}</div>
      <IonList inset>
        {lijst.map(w => (
          <IonItem key={w.id} button detail routerLink={`/calamiteiten/werkbonnen/${w.id}`}>
            <IonLabel>
              <h2 className="r360-row-title">{w.title}</h2>
              <p>{adresRegel(w.building as never)}</p>
              <p>{w.number}{w.planned_start ? ` · ${tijdKort(w.planned_start)}` : ''}</p>
            </IonLabel>
            <IonNote slot="end">{werkbonStatusNaam[w.status]}</IonNote>
          </IonItem>
        ))}
      </IonList>
    </>
  );
}

export function WachtrijBalk({ aantal, online, fouten }: { aantal: number; online: boolean; fouten: string[] }) {
  if (online && aantal === 0 && fouten.length === 0) return null;
  return (
    <IonList inset>
      {!online && <IonItem><IonLabel className="ion-text-wrap">Geen internet. Je kunt doorwerken; wijzigingen worden verstuurd zodra er weer verbinding is.</IonLabel></IonItem>}
      {aantal > 0 && <IonItem><IonLabel className="ion-text-wrap">{aantal} wijziging{aantal === 1 ? '' : 'en'} wacht{aantal === 1 ? '' : 'en'} op verzending.</IonLabel></IonItem>}
      {fouten.map((f, i) => <IonItem key={i}><IonLabel color="danger" className="ion-text-wrap">Niet verstuurd: {f}</IonLabel></IonItem>)}
    </IonList>
  );
}
