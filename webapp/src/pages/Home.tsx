// Thuisscherm, nagebouwd van HomeView.swift in de iOS-app.
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { HomeTile } from '../components/HomeTile';
import { HomeCard } from '../components/HomeCard';
import {
  IconBuilding, IconBuildings, IconCalendarClock, IconCamera,
  IconFolder, IconPersonCircle, IconPlusSquare, IconResume,
} from '../components/icons';
import './Home.css';

// Voorbeeld zolang er nog geen inlog en gegevens zijn. Later komt dit uit Supabase.
const laatsteWerk = { titel: 'Voorbeeldstraat 1 · DV-01', regel: 'Voorbeeld · Dakvlak' };
const agendaVandaag = 'Geen opnames vandaag';

const tegels = [
  { title: 'Nieuw project', subtitle: 'Start een nieuwe meting', icon: <IconPlusSquare />, href: '/nieuw-project' },
  { title: 'Projecten', subtitle: 'Bekijk en beheer', icon: <IconFolder />, href: '/projecten' },
  { title: 'Opdrachtgevers', subtitle: 'Beheer je relaties', icon: <IconBuildings />, href: '/opdrachtgevers' },
  { title: 'Gebouwen', subtitle: 'Bekijk en beheer gebouwen', icon: <IconBuilding />, href: '/gebouwen' },
  { title: "Snelle foto's", subtitle: 'Maak en voeg direct toe', icon: <IconCamera />, href: '/snelle-fotos' },
  { title: 'Account', subtitle: 'Inloggen en lidmaatschappen', icon: <IconPersonCircle />, href: '/account' },
];

export default function Home() {
  const history = useHistory();
  // Klikken op een tegel of kaart: binnen de app naar het volgende scherm.
  const open = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a[data-router-link]');
    if (!link) return;
    e.preventDefault();
    history.push(link.getAttribute('href')!);
  };

  return (
    <IonPage>
      <IonContent fullscreen className="r360-home">
        <div className="r360-home__hero" aria-hidden />
        <main className="r360-home__body" onClick={open}>
          <header className="r360-home__header">
            <h1>Roof360 Measure</h1>
            <p className="r360-home__subtitle">Inmeten en inspecteren van platte daken</p>
            <p className="r360-home__slogan">SNEL · NAUWKEURIG · PROFESSIONEEL</p>
          </header>

          <HomeCard icon={<IconResume />} caption="HERVAT LAATSTE WERK"
            title={laatsteWerk.titel} lines={[laatsteWerk.regel]} href="/projecten" />
          <HomeCard icon={<IconCalendarClock />} title="Agenda" lines={[agendaVandaag]} href="/agenda" />

          <nav className="r360-home__grid">
            {tegels.map(t => <HomeTile key={t.href} {...t} />)}
          </nav>
        </main>
      </IonContent>
    </IonPage>
  );
}
