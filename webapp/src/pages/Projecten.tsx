// Projecten (opnames) van je bedrijf.
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList,
  IonNote, IonPage, IonSearchbar, IonSpinner, IonTitle, IonToolbar, useIonViewWillEnter,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { haalProjecten, type Project } from '../opslaan';
import { useBedrijf } from '../useBedrijf';
import { Melding, NietIngelogd } from './Gebouwen';
import './Account.css';
import './Gebouwen.css';

export const datumKort = (iso: string) =>
  new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Projecten() {
  const { sessie, laden, fout: bedrijfFout, bedrijf } = useBedrijf();
  const [projecten, setProjecten] = useState<Project[] | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');

  const ophalen = useCallback(() => {
    if (!bedrijf) return;
    setFout(null);
    haalProjecten(bedrijf.tenant_id).then(setProjecten).catch(e => setFout(e.message));
  }, [bedrijf?.tenant_id]);
  useEffect(ophalen, [ophalen]);
  useIonViewWillEnter(ophalen, [ophalen]); // na "Nieuw project" de lijst verversen

  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return (projecten ?? []).filter(p => !z ||
      [p.name, p.address, p.city, p.postal_code, p.order_reference, p.organization_name_snapshot]
        .some(t => t?.toLowerCase().includes(z)));
  }, [projecten, zoek]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/" text="Start" /></IonButtons>
          <IonTitle>Projecten</IonTitle>
          {bedrijf && (
            <IonButtons slot="end">
              <IonButton routerLink="/nieuw-project" aria-label="Nieuw project"><IonIcon icon={add} /></IonButton>
            </IonButtons>
          )}
        </IonToolbar>
        {projecten && projecten.length > 0 && (
          <IonToolbar>
            <IonSearchbar placeholder="Zoek op naam, adres of ordernummer" value={zoek}
              onIonInput={e => setZoek(String(e.detail.value ?? ''))} />
          </IonToolbar>
        )}
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : bedrijfFout ? <Melding tekst={bedrijfFout} />
            : !bedrijf ? <Melding tekst="Je bent nog geen actief lid van een bedrijf." />
            : fout ? <Melding tekst={fout} />
            : projecten === null ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : (
              <>
                <div className="r360-section">Projecten · {projecten.length}</div>
                {projecten.length === 0 ? (
                  <Melding tekst="Nog geen projecten op de server. Maak er een met de knop hieronder." />
                ) : zichtbaar.length === 0 ? (
                  <Melding tekst="Geen project gevonden met deze zoekterm." />
                ) : (
                  <IonList inset>
                    {zichtbaar.map(p => (
                      <IonItem key={p.id} button detail routerLink={`/projecten/${p.id}`}>
                        <IonLabel>
                          <h2 className="r360-row-title">{p.name}</h2>
                          <p>{[p.address, p.city].filter(Boolean).join(', ')}</p>
                          {p.organization_name_snapshot && <p>{p.organization_name_snapshot}</p>}
                        </IonLabel>
                        <IonNote slot="end">{datumKort(p.updated_at)}</IonNote>
                      </IonItem>
                    ))}
                  </IonList>
                )}
                <div className="r360-form__actions">
                  <IonButton expand="block" routerLink="/nieuw-project">Nieuw project</IonButton>
                </div>
                <p className="r360-uitleg">Projecten die je op je iPhone hebt gemaakt staan hier nog niet. Die blijven voorlopig op je iPhone.</p>
              </>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}
