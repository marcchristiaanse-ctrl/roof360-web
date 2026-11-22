// Roof360 Service: een werkbon zoals de monteur hem ziet. Nog alleen lezen;
// afwerken (bevindingen, foto's, handtekening, offline) volgt zodra opslaan op de server klaar is.
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonPage,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adresRegel } from '../../gegevens';
import { useBedrijf } from '../../useBedrijf';
import { Melding, NietIngelogd } from '../../pages/Gebouwen';
import { Regel } from './MeldingScherm';
import {
  haalWerkbon, haalWerkbonRegels, regelSoortNaam, tijdKort, werkbonStatusNaam,
  type Werkbon, type WerkbonRegel,
} from './gegevens';
import '../../pages/Account.css';
import '../../pages/Gebouwen.css';
import './service.css';

export default function WerkbonScherm() {
  const { id } = useParams<{ id: string }>();
  const { sessie, laden, bedrijf } = useBedrijf();
  const [werkbon, setWerkbon] = useState<Werkbon | null | undefined>(undefined);
  const [regels, setRegels] = useState<WerkbonRegel[]>([]);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!bedrijf) return;
    Promise.all([haalWerkbon(id), haalWerkbonRegels(id)])
      .then(([w, r]) => { setWerkbon(w); setRegels(r); })
      .catch(e => setFout(e.message));
  }, [bedrijf?.tenant_id, id]);

  const tekst = (label: string, waarde: string | null) => waarde ? (
    <>
      <div className="r360-section">{label}</div>
      <IonList inset><IonItem><IonLabel className="ion-text-wrap">{waarde}</IonLabel></IonItem></IonList>
    </>
  ) : null;

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
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : fout ? <Melding tekst={fout} />
            : werkbon === undefined ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : werkbon === null ? <Melding tekst="Deze werkbon bestaat niet (meer)." />
            : (
              <>
                <h1 className="r360-paginakop">{werkbon.title}</h1>
                <IonList inset>
                  <IonItem button detail routerLink={`/gebouwen/${werkbon.building_id}`}>
                    <IonLabel>Gebouw</IonLabel>
                    <IonNote slot="end" className="r360-waarde">{adresRegel(werkbon.building as never)}</IonNote>
                  </IonItem>
                  <Regel label="Status" waarde={werkbonStatusNaam[werkbon.status]} />
                  {werkbon.planned_start && <Regel label="Gepland" waarde={tijdKort(werkbon.planned_start)} />}
                  {werkbon.repair_type && <Regel label="Reparatie" waarde={werkbon.repair_type === 'temporary' ? 'Noodreparatie' : 'Definitief'} />}
                </IonList>
                {tekst('Opdracht', werkbon.instructions)}
                {tekst('Bevindingen', werkbon.findings)}
                {tekst('Oorzaak', werkbon.cause)}
                {tekst('Uitgevoerde werkzaamheden', werkbon.work_performed)}
                {werkbon.follow_up_needed && tekst('Vervolgactie nodig', werkbon.follow_up_note || 'Ja')}

                {regels.length > 0 && (
                  <>
                    <div className="r360-section">Uren en materiaal</div>
                    <IonList inset>
                      {regels.map(r => (
                        <IonItem key={r.id}>
                          <IonLabel>
                            <h2>{r.description}</h2>
                            <p>{regelSoortNaam[r.line_type]}{r.work_date ? ` · ${r.work_date}` : ''}</p>
                          </IonLabel>
                          <IonNote slot="end">{String(r.quantity).replace('.', ',')} {r.unit ?? ''}</IonNote>
                        </IonItem>
                      ))}
                    </IonList>
                  </>
                )}

                {werkbon.signed_at && (
                  <IonList inset>
                    <Regel label="Getekend door" waarde={`${werkbon.signed_by_name ?? ''} · ${tijdKort(werkbon.signed_at)}`} />
                  </IonList>
                )}
                <p className="r360-uitleg">Afwerken op de telefoon (bevindingen, foto's, handtekening, ook zonder internet) komt in de volgende stap.</p>
              </>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}
