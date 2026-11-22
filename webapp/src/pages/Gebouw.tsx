// Eén gebouw: adres, daktekening en de versies ervan. Alleen lezen.
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote,
  IonPage, IonSpinner, IonTitle, IonToolbar, IonButton,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DakTekening, oppervlakte } from '../components/DakTekening';
import {
  adresRegel, besteVersie, bronNaam, gebouwTitel, haalGebouw, haalTekening, haalVersies,
  type DakvlakSamenvatting, type Detectie, type GebouwLink, type TekeningVersie,
} from '../gegevens';
import { useBedrijf } from '../useBedrijf';
import { haalProjecten, type Project } from '../opslaan';
import { datumKort } from './Projecten';
import { Melding, NietIngelogd } from './Gebouwen';
import './Account.css';
import './Gebouwen.css';

const datum = (iso: string) =>
  new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Gebouw() {
  const { id } = useParams<{ id: string }>();
  const { sessie, laden, fout: bedrijfFout, bedrijf } = useBedrijf();
  const [link, setLink] = useState<GebouwLink | null | undefined>(undefined);
  const [versies, setVersies] = useState<TekeningVersie[]>([]);
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [tekening, setTekening] = useState<{ detectie: Detectie | null; dakvlakken: DakvlakSamenvatting[] } | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [projecten, setProjecten] = useState<Project[]>([]);

  useEffect(() => {
    if (!bedrijf) return;
    let actief = true;
    setFout(null); setLink(undefined);
    Promise.all([haalGebouw(bedrijf.tenant_id, id), haalVersies(bedrijf.tenant_id, id)])
      .then(([l, v]) => {
        if (!actief) return;
        setLink(l); setVersies(v); setGekozen(besteVersie(v)?.id ?? null);
      })
      .then(() => haalProjecten(bedrijf.tenant_id, id).then(p => actief && setProjecten(p)).catch(() => setProjecten([])))
      .catch(e => actief && setFout(e.message));
    return () => { actief = false; };
  }, [bedrijf?.tenant_id, id]);

  useEffect(() => {
    if (!gekozen) { setTekening(null); return; }
    let actief = true;
    setTekening(null);
    haalTekening(gekozen).then(t => actief && setTekening(t)).catch(e => actief && setFout(e.message));
    return () => { actief = false; };
  }, [gekozen]);

  const versie = versies.find(v => v.id === gekozen);
  const schaal = versie?.scale_factor ?? 1;
  const b = link?.building;

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/gebouwen" text="Gebouwen" /></IonButtons>
          <IonTitle>Gebouw</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : bedrijfFout ? <Melding tekst={bedrijfFout} />
            : fout ? <Melding tekst={fout} />
            : link === undefined ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !link || !b ? <Melding tekst="Dit gebouw is niet gevonden bij je bedrijf." />
            : (
              <>
                <h1 className="r360-paginakop">{gebouwTitel(link)}</h1>
                <div className="r360-section">Gebouw</div>
                <IonList inset>
                  <Rij label="Adres" waarde={adresRegel(b)} />
                  {b.name && <Rij label="Naam" waarde={b.name} />}
                  {b.complex_name && <Rij label="Complex" waarde={b.complex_name} />}
                  <Rij label="Roof360-code" waarde={b.roof360_building_id} />
                  {versie?.bag_pand_id && <Rij label="BAG-pand" waarde={versie.bag_pand_id} />}
                  {b.latitude != null && b.longitude != null && (
                    <IonItem href={`https://www.openstreetmap.org/?mlat=${b.latitude}&mlon=${b.longitude}#map=19/${b.latitude}/${b.longitude}`} target="_blank" detail>
                      <IonLabel>Op de kaart</IonLabel>
                    </IonItem>
                  )}
                </IonList>

                <div className="r360-section">Projecten bij dit gebouw</div>
                {projecten.length > 0 && (
                  <IonList inset>
                    {projecten.map(p => (
                      <IonItem key={p.id} button detail routerLink={`/projecten/${p.id}`}>
                        <IonLabel><h2 className="r360-row-title">{p.name}</h2><p>{p.organization_name_snapshot}</p></IonLabel>
                        <IonNote slot="end">{datumKort(p.updated_at)}</IonNote>
                      </IonItem>
                    ))}
                  </IonList>
                )}
                <div className="r360-form__actions">
                  <IonButton expand="block" fill="outline" routerLink={`/nieuw-project?gebouw=${b.id}`}>Nieuw project bij dit gebouw</IonButton>
                </div>

                <div className="r360-section">Daktekening</div>
                {versies.length === 0 ? (
                  <Melding tekst="Voor dit gebouw is nog geen daktekening opgeslagen." />
                ) : (
                  <>
                    <div className="r360-tekening-kader">
                      {!tekening ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
                        : tekening.detectie ? <DakTekening detectie={tekening.detectie} schaal={schaal} dakvlakken={tekening.dakvlakken} />
                        : <p className="r360-leeg">Deze versie heeft geen tekening om te tonen.</p>}
                    </div>
                    {tekening?.detectie?.parts && (
                      <IonList inset>
                        {tekening.detectie.parts.map(d => (
                          <IonItem key={`${d.kind}-${d.number}`}>
                            <IonLabel>{d.customName?.trim() || (d.kind === 'roof' ? `Dak ${d.number}` : `Luifel ${d.number}`)}</IonLabel>
                            <IonNote slot="end">{Math.round(oppervlakte(d, schaal, tekening.dakvlakken))} m²</IonNote>
                          </IonItem>
                        ))}
                        {versie?.total_area_m2 != null && (
                          <IonItem>
                            <IonLabel className="r360-row-title">Totaal daken</IonLabel>
                            <IonNote slot="end" className="r360-row-title">{Math.round(versie.total_area_m2)} m²</IonNote>
                          </IonItem>
                        )}
                      </IonList>
                    )}

                    <div className="r360-section">Versies</div>
                    <IonList inset>
                      {versies.map(v => (
                        <IonItem key={v.id} button detail={false} onClick={() => setGekozen(v.id)}
                          className={v.id === gekozen ? 'r360-gekozen' : ''}>
                          <IonLabel>
                            <h2 className="r360-row-title">Versie {v.version_number} · {bronNaam[v.source_type]}</h2>
                            <p>{datum(v.created_at)}{v.state === 'published' ? ' · huidige' : ''}</p>
                          </IonLabel>
                          {v.id === gekozen && <IonNote slot="end">Getoond</IonNote>}
                        </IonItem>
                      ))}
                    </IonList>
                  </>
                )}
              </>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}

function Rij({ label, waarde }: { label: string; waarde: string }) {
  return (
    <IonItem>
      <IonLabel>{label}</IonLabel>
      <IonNote slot="end" className="r360-waarde">{waarde}</IonNote>
    </IonItem>
  );
}
