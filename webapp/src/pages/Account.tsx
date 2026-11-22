// Accountscherm, nagebouwd van AccountView.swift in de iOS-app:
// inloggen met e-mail en wachtwoord, lidmaatschappen tonen, uitloggen.
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonInput, IonItem,
  IonLabel, IonList, IonNote, IonPage, IonSpinner, IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { foutInHetNederlands, supabase, type Lidmaatschap } from '../supabase';
import './Account.css';

export default function Account() {
  const [sessie, setSessie] = useState<Session | null>(null);
  const [lidmaatschappen, setLidmaatschappen] = useState<Lidmaatschap[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  // Luisteren of je in- of uitlogt (ook bij opnieuw openen van de app).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessie(data.session));
    const { data } = supabase.auth.onAuthStateChange((_gebeurtenis, nieuweSessie) => setSessie(nieuweSessie));
    return () => data.subscription.unsubscribe();
  }, []);

  // Na inloggen: lidmaatschappen ophalen (alleen lezen).
  useEffect(() => {
    if (!sessie) { setLidmaatschappen([]); return; }
    let actief = true;
    (async () => {
      setFout(null); setBezig(true);
      const { data, error } = await supabase.rpc('my_memberships');
      if (!actief) return;
      setBezig(false);
      if (error) setFout(foutInHetNederlands(error));
      else setLidmaatschappen((data ?? []) as Lidmaatschap[]);
    })();
    return () => { actief = false; };
  }, [sessie?.user.id]);

  async function uitloggen() {
    setFout(null);
    const { error } = await supabase.auth.signOut();
    if (error) setFout(foutInHetNederlands(error));
  }

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/" text="Start" /></IonButtons>
          <IonTitle>Account</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="r360-form">
        <div className="r360-form__body">
          {sessie ? (
            <>
              <div className="r360-section">Ingelogd als</div>
              <IonList inset>
                <IonItem><IonLabel>{sessie.user.email}</IonLabel></IonItem>
              </IonList>

              <div className="r360-section">Lidmaatschappen</div>
              <IonList inset>
                {bezig ? (
                  <IonItem><IonSpinner name="crescent" /></IonItem>
                ) : fout ? (
                  <IonItem><IonText color="danger" className="r360-small">{fout}</IonText></IonItem>
                ) : lidmaatschappen.length === 0 ? (
                  <IonItem><IonNote>Geen lidmaatschappen gevonden.</IonNote></IonItem>
                ) : (
                  lidmaatschappen.map(l => (
                    <IonItem key={l.membership_id}>
                      <IonLabel>
                        <h2 className="r360-row-title">{l.tenant_name}</h2>
                        <p>{l.role}</p>
                        <p className={l.is_effective ? 'r360-actief' : ''}>{l.is_effective ? 'Actief' : 'Niet actief'}</p>
                      </IonLabel>
                    </IonItem>
                  ))
                )}
              </IonList>

              <IonList inset>
                <IonItem button detail={false} onClick={uitloggen}>
                  <IonLabel color="danger">Uitloggen</IonLabel>
                </IonItem>
              </IonList>
            </>
          ) : (
            <Inloggen />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}

function Inloggen() {
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function inloggen(e: FormEvent) {
    e.preventDefault();
    setFout(null); setBezig(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: wachtwoord });
    setBezig(false);
    if (error) setFout(foutInHetNederlands(error));
  }

  return (
    <form onSubmit={inloggen}>
      <div className="r360-section">Inloggen</div>
              <IonList inset>
        <IonItem>
          <IonInput type="email" inputmode="email" autocomplete="username" autocapitalize="off"
            placeholder="E-mailadres" value={email} onIonInput={e => setEmail(String(e.detail.value ?? ''))} />
        </IonItem>
        <IonItem>
          <IonInput type="password" autocomplete="current-password"
            placeholder="Wachtwoord" value={wachtwoord} onIonInput={e => setWachtwoord(String(e.detail.value ?? ''))} />
        </IonItem>
        {fout && <IonItem><IonText color="danger" className="r360-small">{fout}</IonText></IonItem>}
      </IonList>
      <div className="r360-form__actions">
        <IonButton type="submit" expand="block" disabled={!email || !wachtwoord || bezig}>
          {bezig ? <IonSpinner name="crescent" /> : 'Inloggen'}
        </IonButton>
      </div>
    </form>
  );
}
