// Eén project: gegevens, opdrachtgever en de algemene opname (invullen en opslaan).
import {
  IonBackButton, IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonInput, IonItem, IonLabel,
  IonList, IonNote, IonPage, IonSegment, IonSegmentButton, IonSelect, IonSelectOption, IonSpinner, IonText,
  IonTextarea, IonTitle, IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  bewaar, haalAlgemeneOpname, haalDakvlakken, dakvlakTypes, label, type Dakvlak, haalProject, haalProjectRelaties, haalRelatie, keuzes, nieuweId,
  type AlgemeneOpname, type Project, type Relatie,
} from '../opslaan';
import { useBedrijf } from '../useBedrijf';
import { GetalInvoer } from '../components/GetalInvoer';
import { Melding, NietIngelogd } from './Gebouwen';
import { datumKort } from './Projecten';
import './Account.css';
import './Gebouwen.css';

type Opname = Omit<AlgemeneOpname, 'version' | 'deleted_at' | 'project_id' | 'id'>;
const leeg: Opname = {
  status: 'not_reviewed', roof_accessibility: null, roof_access: [], custom_roof_access: null,
  crane_possible: null, crane_permit_required: null, aerial_platform_possible: null, parking_type: null,
  parking_available: null, parking_costs: null, parking_cost_per_day: null, direct_roof_material_supply: null,
  building_in_use: null, power_available: null, water_available: null, notes: null,
};

export default function ProjectScherm() {
  const { id } = useParams<{ id: string }>();
  const { sessie, laden, fout: bedrijfFout, bedrijf } = useBedrijf();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [opdrachtgever, setOpdrachtgever] = useState<Relatie | null>(null);
  const [opgeslagen, setOpgeslagen] = useState<AlgemeneOpname | null>(null);
  const [opname, setOpname] = useState<Opname>(leeg);
  const [gewijzigd, setGewijzigd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [dakvlakken, setDakvlakken] = useState<Dakvlak[]>([]);
  const history = useHistory();

  useEffect(() => {
    if (!bedrijf) return;
    let actief = true;
    (async () => {
      try {
        const [p, rel, o] = await Promise.all([haalProject(id), haalProjectRelaties(id), haalAlgemeneOpname(id)]);
        haalDakvlakken(id).then(d => actief && setDakvlakken(d)).catch(() => setDakvlakken([]));
        const client = rel.find(r => r.role === 'client');
        const og = client ? await haalRelatie(client.party_id) : null;
        if (!actief) return;
        setProject(p); setOpdrachtgever(og); setOpgeslagen(o);
        if (o) { const { version: _v, deleted_at: _d, project_id: _p, id: _i, ...rest } = o; setOpname({ ...leeg, ...rest }); }
      } catch (e) { if (actief) setFout((e as Error).message); }
    })();
    return () => { actief = false; };
  }, [bedrijf?.tenant_id, id]);

  function zet<K extends keyof Opname>(veld: K, waarde: Opname[K]) {
    setOpname(o => ({ ...o, [veld]: waarde })); setGewijzigd(true); setMelding(null);
  }

  async function opslaan() {
    if (!bedrijf || !project) return;
    setBezig(true); setFout(null);
    try {
      // Alleen velden die anders zijn dan wat er op de server staat (veldniveau).
      const basis: Opname = opgeslagen ?? leeg;
      const anders = Object.fromEntries(
        (Object.keys(opname) as (keyof Opname)[])
          .filter(k => JSON.stringify(opname[k]) !== JSON.stringify(basis[k]))
          .map(k => [k, opname[k]]));
      const nieuw = await bewaar<AlgemeneOpname>(bedrijf.tenant_id, 'project_general_surveys',
        opgeslagen ? { id: opgeslagen.id, ...anders } : { id: nieuweId(), project_id: project.id, ...anders },
        opgeslagen?.version);
      setOpgeslagen(nieuw); setGewijzigd(false); setMelding('Opgeslagen');
    } catch (e) { setFout((e as Error).message); }
    finally { setBezig(false); }
  }

  async function dakvlakToevoegen() {
    if (!bedrijf || !project) return;
    setBezig(true); setFout(null);
    try {
      const volg = Math.max(0, ...dakvlakken.map(d => d.sequence_number)) + 1;
      let code = `DV-${String(volg).padStart(2, '0')}`;
      while (dakvlakken.some(d => d.code === code)) code += 'a';
      const nieuw = await bewaar<Dakvlak>(bedrijf.tenant_id, 'roof_planes',
        { id: nieuweId(), project_id: project.id, sequence_number: volg, code, plane_type: volg === 1 ? 'main_roof' : 'unknown' });
      history.push(`/projecten/${project.id}/dakvlakken/${nieuw.id}`);
    } catch (e) { setFout((e as Error).message); }
    finally { setBezig(false); }
  }

  const kies = (veld: keyof Opname, lijst: readonly (readonly [string, string])[], titel: string) => (
    <IonItem>
      <IonSelect label={titel} interface="action-sheet" placeholder="Kies"
        value={opname[veld] ?? ''} onIonChange={e => zet(veld, (e.detail.value || null) as never)}>
        <IonSelectOption value="">Niet ingevuld</IonSelectOption>
        {lijst.map(([w, t]) => <IonSelectOption key={w} value={w}>{t}</IonSelectOption>)}
      </IonSelect>
    </IonItem>
  );
  const jaNee = (veld: keyof Opname, titel: string) => (
    <IonItem>
      <IonLabel>{titel}</IonLabel>
      <IonSegment slot="end" className="r360-janee" value={opname[veld] === true ? 'ja' : opname[veld] === false ? 'nee' : ''}
        onIonChange={e => zet(veld, (e.detail.value === 'ja' ? true : e.detail.value === 'nee' ? false : null) as never)}>
        <IonSegmentButton value="ja">Ja</IonSegmentButton>
        <IonSegmentButton value="nee">Nee</IonSegmentButton>
      </IonSegment>
    </IonItem>
  );

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/projecten" text="Projecten" /></IonButtons>
          <IonTitle>Project</IonTitle>
          {gewijzigd && (
            <IonButtons slot="end">
              <IonButton strong onClick={opslaan} disabled={bezig}>{bezig ? <IonSpinner name="crescent" /> : 'Bewaar'}</IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : bedrijfFout ? <Melding tekst={bedrijfFout} />
            : fout && project === undefined ? <Melding tekst={fout} />
            : project === undefined ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !project ? <Melding tekst="Dit project is niet gevonden." />
            : (
              <>
                <h1 className="r360-paginakop">{project.name}</h1>
                <div className="r360-section">Project</div>
                <IonList inset>
                  {project.building_address_snapshot && (
                    <IonItem button={!!project.building_id} detail={!!project.building_id}
                      routerLink={project.building_id ? `/gebouwen/${project.building_id}` : undefined}>
                      <IonLabel>Gebouw</IonLabel><IonNote slot="end" className="r360-waarde">{project.building_address_snapshot}</IonNote>
                    </IonItem>
                  )}
                  {project.order_reference && <IonItem><IonLabel>Ordernummer</IonLabel><IonNote slot="end">{project.order_reference}</IonNote></IonItem>}
                  <IonItem><IonLabel>Opdrachtgever</IonLabel><IonNote slot="end" className="r360-waarde">{opdrachtgever?.company_name ?? 'Nog geen'}</IonNote></IonItem>
                  <IonItem><IonLabel>Aangemaakt</IonLabel><IonNote slot="end">{datumKort(project.created_at)}</IonNote></IonItem>
                </IonList>

                <div className="r360-section">Dakvlakken · {dakvlakken.length}</div>
                {dakvlakken.length > 0 && (
                  <IonList inset>
                    {dakvlakken.map(d => (
                      <IonItem key={d.id} button detail routerLink={`/projecten/${project.id}/dakvlakken/${d.id}`}>
                        <IonLabel>
                          <h2 className="r360-row-title">{d.code}</h2>
                          <p>{label(dakvlakTypes, d.plane_type)}{d.contour_status === 'closed' ? ' · contour gesloten' : ''}</p>
                        </IonLabel>
                        <IonNote slot="end">{(d.manual_gross_area_m2 ?? d.calculated_area_m2) != null ? `${Math.round((d.manual_gross_area_m2 ?? d.calculated_area_m2)!)} m²` : ''}</IonNote>
                      </IonItem>
                    ))}
                  </IonList>
                )}
                <div className="r360-form__actions">
                  <IonButton expand="block" fill="outline" onClick={dakvlakToevoegen} disabled={bezig}>Dakvlak toevoegen</IonButton>
                </div>

                <div className="r360-section">Algemene opname</div>
                <IonList inset>
                  {kies('status', keuzes.status, 'Status')}
                </IonList>

                <div className="r360-section">Toegang tot het dak</div>
                <IonList inset>
                  {kies('roof_accessibility', keuzes.bereikbaarheid, 'Bereikbaarheid')}
                  {keuzes.toegang.map(([w, t]) => (
                    <IonItem key={w}>
                      <IonCheckbox justify="space-between" checked={opname.roof_access.includes(w)}
                        onIonChange={e => zet('roof_access', e.detail.checked
                          ? [...opname.roof_access, w] : opname.roof_access.filter(x => x !== w))}>{t}</IonCheckbox>
                    </IonItem>
                  ))}
                  {opname.roof_access.includes('other') && (
                    <IonItem>
                      <IonInput label="Andere toegang" labelPlacement="stacked" value={opname.custom_roof_access ?? ''}
                        onIonInput={e => zet('custom_roof_access', String(e.detail.value ?? '') || null)} />
                    </IonItem>
                  )}
                </IonList>

                <div className="r360-section">Materiaal en materieel</div>
                <IonList inset>
                  {kies('crane_possible', keuzes.kraan, 'Kraan mogelijk')}
                  {opname.crane_possible === 'yes' && jaNee('crane_permit_required', 'Vergunning nodig')}
                  {kies('aerial_platform_possible', keuzes.hoogwerker, 'Hoogwerker mogelijk')}
                  {jaNee('direct_roof_material_supply', 'Materiaal direct op het dak')}
                </IonList>

                <div className="r360-section">Parkeren</div>
                <IonList inset>
                  {kies('parking_type', keuzes.parkeren, 'Parkeren')}
                  {jaNee('parking_available', 'Parkeerplek beschikbaar')}
                  {jaNee('parking_costs', 'Parkeerkosten')}
                  {opname.parking_costs && (
                    <IonItem>
                      <GetalInvoer label="Kosten per dag (€)" waarde={opname.parking_cost_per_day} onWijzig={n => zet('parking_cost_per_day', n)} />
                    </IonItem>
                  )}
                </IonList>

                <div className="r360-section">Gebouw en voorzieningen</div>
                <IonList inset>
                  {jaNee('building_in_use', 'Gebouw in gebruik')}
                  {kies('power_available', keuzes.voorziening, 'Stroom aanwezig')}
                  {kies('water_available', keuzes.voorziening, 'Water aanwezig')}
                </IonList>

                <div className="r360-section">Opmerkingen</div>
                <IonList inset>
                  <IonItem>
                    <IonTextarea autoGrow placeholder="Bijzonderheden" value={opname.notes ?? ''}
                      onIonInput={e => zet('notes', String(e.detail.value ?? '') || null)} />
                  </IonItem>
                </IonList>

                {fout && <IonList inset><IonItem><IonText color="danger" className="r360-small">{fout}</IonText></IonItem></IonList>}
                <div className="r360-form__actions">
                  <IonButton expand="block" onClick={opslaan} disabled={!gewijzigd || bezig}>
                    {bezig ? <IonSpinner name="crescent" /> : melding && !gewijzigd ? 'Opgeslagen ✓' : 'Algemene opname opslaan'}
                  </IonButton>
                </div>
                <p className="r360-uitleg">Details (HWA, lichtkoepels, dakranden) en foto's komen in een volgende stap.</p>
              </>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}
