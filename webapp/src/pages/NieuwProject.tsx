// Nieuw project: gebouw kiezen, naam, ordernummer en opdrachtgever.
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem, IonList,
  IonPage, IonSelect, IonSelectOption, IonSpinner, IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { adresRegel, gebouwTitel, haalGebouwen, type GebouwLink } from '../gegevens';
import { bewaar, haalRelaties, nieuweId, type Project, type Relatie } from '../opslaan';
import { useBedrijf } from '../useBedrijf';
import { Melding, NietIngelogd } from './Gebouwen';
import './Account.css';
import './Gebouwen.css';

const NIEUW = '__nieuw__';
const GEEN = '__geen__';

export default function NieuwProject() {
  const history = useHistory();
  const gekozenGebouw = new URLSearchParams(useLocation().search).get('gebouw');
  const { sessie, laden, fout: bedrijfFout, bedrijf } = useBedrijf();
  const [gebouwen, setGebouwen] = useState<GebouwLink[] | null>(null);
  const [relaties, setRelaties] = useState<Relatie[]>([]);
  const [gebouwId, setGebouwId] = useState<string>(gekozenGebouw ?? '');
  const [naam, setNaam] = useState('');
  const [naamAangepast, setNaamAangepast] = useState(false);
  const [order, setOrder] = useState('');
  const [relatieId, setRelatieId] = useState<string>(GEEN);
  const [nieuweRelatie, setNieuweRelatie] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!bedrijf) return;
    Promise.all([haalGebouwen(bedrijf.tenant_id), haalRelaties(bedrijf.tenant_id)])
      .then(([g, r]) => { setGebouwen(g); setRelaties(r); })
      .catch(e => setFout(e.message));
  }, [bedrijf?.tenant_id]);

  const gebouw = gebouwen?.find(g => g.building?.id === gebouwId)?.building ?? null;
  // Naam van het project volgt het adres, tot je hem zelf aanpast.
  useEffect(() => {
    if (!naamAangepast && gebouw) setNaam(adresRegel(gebouw).split(',')[0]);
  }, [gebouw?.id]);

  async function opslaan(e: FormEvent) {
    e.preventDefault();
    if (!bedrijf) return;
    setFout(null); setBezig(true);
    try {
      const t = bedrijf.tenant_id;
      // 1. Opdrachtgever (bestaand of nieuw)
      let relatie: Relatie | undefined = relaties.find(r => r.id === relatieId);
      if (relatieId === NIEUW) {
        relatie = await bewaar<Relatie>(t, 'parties', { id: nieuweId(), company_name: nieuweRelatie.trim() });
      }
      // 2. Project, met momentopnames zoals de iOS-app dat doet
      const project = await bewaar<Project>(t, 'projects', {
        id: nieuweId(),
        name: naam.trim(),
        building_id: gebouw?.id ?? null,
        address: gebouw ? [gebouw.street, gebouw.house_number, gebouw.house_number_addition].filter(Boolean).join(' ') : '',
        postal_code: gebouw?.postal_code ?? '',
        city: gebouw?.city ?? '',
        building_address_snapshot: gebouw ? adresRegel(gebouw) : '',
        order_reference: order.trim(),
        organization_name_snapshot: relatie?.company_name ?? '',
        client_created_at: new Date().toISOString(),
      });
      // 3. Koppeling project - opdrachtgever
      if (relatie) {
        await bewaar(t, 'project_parties', { id: nieuweId(), project_id: project.id, party_id: relatie.id, role: 'client' });
      }
      history.replace(`/projecten/${project.id}`);
    } catch (err) {
      setFout((err as Error).message);
    } finally {
      setBezig(false);
    }
  }

  const kanOpslaan = naam.trim() && (relatieId !== NIEUW || nieuweRelatie.trim()) && !bezig;

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/projecten" text="Terug" /></IonButtons>
          <IonTitle>Nieuw project</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {laden ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : !sessie ? <NietIngelogd />
            : bedrijfFout ? <Melding tekst={bedrijfFout} />
            : !bedrijf ? <Melding tekst="Je bent nog geen actief lid van een bedrijf." />
            : gebouwen === null && !fout ? <div className="r360-midden"><IonSpinner name="crescent" /></div>
            : (
              <form onSubmit={opslaan}>
                <div className="r360-section">Gebouw</div>
                <IonList inset>
                  <IonItem>
                    <IonSelect label="Gebouw" labelPlacement="stacked" interface="action-sheet" placeholder="Kies een gebouw"
                      value={gebouwId || GEEN} onIonChange={e => setGebouwId(e.detail.value === GEEN ? '' : String(e.detail.value))}>
                      <IonSelectOption value={GEEN}>Geen gebouw</IonSelectOption>
                      {(gebouwen ?? []).filter(g => g.building).map(g => (
                        <IonSelectOption key={g.id} value={g.building!.id}>{gebouwTitel(g)}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                </IonList>

                <div className="r360-section">Project</div>
                <IonList inset>
                  <IonItem>
                    <IonInput label="Projectnaam" labelPlacement="stacked" placeholder="Bijvoorbeeld Franklinweg 5"
                      value={naam} onIonInput={e => { setNaam(String(e.detail.value ?? '')); setNaamAangepast(true); }} />
                  </IonItem>
                  <IonItem>
                    <IonInput label="Ordernummer (optioneel)" labelPlacement="stacked" value={order}
                      onIonInput={e => setOrder(String(e.detail.value ?? ''))} />
                  </IonItem>
                </IonList>

                <div className="r360-section">Opdrachtgever</div>
                <IonList inset>
                  <IonItem>
                    <IonSelect label="Opdrachtgever" labelPlacement="stacked" interface="action-sheet" value={relatieId}
                      onIonChange={e => setRelatieId(String(e.detail.value))}>
                      <IonSelectOption value={GEEN}>Nog geen</IonSelectOption>
                      {relaties.map(r => <IonSelectOption key={r.id} value={r.id}>{r.company_name}</IonSelectOption>)}
                      <IonSelectOption value={NIEUW}>+ Nieuwe opdrachtgever</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  {relatieId === NIEUW && (
                    <IonItem>
                      <IonInput label="Bedrijfsnaam" labelPlacement="stacked" value={nieuweRelatie}
                        onIonInput={e => setNieuweRelatie(String(e.detail.value ?? ''))} />
                    </IonItem>
                  )}
                </IonList>

                {fout && <IonList inset><IonItem><IonText color="danger" className="r360-small">{fout}</IonText></IonItem></IonList>}
                <div className="r360-form__actions">
                  <IonButton type="submit" expand="block" disabled={!kanOpslaan}>
                    {bezig ? <IonSpinner name="crescent" /> : 'Project aanmaken'}
                  </IonButton>
                </div>
              </form>
            )}
        </div>
      </IonContent>
    </IonPage>
  );
}
