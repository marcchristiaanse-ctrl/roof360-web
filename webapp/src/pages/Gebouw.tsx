// Eén gebouw: adres, daktekening en de versies ervan.
// Op de tekening kun je een lijn aantikken en de echte maat invullen: dan schaalt alles mee.
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote,
  IonPage, IonSpinner, IonTitle, IonToolbar, IonButton,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import { IonInput, IonText } from '@ionic/react';
import { lijnen, naam, zelfdeLijn, type Lijn } from '../components/DakTekening';
import { afwijking, controleerMaat, procent, schaalFactor, TOEGESTANE_AFWIJKING, type Monster } from '../schaal';
import { leesGetal } from '../components/GetalInvoer';
import { bewaarTekening } from '../opslaan';
import { useParams } from 'react-router-dom';
import { DakTekening, oppervlakte } from '../components/DakTekening';
import {
  adresRegel, besteVersie, bronNaam, gebouwTitel, haalGebouw, haalTekening, haalVersies,
  type GebouwLink, type MeetLijn, type Tekening, type TekeningVersie,
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
  const [tekening, setTekening] = useState<Tekening | null>(null);
  // Met de hand gemeten lijnen; wijzigingen blijven eerst hier tot je op Opslaan tikt.
  const [metingen, setMetingen] = useState<MeetLijn[]>([]);
  const [gewijzigd, setGewijzigd] = useState(false);
  const [lijn, setLijn] = useState<Lijn | null>(null);
  const [maat, setMaat] = useState('');
  const [maatFout, setMaatFout] = useState<string | null>(null);
  const [opslaan, setOpslaan] = useState<'bezig' | 'klaar' | null>(null);
  const [herladen, setHerladen] = useState(0);
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
        setGewijzigd(false);
      })
      .then(() => haalProjecten(bedrijf.tenant_id, id).then(p => actief && setProjecten(p)).catch(() => setProjecten([])))
      .catch(e => actief && setFout(e.message));
    return () => { actief = false; };
  }, [bedrijf?.tenant_id, id, herladen]);

  useEffect(() => {
    if (!gekozen) { setTekening(null); return; }
    let actief = true;
    setTekening(null);
    setLijn(null); setMaat(''); setMaatFout(null);
    haalTekening(gekozen).then(t => {
      if (!actief) return;
      setTekening(t); setMetingen(t.detectie?.measuredEdges ?? []); setGewijzigd(false);
    }).catch(e => actief && setFout(e.message));
    return () => { actief = false; };
  }, [gekozen]);

  const versie = versies.find(v => v.id === gekozen);
  const b = link?.building;

  // Alleen metingen op lijnen die nog in de tekening staan tellen mee (zoals in de iOS-app).
  const delen = tekening?.detectie?.parts ?? [];
  const alleLijnen = useMemo(() => lijnen(delen), [delen]);
  const actief = metingen
    .map(m => ({ m, l: alleLijnen.find(l => zelfdeLijn(l, m.start, m.end)) }))
    .filter((x): x is { m: MeetLijn; l: Lijn } => !!x.l);
  const monster = (x: { m: MeetLijn; l: Lijn }): Monster => ({ gemeten: x.m.lengthMeters, getekend: x.l.lengte });
  const schaal = actief.length ? schaalFactor(actief.map(monster)) : (versie?.scale_factor ?? 1);
  const afwijkend = actief.filter(x => !x.m.isDeviationConfirmed && afwijking(monster(x), schaal) > TOEGESTANE_AFWIJKING);
  const lijnMeting = lijn ? metingen.find(m => zelfdeLijn(lijn, m.start, m.end)) : undefined;
  const totaal = delen.filter(d => d.kind === 'roof').reduce((t, d) => t + oppervlakte(d, schaal, tekening?.dakvlakken ?? []), 0);

  function kiesLijn(l: Lijn) {
    setLijn(l); setMaatFout(null); setOpslaan(null);
    const m = metingen.find(x => zelfdeLijn(l, x.start, x.end));
    setMaat(m ? String(m.lengthMeters).replace('.', ',') : '');
  }
  function maatZetten() {
    if (!lijn) return;
    const g = leesGetal(maat);
    const f = controleerMaat(g, lijn.lengte);
    if (f) { setMaatFout(f); return; }
    const oud = metingen.find(x => zelfdeLijn(lijn, x.start, x.end));
    setMetingen([...metingen.filter(x => x !== oud),
      { start: lijn.start, end: lijn.end, lengthMeters: g!, measuredAt: oud?.measuredAt ?? new Date().toISOString(), isDeviationConfirmed: false }]);
    setGewijzigd(true); setLijn(null); setMaat(''); setMaatFout(null);
  }
  function maatWissen() {
    if (!lijn) return;
    setMetingen(metingen.filter(x => !zelfdeLijn(lijn, x.start, x.end)));
    setGewijzigd(true); setLijn(null); setMaat('');
  }
  function bevestig(m: MeetLijn) {
    setMetingen(metingen.map(x => x === m ? { ...x, isDeviationConfirmed: true } : x));
    setGewijzigd(true);
  }
  async function tekeningOpslaan() {
    if (!bedrijf || !b || !tekening?.detectie || !versie) return;
    setOpslaan('bezig'); setFout(null);
    try {
      const detectie = { ...tekening.detectie, measuredEdges: metingen };
      await bewaarTekening(bedrijf.tenant_id, b.id, {
        source_type: versie.source_type === 'measured' ? 'measured' : metingen.length || detectie.isEdited ? 'corrected' : versie.source_type,
        source_app: 'measure_web',
        bag_pand_id: versie.bag_pand_id ?? detectie.pandID ?? null,
        detection_json: detectie,
        original_detection_json: tekening.origineel ?? null,
        roof_planes_json: tekening.dakvlakken,
        scale_factor: schaal,
        total_area_m2: totaal,
        client_created_at: new Date().toISOString(),
      });
      setOpslaan('klaar'); setHerladen(h => h + 1);
    } catch (e) { setFout((e as Error).message); setOpslaan(null); }
  }

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
                        : tekening.detectie ? <DakTekening detectie={tekening.detectie} schaal={schaal} dakvlakken={tekening.dakvlakken}
                            metingen={metingen} gekozen={lijn} onKiesLijn={kiesLijn} waarschuwing={afwijkend.map(x => x.m)} />
                        : <p className="r360-leeg">Deze versie heeft geen tekening om te tonen.</p>}
                    </div>
                    {tekening?.detectie && delen.length > 0 && (
                      <>
                        <p className="r360-uitleg">
                          {lijn ? 'Vul de echte lengte van de blauwe lijn in.' : 'Tik op een lijn in de tekening en vul de echte maat in. Alle andere lijnen en oppervlaktes schalen dan mee.'}
                        </p>
                        {lijn && (
                          <IonList inset>
                            <IonItem>
                              <IonLabel>Volgens de tekening</IonLabel>
                              <IonNote slot="end">{(lijn.lengte * schaal).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} m</IonNote>
                            </IonItem>
                            <IonItem>
                              <IonInput label="Echte maat (m)" type="text" inputmode="decimal" value={maat} autofocus
                                onIonInput={e => setMaat(String(e.detail.value ?? ''))}
                                onKeyDown={e => e.key === 'Enter' && maatZetten()} />
                              <IonButton slot="end" size="small" onClick={maatZetten} disabled={!maat}>Klaar</IonButton>
                            </IonItem>
                            {maatFout && <IonItem><IonText color="danger" className="r360-small">{maatFout}</IonText></IonItem>}
                            <IonItem>
                              {lijnMeting && <IonButton fill="clear" color="danger" size="small" onClick={maatWissen}>Maat wissen</IonButton>}
                              <IonButton slot="end" fill="clear" size="small" onClick={() => { setLijn(null); setMaatFout(null); }}>Annuleren</IonButton>
                            </IonItem>
                          </IonList>
                        )}
                        <IonList inset>
                          <IonItem>
                            <IonLabel>Schaal</IonLabel>
                            <IonNote slot="end">{actief.length === 0 ? 'Nog geen maat ingevuld'
                              : `${schaal.toLocaleString('nl-NL', { maximumFractionDigits: 4 })} · uit ${actief.length} ${actief.length === 1 ? 'maat' : 'maten'}`}</IonNote>
                          </IonItem>
                          {afwijkend.map(x => (
                            <IonItem key={x.m.start.x + ',' + x.m.start.y}>
                              <IonLabel className="ion-text-wrap">
                                <IonText className="r360-waarschuwing"><p>Deze maat ({x.m.lengthMeters.toLocaleString('nl-NL')} m) wijkt {procent(afwijking(monster(x), schaal))} af van de schaal
                                  (verwacht {(x.l.lengte * schaal).toLocaleString('nl-NL', { maximumFractionDigits: 2 })} m). Controleer de lijn en de maat.</p></IonText>
                              </IonLabel>
                              <IonButton slot="end" size="small" fill="outline" onClick={() => bevestig(x.m)}>Klopt</IonButton>
                            </IonItem>
                          ))}
                        </IonList>
                        {(gewijzigd || opslaan === 'klaar') && (
                          <div className="r360-form__actions">
                            <IonButton expand="block" onClick={tekeningOpslaan} disabled={!gewijzigd || opslaan === 'bezig'}>
                              {opslaan === 'bezig' ? <IonSpinner name="crescent" /> : gewijzigd ? 'Maten opslaan (nieuwe versie)' : 'Opgeslagen ✓'}
                            </IonButton>
                          </div>
                        )}
                      </>
                    )}
                    {tekening?.detectie?.parts && (
                      <IonList inset>
                        {tekening.detectie.parts.map(d => (
                          <IonItem key={`${d.kind}-${d.number}`}>
                            <IonLabel>{naam(d)}</IonLabel>
                            <IonNote slot="end">{Math.round(oppervlakte(d, schaal, tekening.dakvlakken))} m²</IonNote>
                          </IonItem>
                        ))}
                        {(versie?.total_area_m2 != null || totaal > 0) && (
                          <IonItem>
                            <IonLabel className="r360-row-title">Totaal daken</IonLabel>
                            <IonNote slot="end" className="r360-row-title">{Math.round(gewijzigd ? totaal : versie?.total_area_m2 ?? totaal)} m²</IonNote>
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
