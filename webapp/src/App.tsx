import type React from 'react';
// Startpunt van de app: welke schermen er zijn en hoe je ertussen navigeert.
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactMemoryRouter, IonReactRouter } from '@ionic/react-router';
import { createMemoryHistory } from 'history';
import { Route } from 'react-router-dom';
import Home from './pages/Home';
import Binnenkort from './pages/Binnenkort';

// Altijd iPhone-stijl, ook op Android en Windows, zodat het overal hetzelfde voelt.
setupIonicReact({ mode: 'ios' });

const schermen = [
  { pad: '/nieuw-project', titel: 'Nieuw project' },
  { pad: '/projecten', titel: 'Projecten' },
  { pad: '/opdrachtgevers', titel: 'Opdrachtgevers' },
  { pad: '/gebouwen', titel: 'Gebouwen' },
  { pad: '/snelle-fotos', titel: "Snelle foto's" },
  { pad: '/account', titel: 'Account' },
  { pad: '/agenda', titel: 'Agenda' },
];

// Voorbeeldversie (npm run voorbeeld): werkt los van een webadres, voor een snelle preview.
const isVoorbeeld = import.meta.env.MODE === 'voorbeeld';
const voorbeeldHistory = createMemoryHistory();
function Router({ children }: { children: React.ReactNode }) {
  return isVoorbeeld
    ? <IonReactMemoryRouter history={voorbeeldHistory}>{children}</IonReactMemoryRouter>
    : <IonReactRouter basename="/roof360-web/nieuw">{children}</IonReactRouter>;
}

export default function App() {
  return (
    <IonApp>
      <Router>
        <IonRouterOutlet>
          <Route exact path="/" component={Home} />
          {schermen.map(s => (
            <Route key={s.pad} exact path={s.pad} render={() => <Binnenkort titel={s.titel} />} />
          ))}
        </IonRouterOutlet>
      </Router>
    </IonApp>
  );
}
