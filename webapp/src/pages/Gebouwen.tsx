// Gebouwen van je bedrijf, alleen lezen uit Supabase (dezelfde als in de iOS-app).
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList,
  IonNote, IonPage, IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { adresRegel, besteVersie, bronNaam, gebouwTitel, haalGebouwen, haalVersies, type GebouwLink, type TekeningVersie } from '../gegevens';
import { useBedrijf } from '../useBedrijf';
import './Account.css';
import './Gebouwen.css';

export default function Gebouwen() {
  const { sessie, laden, fout: bedrijfFout, bedrijven, bedrijf, wissel } = useBedrijf();
  const [gebouwen, setGebouwen] = useState<GebouwLink[] | null>(null);
  const [versies, setVersies] = useState<Map<string, TekeningVersie>>(new Map());
  const [fout, setFout] = useState<string | null>(null);
  const [zoek, setZoek] = useState('');

  useEffect(() => {
    if (!bedrijf) { setGebouwen(null); return; }
    let actief = true;
    setFout(null); setGebouwen(null);
    Promise.all([haalGebouwen(bedrijf.tenant_id), haalVersies(bedrijf.tenant_id)])
      .then(([g, v]) => {
        if (!actief) return;
        const perGebouw = new Map<string, TekeningVersie[]>();
        v.forEach(x => perGebouw.set(x.building_id, [...(perGebouw.get(x.building_id) ?? []), x]));
        const beste = new Map<string, TekeningVersie>();
        perGebouw.forEach((lijst, id) => { const b = besteVersie(lijst); if (b) beste.set(id, b); });
        setGebouwen(g); setVersies(beste);
      })
      .catch(e => actief && setFout(e.message));
    return () => { actief = false; };
  }, [bedrijf?.tenant_id]);

  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase().replace(/\s+/g, '');
    if (!gebouwen) return [];
    if (!z) return gebouwen;
    return gebouwen.filter(l => {
      const b = l.building;
      return [gebouwTitel(l), adresRegel(b), b?.postal_code, b?.roof360_building_id, b?.city]
        .some(t => t?.toLowerCase().replace(/\s+/g, '').includes(z));
    });
  }, [gebouwen, zoek]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/" text="Start" /></IonButtons>
          <IonTitle>Gebouwen</IonTitle>
        </IonToolbar>
        {gebouwen && gebouwen.length > 0 && (
          <IonToolbar>
            <IonSearchbar placeholder="Zoek op adres, postcode of code" value={zoek}
              onIonInput={e => setZoek(String(e.detail.value ?? ''))} />
          </IonToolbar>
        )}
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {laden ? (
            <div className="r360-midden"><IonSpinner name="crescent" /></div>
          ) : !sessie ? (
            <NietIngelogd />
          ) : bedrijfFout ? (
            <Melding tekst={bedrijfFout} />
          ) : !bedrijf ? (
            <Melding tekst="Je bent nog geen actief lid van een bedrijf. Vraag je beheerder om een uitnodiging." />
          ) : (
            <>
              {bedrijven.length > 1 && (
                <IonList inset>
                  <IonItem>
                    <IonSelect label="Bedrijf" value={bedrijf.tenant_id} interface="action-sheet"
                      onIonChange={e => wissel(String(e.detail.value))}>
                      {bedrijven.map(b => <IonSelectOption key={b.tenant_id} value={b.tenant_id}>{b.tenant_name}</IonSelectOption>)}
                    </IonSelect>
                  </IonItem>
                </IonList>
              )}
              <div className="r360-section">
                {bedrijven.length > 1 ? 'Gebouwen' : `Gebouwen van ${bedrijf.tenant_name}`}
                {gebouwen && ` · ${gebouwen.length}`}
              </div>
              {fout ? <Melding tekst={fout} /> : gebouwen === null ? (
                <div className="r360-midden"><IonSpinner name="crescent" /></div>
              ) : gebouwen.length === 0 ? (
                <Melding tekst="Je bedrijf heeft nog geen gebouwen op de server. Gebouwen die je in de iOS-app koppelt, verschijnen hier vanzelf." />
              ) : zichtbaar.length === 0 ? (
                <Melding tekst="Geen gebouw gevonden met deze zoekterm." />
              ) : (
                <IonList inset>
                  {zichtbaar.map(l => {
                    const v = l.building && versies.get(l.building.id);
                    return (
                      <IonItem key={l.id} button detail routerLink={l.building ? `/gebouwen/${l.building.id}` : undefined}>
                        <IonLabel>
                          <h2 className="r360-row-title">{gebouwTitel(l)}</h2>
                          {l.local_display_name && <p>{adresRegel(l.building)}</p>}
                          <p>{l.building?.roof360_building_id}</p>
                        </IonLabel>
                        <IonNote slot="end" className={v ? 'r360-heeft-tekening' : ''}>
                          {v ? `${bronNaam[v.source_type]}${v.total_area_m2 ? ` · ${Math.round(v.total_area_m2)} m²` : ''}` : 'Geen tekening'}
                        </IonNote>
                      </IonItem>
                    );
                  })}
                </IonList>
              )}
              <p className="r360-uitleg">
                Alleen lezen: hier verandert niets aan je gegevens. Opnames (dakvlakken, details, foto's) staan nog
                alleen op je iPhone en komen later.
              </p>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

export function NietIngelogd() {
  return (
    <>
      <Melding tekst="Log eerst in om de gebouwen van je bedrijf te zien." />
      <div className="r360-form__actions">
        <IonButton expand="block" routerLink="/account">Naar inloggen</IonButton>
      </div>
    </>
  );
}

export function Melding({ tekst }: { tekst: string }) {
  return (
    <IonList inset>
      <IonItem><IonText className="r360-small">{tekst}</IonText></IonItem>
    </IonList>
  );
}
