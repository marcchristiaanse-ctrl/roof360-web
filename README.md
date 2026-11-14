# Roof360 Measure Web (voorbeeld)

Los voorbeeld van Roof360 Measure als webapp. De iOS-app in ~/Documents/Roof360Measure is NIET aangeraakt.

Bekijken: https://marcchristiaanse-ctrl.github.io/roof360-web/ (Emlid-testpagina: https://marcchristiaanse-ctrl.github.io/roof360-web/emlid/)

Bestanden
- app.html            de app zelf (bron)
- index.html          zelfde app als losse webpagina, gemaakt met `python3 bouw-index.py`
- testgebouwen.js     8 testgebouwen: BAG-omtrek, buren, herkende daken (Python-prototype), luchtfoto (PDOK)
- manifest.webmanifest, icoon-180.png, icoon-512.png   voor "Zet op beginscherm" op de iPhone

Wat het kan
1. Gebouw opzoeken: testgebouwen, en op een eigen https-adres live elk adres via PDOK (locatieserver + BAG WFS + luchtfoto WMS)
2. Gebouw: luchtfoto, BAG-omtrek, herkende daken, buren; per dak m², vinkje "telt mee", totaal
3. Meten: dakranden DR1, DR2 ... ; gemeten maat invullen; schaal uit alle gemeten maten samen;
   maat met meer dan 10% verschil telt niet mee tot je "Toch meetellen" kiest; schuine m² bij hellende daken
Maten worden alleen in de browser bewaard (localStorage), niet in Supabase.

Lokaal proberen: `python3 -m http.server` in deze map en open http://localhost:8000

## Nieuwe webapp (React + TypeScript + Ionic)

Opnieuw opgebouwd met de look and feel van de iOS-app.

- Bekijken: https://marcchristiaanse-ctrl.github.io/roof360-web/nieuw/
- Broncode: map `webapp/`. Kleuren en maten staan op één plek: `webapp/src/theme/roof360.css`.
- Bouwen: `cd webapp && npm install && npm run build` (zet het resultaat in de map `nieuw/`).
- Proberen op je eigen computer: `cd webapp && npm run dev`.
- Klaar: thuisscherm. De andere schermen zijn nog leeg.
- Achtergrondfoto: Erasmusbrug door Sanna Xu, Unsplash (https://unsplash.com/photos/l7syX8QoV1g).

Nooit wachtwoorden, geheime sleutels of slimme logica in deze repo: hij is openbaar.
