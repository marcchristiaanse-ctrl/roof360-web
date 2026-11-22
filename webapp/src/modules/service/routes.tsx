// Roof360 Service: de schermen van deze module. App.tsx neemt deze lijst over,
// zodat de module los blijft van de rest en later makkelijk aan of uit kan.
import { Route } from 'react-router-dom';
import ServiceOverzicht from './ServiceOverzicht';
import MeldingScherm from './MeldingScherm';
import WerkbonScherm from './WerkbonScherm';
import NieuweMelding from './NieuweMelding';

export const serviceRoutes = [
  <Route key="service" exact path="/calamiteiten" component={ServiceOverzicht} />,
  <Route key="service-nieuw" exact path="/calamiteiten/nieuwe-melding" component={NieuweMelding} />,
  <Route key="service-melding" exact path="/calamiteiten/meldingen/:id" component={MeldingScherm} />,
  <Route key="service-werkbon" exact path="/calamiteiten/werkbonnen/:id" component={WerkbonScherm} />,
];
