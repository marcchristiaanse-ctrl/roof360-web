// Tijdelijk scherm voor onderdelen die nog gebouwd moeten worden.
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

export default function Binnenkort({ titel }: { titel: string }) {
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/" text="Start" /></IonButtons>
          <IonTitle>{titel}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <p style={{ color: 'var(--r360-secondary)' }}>Dit scherm wordt nog gebouwd.</p>
      </IonContent>
    </IonPage>
  );
}
