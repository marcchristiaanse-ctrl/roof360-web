// Eén dakvlak: gegevens, meetwijze, meetpunten of overgenomen tekening, en dakranden.
// Bij de start kies je de meetwijze:
//   Emlid-meting      hoekpunten inmeten met de Emlid Reach RX2 (RTK) via de iPhone
//   Handmatige meting het dakvlak overnemen uit de daktekening en waar nodig corrigeren met meetlintmaten
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList,
  IonNote, IonPage, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  afschotTypes, bewaar, dakvlakTypes, haalDakranden, haalDakvlak, haalMeetpunten, haalNulpunt, haalProject, nieuweId, verwijder,
  type Dakrand, type Dakvlak, type Meetpunt, type Nulpunt,
} from '../opslaan';
import { afstand, kwaliteit, lokaal, meter, oppervlakte } from '../meetkunde';
import { useBedrijf } from '../useBedrijf';
import { GetalInvoer, leesGetal } from '../components/GetalInvoer';
import { afwijking, controleerMaat, procent, schaalFactor, TOEGESTANE_AFWIJKING, type Monster } from '../schaal';
import { Melding, NietIngelogd } from './Gebouwen';
import { besteVersie, haalTekening, haalVersies, type DakDeel, type Tekening, type TekeningVersie } from '../gegevens';
import { DakTekening, lijnen, naam, oppervlakte as deelOppervlakte, zelfdeLijn } from '../components/DakTekening';
import { RTK_NAUWKEURIGHEID, useLivePositie } from '../positie';

type GebouwTekening = { versie: TekeningVersie; tekening: Tekening; schaal: number };
import './Account.css';
import './Gebouwen.css';

type Velden = Pick<Dakvlak, 'code' | 'plane_type' | 'other_type_description' | 'free_description' | 'has_slope' | 'slope_type' | 'manual_gross_area_m2'>;

export default function DakvlakScherm() {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const { sessie, laden, fout: bedrijfFout, bedrijf } = useBedrijf();
  const [dakvlak, setDakvlak] = useState<Dakvlak | null | undefined>(undefined);
  const [velden, setVelden] = useState<Velden | null>(null);
  const [gewijzigd, setGewijzigd] = useState(false);
  const [punten, setPunten] = useState<Meetpunt[]>([]);
  const [randen, setRanden] = useState<Dakrand[]>([]);
  const [nulpunt, setNulpunt] = useState<Nulpunt | null>(null);
  const [bezig, setBezig] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [handLengte, setHandLengte] = useState('');
  const [bewerkRand, setBewerkRand] = useState<string | null>(null);
  const [randMaat, setRandMaat] = useState('');
  // Daktekening van het gebouw bij dit project (voor de handmatige meting). null = geen tekening.
  const [gebouw, setGebouw] = useState<GebouwTekening | null | undefined>(undefined);

  const ophalen = useCallback(async () => {
    try {
      const [d, p, r, n] = await Promise.all([haalDakvlak(id), haalMeetpunten(id), haalDakranden(id), haalNulpunt(projectId)]);
      setDakvlak(d); setPunten(p); setRanden(r); setNulpunt(n);
      if (d) setVelden({ code: d.code, plane_type: d.plane_type, other_type_description: d.other_type_description,
        free_description: d.free_description, has_slope: d.has_slope, slope_type: d.slope_type, manual_gross_area_m2: d.manual_gross_area_m2 });
      setGewijzigd(false);
    } catch (e) { setFout((e as Error).message); }
  }, [id, projectId]);
  useEffect(() => { if (bedrijf) ophalen(); }, [bedrijf?.tenant_id, ophalen]);

  useEffect(() => {
    if (!bedrijf) return;
    let aan = true;
    (async () => {
      const project = await haalProject(projectId);
      if (!project?.building_id) return null;
      const versie = besteVersie(await haalVersies(bedrijf.tenant_id, project.building_id));
      if (!versie) return null;
      const tekening = await haalTekening(versie.id);
      if (!tekening.detectie?.parts?.length) return null;
      // Schaal van het gebouw: uit de gemeten lijnen op de tekening, anders wat de versie zegt.
      const alle = lijnen(tekening.detectie.parts);
      const m = (tekening.detectie.measuredEdges ?? []).flatMap(e => {
        const l = alle.find(x => zelfdeLijn(x, e.start, e.end));
        return l ? [{ gemeten: e.lengthMeters, getekend: l.lengte }] : [];
      });
      return { versie, tekening, schaal: m.length ? schaalFactor(m) : versie.scale_factor ?? 1 };
    })().then(g => aan && setGebouw(g)).catch(e => { console.warn('Tekening laden lukte niet', e); if (aan) setGebouw(null); });
    return () => { aan = false; };
  }, [bedrijf?.tenant_id, projectId]);

  const t = bedrijf?.tenant_id ?? '';
  const zet = <K extends keyof Velden>(k: K, v: Velden[K]) => { setVelden(o => o && { ...o, [k]: v }); setGewijzigd(true); };

  async function doe(wat: string, actie: () => Promise<void>) {
    setBezig(wat); setFout(null);
    try { await actie(); await ophalen(); } catch (e) { setFout((e as Error).message); } finally { setBezig(null); }
  }

  const gegevensOpslaan = () => doe('gegevens', async () => {
    if (!dakvlak || !velden) return;
    await bewaar(t, 'roof_planes', { id: dakvlak.id, ...velden,
      gross_area_source: velden.manual_gross_area_m2 != null ? 'manual' : dakvlak.gross_area_source }, dakvlak.version);
  });

  // Meetwijze. Oudere dakvlakken met punten maar zonder meetwijze tellen als Emlid-meting.
  const methode = dakvlak?.measurement_method ?? (punten.length ? 'emlid' : null);
  const gesloten = dakvlak?.contour_status === 'closed';
  // Live positie alleen aan tijdens het inmeten (scheelt batterij).
  const live = useLivePositie(methode === 'emlid' && !gesloten);

  const kiesEmlid = () => doe('methode', async () => {
    if (!dakvlak) return;
    await bewaar(t, 'roof_planes', { id: dakvlak.id, measurement_method: 'emlid' }, dakvlak.version);
  });

  // Handmatige meting: een deel van de daktekening overnemen als dakvlak. De randen krijgen de
  // lengte uit de tekening (op de schaal van het gebouw); met een meetlintmaat corrigeer je alles.
  const neemOver = (deel: DakDeel) => doe('overnemen', async () => {
    if (!dakvlak || !gebouw) return;
    const ring = deel.rings[0];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const lengte = Math.hypot(a.x - b.x, a.y - b.y) * gebouw.schaal;
      if (lengte < 0.01) continue;
      await bewaar(t, 'roof_edges', { id: nieuweId(), roof_plane_id: dakvlak.id, sequence_number: i + 1, code: `R${i + 1}`,
        length_m: Math.round(lengte * 1000) / 1000, source: 'manual', measurement_source: 'bag_reference',
        source_description: `Uit daktekening versie ${gebouw.versie.version_number}`,
        bag_reference_pand_id: gebouw.versie.bag_pand_id, bag_reference_edge_id: `${deel.kind}-${deel.number}:${i}` });
    }
    await bewaar(t, 'roof_planes', { id: dakvlak.id, measurement_method: 'manual', detected_part_id: `${deel.kind}-${deel.number}`,
      roof_model_version_id: gebouw.versie.id, contour_status: 'closed', gross_area_source: 'geometry',
      calculated_area_m2: Math.round(deelOppervlakte(deel, gebouw.schaal, []) * 100) / 100,
      measurement_status: 'in_progress', scale_factor: null }, dakvlak.version);
  });

  // Terug naar de keuze (kan alleen zolang er geen punten gemeten zijn).
  const meetwijzeWijzigen = () => doe('methode', async () => {
    if (!dakvlak || punten.length) return;
    for (const r of randen.filter(r => r.measurement_source === 'bag_reference')) await verwijder(t, 'roof_edges', r.id, r.version);
    await bewaar(t, 'roof_planes', { id: dakvlak.id, measurement_method: null, detected_part_id: null, roof_model_version_id: null,
      contour_status: 'open', calculated_area_m2: null, scale_factor: null }, dakvlak.version);
  });

  // Punt meten. Met de Emlid Reach via de iPhone komt hier de RTK-positie binnen.
  // toch = ook vastleggen als het geen RTK-kwaliteit is (bijvoorbeeld om te oefenen).
  const puntMeten = (toch = false) => doe('meten', async () => {
    if (!dakvlak) return;
    if (!live.laatste) throw new Error(live.fout ?? 'Nog geen positie. Wacht even.');
    if (!live.klaar && !toch) throw new Error(live.reden);
    const c = live.laatste;
    const pos = { timestamp: c.tijd };
    const vorige = punten[punten.length - 1];
    const volgnummer = Math.max(0, ...punten.map(p => p.sequence_number)) + 1;
    // Eerste punt van het project: dat wordt het vaste nulpunt.
    if (!nulpunt) {
      await bewaar(t, 'project_geometry_references', { id: nieuweId(), project_id: projectId,
        origin_latitude: c.latitude, origin_longitude: c.longitude, origin_altitude: c.altitude });
    }
    await bewaar(t, 'measurement_points', {
      id: nieuweId(), roof_plane_id: dakvlak.id, sequence_number: volgnummer, point_code: `P${volgnummer}`,
      latitude: c.latitude, longitude: c.longitude, altitude: c.altitude, horizontal_accuracy: c.accuracy,
      vertical_accuracy: c.altitudeAccuracy, measured_at: new Date(pos.timestamp).toISOString(),
      distance_from_previous_point: vorige ? afstand(vorige, c) : null,
      // zelfde waarden als de iOS-app: RTK-kwaliteit = Emlid, anders gewone locatie
      measurement_source: c.accuracy <= RTK_NAUWKEURIGHEID ? 'reach_rx2_rtk' : 'core_location', position_source: 'device',
      client_created_at: new Date().toISOString(),
    });
    if (dakvlak.measurement_status === 'not_started' || !dakvlak.measurement_method) {
      await bewaar(t, 'roof_planes', { id: dakvlak.id, measurement_status: 'in_progress', measurement_method: 'emlid' });
    }
  });

  const puntWeg = (p: Meetpunt) => doe('weg-' + p.id, () => verwijder(t, 'measurement_points', p.id, p.version));

  // Contour sluiten: dakranden tussen opeenvolgende punten en de oppervlakte berekenen.
  const contourSluiten = () => doe('sluiten', async () => {
    if (!dakvlak || punten.length < 3) return;
    const oud = randen.filter(r => r.source === 'measured');
    for (const r of oud) await verwijder(t, 'roof_edges', r.id, r.version);
    const nieuw: Monster[] = [];
    const start = Math.max(0, ...randen.filter(r => r.source === 'manual').map(r => r.sequence_number));
    for (let i = 0; i < punten.length; i++) {
      const a = punten[i], b = punten[(i + 1) % punten.length];
      const lengte = Math.round(afstand(a, b) * 1000) / 1000;
      // Een meetlintmaat op dezelfde rand (zelfde twee punten) blijft behouden.
      const vorig = oud.find(r => r.checked_length_m != null &&
        ((r.start_point_id === a.id && r.end_point_id === b.id) || (r.start_point_id === b.id && r.end_point_id === a.id)));
      if (vorig?.checked_length_m) nieuw.push({ gemeten: vorig.checked_length_m, getekend: lengte });
      await bewaar(t, 'roof_edges', { id: nieuweId(), roof_plane_id: dakvlak.id, sequence_number: start + i + 1,
        code: `R${i + 1}`, length_m: lengte, source: 'measured',
        measurement_source: a.measurement_source === 'reach_rx2_rtk' || b.measurement_source === 'reach_rx2_rtk' ? 'reach_rx2_rtk' : 'core_location',
        measured_at: new Date().toISOString(), start_point_id: a.id, end_point_id: b.id,
        checked_length_m: vorig?.checked_length_m ?? null, deviation_confirmed: vorig?.deviation_confirmed ?? false });
    }
    await bewaar(t, 'roof_planes', { id: dakvlak.id, contour_status: 'closed', scale_factor: nieuw.length ? Math.round(schaalFactor(nieuw) * 1e6) / 1e6 : null,
      calculated_area_m2: Math.round(oppervlakte(punten) * 100) / 100,
      gross_area_source: dakvlak.manual_gross_area_m2 != null ? dakvlak.gross_area_source : 'geometry' }, dakvlak.version);
  });

  const contourOpenen = () => doe('openen', async () => {
    if (!dakvlak) return;
    await bewaar(t, 'roof_planes', { id: dakvlak.id, contour_status: 'open' }, dakvlak.version);
  });

  const handmatigeRand = () => doe('hand', async () => {
    if (!dakvlak) return;
    const l = leesGetal(handLengte);
    if (l == null || !(l > 0)) throw new Error('Vul een lengte in meters in, bijvoorbeeld 12,5.');
    const volg = Math.max(0, ...randen.map(r => r.sequence_number)) + 1;
    await bewaar(t, 'roof_edges', { id: nieuweId(), roof_plane_id: dakvlak.id, sequence_number: volg,
      code: `R${volg}`, length_m: l, source: 'manual' });
    setHandLengte('');
  });

  const randWeg = (r: Dakrand) => doe('rand-' + r.id, () => verwijder(t, 'roof_edges', r.id, r.version));

  // Op schaal: randen uit de meetpunten met een meetlintmaat bepalen samen één schaal.
  // Alle gemeten randen x schaal, de oppervlakte x schaal x schaal. De GPS-punten blijven de bron.
  // Schaalbaar: randen uit de meetpunten of uit de tekening. Een met de hand ingevulde rand niet.
  const schaalbaar = (r: Dakrand) => r.source === 'measured' || r.measurement_source === 'bag_reference';
  const monster = (r: Dakrand): Monster => ({ gemeten: r.checked_length_m!, getekend: r.length_m });
  const metMaat = randen.filter(r => schaalbaar(r) && r.checked_length_m != null);
  const schaal = metMaat.length ? schaalFactor(metMaat.map(monster)) : 1;
  const opSchaal = (r: Dakrand) => !schaalbaar(r) ? r.length_m : r.checked_length_m ?? r.length_m * schaal;
  const wijktAf = (r: Dakrand) => r.checked_length_m != null && !r.deviation_confirmed && afwijking(monster(r), schaal) > TOEGESTANE_AFWIJKING;

  // Na een nieuwe maat de schaal opnieuw uitrekenen en bij het dakvlak bewaren.
  async function schaalBewaren(nieuweRanden: Dakrand[]) {
    if (!dakvlak) return;
    const m = nieuweRanden.filter(r => schaalbaar(r) && r.checked_length_m != null).map(monster);
    const f = m.length ? Math.round(schaalFactor(m) * 1e6) / 1e6 : null;
    if (f !== dakvlak.scale_factor) await bewaar(t, 'roof_planes', { id: dakvlak.id, scale_factor: f }, dakvlak.version);
  }
  const randMaatZetten = (r: Dakrand, wissen = false) => doe('maat-' + r.id, async () => {
    const g = wissen ? null : leesGetal(randMaat);
    if (!wissen) { const f = controleerMaat(g, r.length_m); if (f) throw new Error(f); }
    await bewaar(t, 'roof_edges', { id: r.id, checked_length_m: g, deviation_confirmed: false }, r.version);
    await schaalBewaren(randen.map(x => x.id === r.id ? { ...x, checked_length_m: g } : x));
    setBewerkRand(null); setRandMaat('');
  });
  const afwijkingBevestigen = (r: Dakrand) => doe('ok-' + r.id, () =>
    bewaar(t, 'roof_edges', { id: r.id, deviation_confirmed: true }, r.version).then(() => undefined));

  // Randen als lijnen voor de tekening, zodat je ze in de tekening kunt aantikken.
  const segmenten: Segment[] = (() => {
    if (methode === 'manual') {
      const deel = gebouw?.tekening.detectie?.parts?.find(d => `${d.kind}-${d.number}` === dakvlak?.detected_part_id);
      const ring = deel?.rings[0] ?? [];
      return randen.flatMap(r => {
        const i = Number(r.bag_reference_edge_id?.split(':')[1]);
        return r.measurement_source === 'bag_reference' && ring[i] ? [{ rand: r, a: ring[i], b: ring[(i + 1) % ring.length] }] : [];
      });
    }
    if (punten.length === 0) return [];
    const xy = (pid: string | null) => { const p = punten.find(q => q.id === pid); return p ? lokaal(p, punten[0]) : null; };
    return randen.flatMap(r => { const a = xy(r.start_point_id), b = xy(r.end_point_id); return a && b ? [{ rand: r, a, b }] : []; });
  })();
  const [vanaf, setVanaf] = useState<'tekening' | 'lijst'>('lijst');
  const kiesRand = (r: Dakrand, waar: 'tekening' | 'lijst' = 'lijst') => {
    setVanaf(waar);
    setBewerkRand(bewerkRand === r.id && vanaf === waar ? null : r.id);
    setRandMaat(r.checked_length_m != null ? String(r.checked_length_m).replace('.', ',') : '');
  };
  const maatInvoer = (r: Dakrand) => (
    <IonItem>
      <IonInput label={`Meetlintmaat ${r.code} (m)`} type="text" inputmode="decimal" value={randMaat}
        onIonInput={e => setRandMaat(String(e.detail.value ?? ''))}
        onKeyDown={e => e.key === 'Enter' && randMaatZetten(r)} />
      {r.checked_length_m != null && <IonButton slot="end" size="small" fill="clear" color="danger" disabled={!!bezig} onClick={() => randMaatZetten(r, true)}>Wissen</IonButton>}
      <IonButton slot="end" size="small" disabled={!randMaat || !!bezig} onClick={() => randMaatZetten(r)}>
        {bezig === 'maat-' + r.id ? <IonSpinner name="crescent" /> : 'Bewaar'}</IonButton>
    </IonItem>
  );
  const gekozenRand = randen.find(r => r.id === bewerkRand);
  const randenTekening = segmenten.length > 0 && (
    <>
      <RandenTekening segmenten={segmenten} achtergrond={methode === 'manual'
          ? (gebouw?.tekening.detectie?.parts ?? []).filter(d => `${d.kind}-${d.number}` !== dakvlak?.detected_part_id)
            .map(d => ({ ringen: d.rings, naam: naam(d), label: d.labelPoint }))
          : []} gekozen={bewerkRand} onKies={r => kiesRand(r, 'tekening')}
        tekst={r => meter(opSchaal(r), 1)} klasse={r => r.checked_length_m != null ? (wijktAf(r) ? 'afwijking' : 'gemeten') : 'gewoon'} />
      {gekozenRand && vanaf === 'tekening' && schaalbaar(gekozenRand) && <IonList inset>{maatInvoer(gekozenRand)}</IonList>}
      <p className="r360-uitleg">Tik op een rand in de tekening om de meetlintmaat in te vullen.</p>
    </>
  );

  const omtrek = randen.reduce((s, r) => s + opSchaal(r), 0);
  const nl = (n: number, c = 2) => n.toLocaleString('nl-NL', { maximumFractionDigits: c });

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref={`/projecten/${projectId}`} text="Project" /></IonButtons>
          <IonTitle>{dakvlak?.code ?? 'Dakvlak'}</IonTitle>
          {gewijzigd && (
            <IonButtons slot="end">
              <IonButton strong onClick={gegevensOpslaan} disabled={!!bezig}>Bewaar</IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : bedrijfFout ? <Melding tekst={bedrijfFout} />
            : dakvlak === undefined && !fout ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !dakvlak || !velden ? <Melding tekst={fout ?? 'Dit dakvlak is niet gevonden.'} />
            : (
              <>
                {fout && <IonList inset><IonItem><IonText color="danger" className="r360-small">{fout}</IonText></IonItem></IonList>}

                {methode === null && (
                  <>
                    <div className="r360-section">Hoe wil je dit dakvlak meten?</div>
                    <div className="r360-form__actions r360-knoppen">
                      <IonButton expand="block" onClick={kiesEmlid} disabled={!!bezig}>Emlid-meting (RTK)</IonButton>
                    </div>
                    <p className="r360-uitleg">Je meet de hoeken van het dak in met de Emlid Reach RX2. Het nauwkeurigst.</p>
                    {gebouw === undefined ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
                      : gebouw === null ? (
                        <p className="r360-uitleg"><b>Handmatige meting</b> kan als het project bij een gebouw met een daktekening hoort. Dit project heeft er (nog) geen.</p>
                      ) : (
                        <>
                          <div className="r360-section">Of handmatig: kies het deel uit de tekening</div>
                          <div className="r360-tekening-kader">
                            <DakTekening detectie={gebouw.tekening.detectie!} schaal={gebouw.schaal} dakvlakken={[]} />
                          </div>
                          <IonList inset>
                            {gebouw.tekening.detectie!.parts!.map(d => (
                              <IonItem key={`${d.kind}-${d.number}`} button detail disabled={!!bezig} onClick={() => neemOver(d)}>
                                <IonLabel>{naam(d)}</IonLabel>
                                <IonNote slot="end">{Math.round(deelOppervlakte(d, gebouw.schaal, []))} m²</IonNote>
                              </IonItem>
                            ))}
                          </IonList>
                          <p className="r360-uitleg">Het dakvlak krijgt de maten uit de tekening. Klopt een maat niet, vul dan bij een rand de meetlintmaat in: de andere randen en de oppervlakte schalen mee.</p>
                        </>
                      )}
                  </>
                )}

                {methode === 'manual' && (() => {
                  const deel = gebouw?.tekening.detectie?.parts?.find(d => `${d.kind}-${d.number}` === dakvlak.detected_part_id);
                  return (
                    <>
                      <div className="r360-section">Handmatige meting</div>
                      {randenTekening || (deel && gebouw && (
                        <div className="r360-tekening-kader">
                          <DakTekening detectie={{ parts: [deel] }} schaal={gebouw.schaal * schaal} dakvlakken={[]} />
                        </div>
                      ))}
                      <IonList inset>
                        <IonItem><IonLabel>Overgenomen uit</IonLabel>
                          <IonNote slot="end">{deel ? naam(deel) : dakvlak.detected_part_id}{gebouw ? ` · tekening v${gebouw.versie.version_number}` : ''}</IonNote></IonItem>
                      </IonList>
                      <div className="r360-form__actions">
                        <IonButton expand="block" fill="clear" size="small" onClick={meetwijzeWijzigen} disabled={!!bezig}>Ander deel of andere meetwijze kiezen</IonButton>
                      </div>
                    </>
                  );
                })()}

                {methode === 'emlid' && (
                  <>
                <div className="r360-section">Meetpunten · {punten.length}</div>
                {gesloten && randenTekening ? randenTekening : punten.length >= 2 && <Schets punten={punten} gesloten={gesloten} />}
                <IonList inset>
                  {punten.length === 0 && (
                    <IonItem><IonText className="r360-small">Zet de Emlid op de eerste hoek van het dakvlak, houd de stok stil en tik op "Punt meten".
                      De knop werkt zodra de Emlid RTK FIX heeft en de positie stabiel is.</IonText></IonItem>
                  )}
                  {punten.map(p => {
                    const k = kwaliteit(p.horizontal_accuracy);
                    return (
                      <IonItem key={p.id}>
                        <IonLabel>
                          <h2 className="r360-row-title">{p.point_code || `P${p.sequence_number}`}</h2>
                          <p>±{meter(p.horizontal_accuracy, p.horizontal_accuracy < 1 ? 3 : 1)} · <span className={`r360-kwaliteit r360-kwaliteit--${k.klasse}`}>{k.tekst}</span></p>
                          {p.distance_from_previous_point != null && <p>{meter(p.distance_from_previous_point)} vanaf vorig punt</p>}
                        </IonLabel>
                        {!gesloten && (
                          <IonButton slot="end" fill="clear" color="danger" size="small" disabled={!!bezig}
                            onClick={() => puntWeg(p)}>Weg</IonButton>
                        )}
                      </IonItem>
                    );
                  })}
                </IonList>
                {!gesloten && (
                  <IonList inset>
                    <IonItem>
                      <IonLabel>
                        <h2 className="r360-row-title">Emlid-positie</h2>
                        <p className={live.klaar ? 'r360-kwaliteit--goed' : 'r360-waarschuwing'}>{live.fout ?? live.reden}</p>
                      </IonLabel>
                      <IonNote slot="end">{live.laatste ? `±${meter(live.laatste.accuracy, live.laatste.accuracy < 1 ? 3 : 1)}` : ''}</IonNote>
                    </IonItem>
                  </IonList>
                )}
                <div className="r360-form__actions r360-knoppen">
                  {!gesloten && (
                    <IonButton expand="block" onClick={() => puntMeten()} disabled={!!bezig || !live.klaar}>
                      {bezig === 'meten' ? <IonSpinner name="crescent" /> : 'Punt meten'}
                    </IonButton>
                  )}
                  {!gesloten && !live.klaar && live.laatste && (
                    <IonButton expand="block" fill="clear" size="small" onClick={() => puntMeten(true)} disabled={!!bezig}>
                      Toch meten zonder RTK (minder nauwkeurig)
                    </IonButton>
                  )}
                  {!gesloten && punten.length >= 3 && (
                    <IonButton expand="block" fill="outline" onClick={contourSluiten} disabled={!!bezig}>
                      {bezig === 'sluiten' ? <IonSpinner name="crescent" /> : 'Contour sluiten'}
                    </IonButton>
                  )}
                  {gesloten && (
                    <IonButton expand="block" fill="outline" onClick={contourOpenen} disabled={!!bezig}>Contour weer openen</IonButton>
                  )}
                  {punten.length === 0 && (
                    <IonButton expand="block" fill="clear" size="small" onClick={meetwijzeWijzigen} disabled={!!bezig}>Andere meetwijze kiezen</IonButton>
                  )}
                </div>

                  </>
                )}

                {methode !== null && (
                  <>
                <div className="r360-section">Oppervlakte</div>
                <IonList inset>
                  <IonItem><IonLabel>{schaal !== 1 ? 'Berekend, op schaal' : methode === 'manual' ? 'Uit de tekening' : 'Berekend uit punten'}</IonLabel>
                    <IonNote slot="end">{dakvlak.calculated_area_m2 != null ? `${nl(dakvlak.calculated_area_m2 * schaal * schaal)} m²` : gesloten ? '' : 'Sluit eerst de contour'}</IonNote></IonItem>
                  {schaal !== 1 && dakvlak.calculated_area_m2 != null && (
                    <IonItem><IonLabel className="r360-small">Schaal {nl(schaal, 4)} uit {metMaat.length} {metMaat.length === 1 ? 'meetlintmaat' : 'meetlintmaten'}</IonLabel>
                      <IonNote slot="end" className="r360-small">{methode === 'manual' ? 'Tekening' : 'GPS'}: {nl(dakvlak.calculated_area_m2)} m²</IonNote></IonItem>
                  )}
                  <IonItem>
                    <GetalInvoer label="Handmatig (m²)" waarde={velden.manual_gross_area_m2} onWijzig={n => zet('manual_gross_area_m2', n)} />
                  </IonItem>
                </IonList>

                <div className="r360-section">Dakranden · {randen.length}{omtrek > 0 && ` · samen ${meter(omtrek, 1)}`}</div>
                <IonList inset>
                  {randen.length === 0 && <IonItem><IonText className="r360-small">Dakranden komen er vanzelf bij als je de contour sluit. Je kunt ook een lengte met de hand invullen.</IonText></IonItem>}
                  {randen.map(r => (
                    <div key={r.id}>
                      <IonItem button={schaalbaar(r) && !bezig} detail={false}
                        onClick={schaalbaar(r) ? () => kiesRand(r) : undefined}>
                        <IonLabel>
                          <h2 className="r360-row-title">{r.code}</h2>
                          <p>{(() => {
                            if (!schaalbaar(r)) return 'Met de hand ingevuld';
                            const bron = r.measurement_source === 'bag_reference' ? 'Tekening' : r.measurement_source === 'reach_rx2_rtk' ? 'RTK' : 'GPS';
                            return r.checked_length_m != null ? `Meetlint · ${bron} ${meter(r.length_m)}`
                              : schaal !== 1 ? `Op schaal · ${bron} ${meter(r.length_m)}` : `${bron === 'Tekening' ? 'Uit de tekening' : 'Uit de meetpunten'} · tik voor meetlintmaat`;
                          })()}{r.is_estimated ? ' · geschat' : ''}</p>
                        </IonLabel>
                        <IonNote slot="end" className={r.checked_length_m != null ? (wijktAf(r) ? 'r360-kwaliteit--matig' : 'r360-kwaliteit--goed') : ''}>{meter(opSchaal(r))}</IonNote>
                        {!schaalbaar(r) && (
                          <IonButton slot="end" fill="clear" color="danger" size="small" disabled={!!bezig} onClick={() => randWeg(r)}>Weg</IonButton>
                        )}
                      </IonItem>
                      {wijktAf(r) && (
                        <IonItem>
                          <IonLabel className="ion-text-wrap"><IonText className="r360-waarschuwing"><p>Deze maat wijkt {procent(afwijking(monster(r), schaal))} af van de schaal
                            (verwacht {meter(r.length_m * schaal)}). Controleer de rand en de maat.</p></IonText></IonLabel>
                          <IonButton slot="end" size="small" fill="outline" disabled={!!bezig} onClick={() => afwijkingBevestigen(r)}>Klopt</IonButton>
                        </IonItem>
                      )}
                      {bewerkRand === r.id && vanaf === 'lijst' && maatInvoer(r)}
                    </div>
                  ))}
                  <IonItem>
                    <IonInput label="Handmatige rand (m)" type="text" inputmode="decimal" value={handLengte}
                      onIonInput={e => setHandLengte(String(e.detail.value ?? ''))} />
                    <IonButton slot="end" size="small" disabled={!handLengte || !!bezig} onClick={handmatigeRand}>Toevoegen</IonButton>
                  </IonItem>
                </IonList>

                  </>
                )}

                <div className="r360-section">Dakvlak</div>
                <IonList inset>
                  <IonItem>
                    <IonInput label="Code" value={velden.code} onIonInput={e => zet('code', String(e.detail.value ?? ''))} />
                  </IonItem>
                  <IonItem>
                    <IonSelect label="Soort dak" interface="action-sheet" value={velden.plane_type}
                      onIonChange={e => zet('plane_type', String(e.detail.value))}>
                      {dakvlakTypes.map(([w, l]) => <IonSelectOption key={w} value={w}>{l}</IonSelectOption>)}
                    </IonSelect>
                  </IonItem>
                  {velden.plane_type === 'other' && (
                    <IonItem><IonInput label="Welk soort" labelPlacement="stacked" value={velden.other_type_description}
                      onIonInput={e => zet('other_type_description', String(e.detail.value ?? ''))} /></IonItem>
                  )}
                  <IonItem>
                    <IonLabel>Afschot</IonLabel>
                    <IonSegment slot="end" className="r360-janee" value={velden.has_slope === true ? 'ja' : velden.has_slope === false ? 'nee' : ''}
                      onIonChange={e => zet('has_slope', e.detail.value === 'ja' ? true : e.detail.value === 'nee' ? false : null)}>
                      <IonSegmentButton value="ja">Ja</IonSegmentButton>
                      <IonSegmentButton value="nee">Nee</IonSegmentButton>
                    </IonSegment>
                  </IonItem>
                  {velden.has_slope && (
                    <IonItem>
                      <IonSelect label="Soort afschot" interface="action-sheet" value={velden.slope_type ?? ''}
                        onIonChange={e => zet('slope_type', e.detail.value || null)}>
                        {afschotTypes.map(([w, l]) => <IonSelectOption key={w} value={w}>{l}</IonSelectOption>)}
                      </IonSelect>
                    </IonItem>
                  )}
                  <IonItem>
                    <IonInput label="Omschrijving" labelPlacement="stacked" value={velden.free_description}
                      onIonInput={e => zet('free_description', String(e.detail.value ?? ''))} />
                  </IonItem>
                </IonList>
                <div className="r360-form__actions">
                  <IonButton expand="block" onClick={gegevensOpslaan} disabled={!gewijzigd || !!bezig}>
                    {bezig === 'gegevens' ? <IonSpinner name="crescent" /> : gewijzigd ? 'Dakvlak opslaan' : 'Opgeslagen ✓'}
                  </IonButton>
                </div>
                <p className="r360-uitleg">Een gemeten punt kan niet worden aangepast. Klopt het niet, haal het dan weg en meet opnieuw. Het oude punt blijft bewaard.
                  Wil je de maten corrigeren? Tik op een rand en vul de meetlintmaat in: alle randen en de oppervlakte schalen dan mee.</p>
              </>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}

// Kleine schets van de gemeten punten (noorden boven)
function Schets({ punten, gesloten }: { punten: Meetpunt[]; gesloten: boolean }) {
  const nul = punten[0];
  const xy = punten.map(p => lokaal(p, nul));
  const xs = xy.map(p => p.x), ys = xy.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const rand = Math.max(maxX - minX, maxY - minY, 1) * 0.12;
  const b = maxX - minX + 2 * rand, h = Math.max(maxY - minY + 2 * rand, b * 0.4);
  const sx = (x: number) => x - minX + rand, sy = (y: number) => maxY - y + rand;
  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join('') + (gesloten ? 'Z' : '');
  const r = Math.max(b, h) / 60;
  return (
    <div className="r360-tekening-kader">
      <svg className="r360-tekening" viewBox={`0 0 ${b} ${h}`} role="img" aria-label="Schets van de meetpunten">
        <path d={d} className={gesloten ? 'r360-tekening__dak' : 'r360-tekening__open'} strokeWidth={r / 2} />
        {xy.map((p, i) => (
          <g key={punten[i].id}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={r} className="r360-tekening__punt" />
            <text x={sx(p.x) + r * 1.5} y={sy(p.y) - r * 1.5} fontSize={r * 3} className="r360-tekening__naam">{punten[i].point_code || `P${i + 1}`}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// Tekening van het dakvlak waarin je de randen kunt aantikken (noorden boven, maten in meters).
type Segment = { rand: Dakrand; a: { x: number; y: number }; b: { x: number; y: number } };
type Punt = { x: number; y: number };
function RandenTekening({ segmenten, achtergrond = [], gekozen, onKies, tekst, klasse }: {
  segmenten: Segment[]; achtergrond?: { ringen: Punt[][]; naam: string; label: Punt }[];
  gekozen: string | null; onKies: (r: Dakrand) => void;
  tekst: (r: Dakrand) => string; klasse: (r: Dakrand) => 'gewoon' | 'gemeten' | 'afwijking';
}) {
  // Andere dakdelen (bijvoorbeeld een opbouw op dit dak) grijs op de achtergrond, zodat de tekening sluit.
  const alle = [...segmenten.flatMap(s => [s.a, s.b]), ...achtergrond.flatMap(d => d.ringen.flat())];
  const xs = alle.map(p => p.x), ys = alle.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const rand = Math.max(maxX - minX, maxY - minY, 1) * 0.1;
  const b = maxX - minX + 2 * rand, h = Math.max(maxY - minY + 2 * rand, b * 0.4);
  const sx = (x: number) => x - minX + rand, sy = (y: number) => maxY - y + rand;
  const letter = Math.max(b, h) / 34;
  // midden van de vorm, om de maat aan de buitenkant van een rand te zetten
  const eigen = segmenten.flatMap(s => [s.a]);
  const mx = eigen.reduce((t, p) => t + p.x, 0) / eigen.length, my = eigen.reduce((t, p) => t + p.y, 0) / eigen.length;
  const vlak = segmenten.map((s, i) => `${i ? 'L' : 'M'}${sx(s.a.x).toFixed(2)},${sy(s.a.y).toFixed(2)}`).join('') + 'Z';
  return (
    <div className="r360-tekening-kader">
      <svg className="r360-tekening" viewBox={`0 0 ${b} ${h}`} role="img" aria-label="Dakvlak met randen">
        {achtergrond.map((d, i) => (
          <g key={'a' + i} pointerEvents="none">
            <path d={d.ringen.map(r => 'M' + r.map(p => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join('L') + 'Z').join(' ')}
              fillRule="evenodd" className="r360-tekening__ander" strokeWidth={letter / 10} />
            <text x={sx(d.label.x)} y={sy(d.label.y)} textAnchor="middle" fontSize={letter * 0.7} className="r360-tekening__maat">{d.naam}</text>
          </g>
        ))}
        <path d={vlak} className="r360-tekening__dak" strokeWidth={0} />
        {segmenten.map(({ rand: r, a, b: e }) => {
          const k = gekozen === r.id ? 'r360-lijn--gekozen' : klasse(r) === 'afwijking' ? 'r360-lijn--afwijking'
            : klasse(r) === 'gemeten' ? 'r360-lijn--gemeten' : 'r360-lijn--rand';
          const cx = (a.x + e.x) / 2, cy = (a.y + e.y) / 2;
          const d = Math.hypot(cx - mx, cy - my) || 1;
          const tx = cx + (cx - mx) / d * letter * 1.1, ty = cy + (cy - my) / d * letter * 1.1;
          return (
            <g key={r.id} onClick={() => onKies(r)} style={{ cursor: 'pointer' }}>
              <line x1={sx(a.x)} y1={sy(a.y)} x2={sx(e.x)} y2={sy(e.y)} stroke="transparent" strokeWidth={letter * 1.6} />
              <line x1={sx(a.x)} y1={sy(a.y)} x2={sx(e.x)} y2={sy(e.y)} className={k}
                strokeWidth={letter / (gekozen === r.id ? 2.5 : 5)} strokeLinecap="round" />
              <text x={sx(tx)} y={sy(ty)} textAnchor="middle" dominantBaseline="middle" fontSize={letter * 0.7} className="r360-lijn__tekst">
                {r.code} · {tekst(r)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
