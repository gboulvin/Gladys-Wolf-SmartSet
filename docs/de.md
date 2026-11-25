# Wolf SmartSet

Überwachen und steuern Sie Ihre **Wolf**-Heizungsanlage (Gas- und
Öl-Brennwertkessel, Wärmepumpen, Lüftungsgeräte, Solarmodule...) aus Gladys,
über die **Wolf SmartSet**-Cloud.

## Bevor Sie beginnen

- Ihre Anlage muss über ein Wolf-Gateway (**ISM7**, **Link home**,
  **Link pro**...) mit Wolf SmartSet verbunden und im
  [Wolf-SmartSet-Portal](https://www.wolf-smartset.com) oder in der App
  sichtbar sein.
- Halten Sie Benutzername und Passwort dieses Kontos bereit. Wolf SmartSet
  akzeptiert nur Passwörter mit **höchstens 30 Zeichen**.
- Die Integration spricht mit der Wolf-Cloud (eine **Cloud**-Integration):
  Gladys braucht Internetzugang, und die Werte sind so aktuell, wie Wolf
  SmartSet sie liefert.

## Konfiguration

1. Öffnen Sie den Reiter **Konfiguration** der Integration.
2. Geben Sie Ihren Wolf-SmartSet-**Benutzernamen** und Ihr **Passwort** ein.
3. Wählen Sie die **Sprache der Parameternamen**: Wolf SmartSet übersetzt die
   Namen seiner Parameter selbst (Englisch, Französisch, Deutsch oder
   Spanisch).
4. Lassen Sie den **Expertenmodus** aus, es sei denn, Sie brauchen alle
   Parameter des Reglers: aus erhalten Sie die Parameter, die das Wolf-Portal
   dem Benutzer zeigt; an alle Parameter aller Menüs (deutlich mehr
   Funktionen).
5. Das **Aktualisierungsintervall** legt fest, wie oft die Werte aus der
   Wolf-Cloud gelesen werden: standardmäßig alle 2 Minuten, höchstens jede
   Minute. Die Wolf-Cloud ist langsam und begrenzt die Anfragen, bleiben Sie
   maßvoll.
6. Speichern Sie und klicken Sie auf **Verbindung testen**: Die Meldung unter
   der Schaltfläche nennt die Anzahl der gefundenen Anlagen.
7. Öffnen Sie den Reiter **Entdecken**: Jede Wolf-Anlage erscheint als ein
   Gerät, bereit zum Hinzufügen.

## Was Sie erhalten

Jede Wolf-Anlage wird zu einem Gladys-Gerät. Seine Funktionen sind die
Parameter der Anlage, von Wolf SmartSet benannt und nach ihrer Einheit
zugeordnet:

| Wolf-Parameter                                | Gladys-Funktion          | Steuerbar                              |
| --------------------------------------------- | ------------------------ | -------------------------------------- |
| Temperatur (°C), nur lesbar                   | Temperaturfühler         | nein                                   |
| Temperatur (°C), änderbar (Raum, Warmwasser…) | Thermostat-Sollwert      | **ja**                                 |
| Druck (bar)                                   | Drucksensor              | nein                                   |
| Leistung (kW) / Wärmemenge (kWh)              | Leistungs-/Energiesensor | nein                                   |
| Betriebsstunden                               | Dauer                    | nein                                   |
| Prozent (Modulation, Pumpe…)                  | Wert in %                | nein                                   |
| Auswahlliste (Betriebsart, Programm, Status)  | Auswahlliste             | **ja**, wenn in Wolf SmartSet änderbar |
| Sonstiges (U/min, l/min, Hz, Text…)           | Text mit Einheit         | nein                                   |

Das Abzeichen des Geräts zeigt **Cloud**, solange sein Gateway Wolf SmartSet
erreicht, und **nicht erreichbar**, wenn das Gateway offline ist.

Um die änderbaren Parameter einer Anlage und ihre Kennungen zu sehen, klicken
Sie im Reiter Konfiguration auf **Änderbare Parameter auflisten**.

## Szenen

**Auslöser**

- **Verbindung des Wolf-Gateways geändert**: Das Gateway einer Anlage ist
  online oder offline gegangen. Filtern Sie nach Anlage und Status; die Szene
  erhält `{{triggerEvent.data.status}}` (`online` / `offline`).
- **Wolf-Betriebsart oder -Status geändert**: Ein Auswahlparameter
  (Betriebsart, Programm, Brennerstatus…) hat einen neuen Wert. Die Szene
  erhält den Parameternamen, seine Kennung, den neuen und den vorherigen
  Wert. Eine Änderung durch Gladys selbst löst ihn nie aus.

Die Zahlenwerte (Temperaturen, Druck…) sind Gerätefunktionen: Nutzen Sie den
Standard-Auslöser „Gerätezustand" von Gladys für Schwellwerte.

**Aktionen**

- **Wolf-Anlage jetzt abfragen**: liest alle Werte, ohne das
  Aktualisierungsintervall abzuwarten. Ausgaben: Gateway online, Anzahl der
  gelesenen Werte.
- **Wolf-Parameter ändern**: schreibt einen Sollwert, eine Betriebsart oder
  einen änderbaren Parameter. Der Parameter wird über Namen oder Kennung
  angegeben; der Wert einer Auswahlliste ist ihre Bezeichnung (z. B. `Eco`)
  oder ihre Nummer. Ausgaben: der Parameter und der geschriebene Wert.
- **Wolf-Parameter lesen**: stellt einen Wert den folgenden Aktionen der
  Szene bereit (als Text, roh und numerisch).

## Dashboard-Widget

Das Widget **Wolf-Anlage** zeigt die wichtigsten Temperaturen und den Druck
einer Anlage (live), die Gateway-Verbindung, die letzte Abfrage und die
aktuellen Betriebsarten, mit einer Schaltfläche **Aktualisieren**. Wählen Sie
die Anlage in den Widget-Einstellungen (sonst die erste).

## Fehlerbehebung

- **„Wolf SmartSet hat den Benutzernamen oder das Passwort abgelehnt"**:
  Prüfen Sie beides im Wolf-SmartSet-Portal; kürzen Sie das Passwort bei
  Bedarf auf 30 Zeichen.
- **Kein Gerät unter Entdecken**: Klicken Sie auf **Verbindung testen**; das
  Konto muss mindestens eine Anlage besitzen.
- **Werte aktualisieren sich nicht mehr, Abzeichen „nicht erreichbar"**: Das
  Wolf-Gateway hat seine Verbindung verloren: Prüfen Sie Stromversorgung und
  Netzwerk.
- **Ein Parameter fehlt**: Aktivieren Sie den **Expertenmodus**.

Diese Integration nutzt dieselben Wolf-SmartSet-Webdienste wie das
Wolf-Portal; sie sind keine öffentliche API und können sich ohne Vorankündigung
ändern.
