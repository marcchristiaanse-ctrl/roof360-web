// Roof360 Service: een melding, met het gebouw en de werkbonnen die eraan hangen.
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonPage,
  IonSpinner, IonTitle, IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adresRegel } from '../../gegevens';
import { useBedrijf } from '../../useBedrijf';
import { Melding, NietIngelogd } from '../../pages/Gebouwen';
import { WerkbonnenLijst } from './ServiceOverzicht';
import {
  haalMelding, haalWerkbonnen, kanaalNaam, meldingStatusNaam, tijdKort, urgentieNaam,
  type ServiceMelding, type Werkbon,
} from './gegevens';
import '../../pages/Account.css';
import '../../pages/Gebouwen.css';
import './service.css';

export default function MeldingScherm() {
  const { id } = useParams<{ id: string }>();
  const { sessie, laden, bedrijf } = useBedrijf();
  const [melding, setMelding] = useState<ServiceMelding | null | undefined>(undefined);
  const [werkbonnen, setWerkbonnen] = useState<Werkbon[]>([]);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!bedrijf) return;
    Promise.all([haalMelding(id), haalWerkbonnen(bedrijf.tenant_id, { meldingId: id })])
      .then(([m, w]) => { setMelding(m); setWerkbonnen(w); })
      .catch(e => setFout(e.message));
  }, [bedrijf?.tenant_id, id]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/calamiteiten" text="Calamiteiten" /></IonButtons>
          <IonTitle>{melding?.number ?? 'Melding'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : fout ? <Melding tekst={fout} />
            : melding === undefined ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : melding === null ? <Melding tekst="Deze melding bestaat niet (meer)." />
            : (
              <>
                <h1 className="r360-paginakop">{adresRegel(melding.building as never)}</h1>
                <div className="r360-section">Gebouw</div>
                <IonList inset>
                  <IonItem button detail routerLink={`/gebouwen/${melding.building_id}`}>
                    <IonLabel>{adresRegel(melding.building as never)}</IonLabel>
                    <IonNote slot="end">{melding.building?.roof360_building_id}</IonNote>
                  </IonItem>
                </IonList>

                <div className="r360-section">Melding</div>
                <IonList inset>
                  <Regel label="Urgentie" waarde={urgentieNaam[melding.urgency]} klasse={`r360-urgentie r360-urgentie--${melding.urgency}`} />
                  <Regel label="Status" waarde={meldingStatusNaam[melding.status]} />
                  <Regel label="Gemeld" waarde={`${tijdKort(melding.reported_at)} · ${kanaalNaam[melding.channel]}`} />
                  <IonItem><IonLabel className="ion-text-wrap">{melding.description}</IonLabel></IonItem>
                  {melding.location_note && <Regel label="Waar" waarde={melding.location_note} />}
                  {melding.roof_plane_code && <Regel label="Dakvlak" waarde={melding.roof_plane_code} />}
                </IonList>

                {(melding.contact_name || melding.contact_phone || melding.contact_email) && (
                  <>
                    <div className="r360-section">Contact</div>
                    <IonList inset>
                      {melding.contact_name && <Regel label="Naam" waarde={melding.contact_name} />}
                      {melding.contact_phone && (
                        <IonItem href={`tel:${melding.contact_phone}`} detail={false}>
                          <IonLabel>Telefoon</IonLabel><IonNote slot="end">{melding.contact_phone}</IonNote>
                        </IonItem>
                      )}
                      {melding.contact_email && (
                        <IonItem href={`mailto:${melding.contact_email}`} detail={false}>
                          <IonLabel>Mail</IonLabel><IonNote slot="end">{melding.contact_email}</IonNote>
                        </IonItem>
                      )}
                    </IonList>
                  </>
                )}

                <WerkbonnenLijst lijst={werkbonnen} />
              </>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export function Regel({ label, waarde, klasse }: { label: string; waarde: string; klasse?: string }) {
  return (
    <IonItem>
      <IonLabel>{label}</IonLabel>
      <IonNote slot="end" className={`r360-waarde ${klasse ?? ''}`}>{waarde}</IonNote>
    </IonItem>
  );
}
