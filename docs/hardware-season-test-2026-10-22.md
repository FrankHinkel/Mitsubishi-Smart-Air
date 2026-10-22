# Betriebssteuerung: Hardwaretest am 22.10.2026

Testzeit: ca. 07:52–07:58 Uhr, Europe/Berlin.

Der lokale Server wurde mit der vorhandenen Datenbank auf `http://127.0.0.1:13920` gestartet. Vorher lief dort kein Serverprozess. Verwendet wurden der echte curl/WF-RAC-Treiber und die normalen Serverintervalle: Statusabruf 60 Sekunden, Timerprüfung 30 Sekunden. Es wurden keine Geräte simuliert und keine Messwerte überschrieben. Dieser erste Durchlauf erfolgte versehentlich auf dem Mac statt auf dem gewünschten Raspberry Pi. Nach der Klarstellung wurde die lokale Instanz beendet. Ziel des anschließenden Updates und der erneuten Prüfung ist der bestehende Raspi-Server `http://192.168.178.10:13920`.

## Geräte und Ausgangszustand

| Gerät | Adresse | Ursprünglicher Zustand |
| --- | --- | --- |
| Klima Erdgeschoss | 192.168.178.122 | Ein, Heizen, 22,5 °C |
| Klima 1. OG | 192.168.178.84 | Aus, Heizen, 24 °C |
| Klima Dachstudio | 192.168.178.100 | Aus, Heizen, 24 °C |

Alle drei Geräte waren erreichbar; anfangs meldeten sie 5,5 °C außen. Es waren keine Sleep- oder Boost-Timer aktiv. Die ursprüngliche Betriebssteuerung war `manual`.

Für die Betriebsartentests wurde das Gerät im 1. OG verwendet. Das Erdgeschoss war währenddessen vorübergehend ausgeschaltet. Externe Änderungen wurden direkt mit `setAirconStat` am echten WLAN-Modul vorgenommen, unter Verwendung der vorhandenen Remote-Registrierung und unter Umgehung des Servers. Das prüft den Korrekturweg für fremde Geräteänderungen; eine physische Infrarotfernbedienung wurde nicht betätigt.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Manuell | Direkt eingestelltes Heizen blieb beim Statusabruf unverändert. |
| Sommer, externe Änderung | Direkt eingestelltes Heizen wurde durch den normalen Hintergrundabruf auf Kühlen korrigiert. Nach 18,5 Sekunden war Kühlen unabhängig am Gerät nachgelesen. Während des Wartens wurde kein Statusabruf über die API ausgelöst und kein Browser geöffnet. |
| Sommer, App-Befehl | Eine Heizanforderung über die API wurde als Kühlen übertragen und am Gerät nachgelesen. |
| Erhalt weiterer Einstellungen | Die Sommerkorrektur erhielt Solltemperatur 30 °C, Luftstrom und beide Lamellenpositionen. |
| Winter | Direkt eingestelltes Kühlen wurde beim Statusabruf auf Heizen korrigiert und unabhängig nachgelesen. |
| Lüften und Entfeuchten | Beide Betriebsarten blieben unter Winter erlaubt und wurden am Gerät bestätigt. |
| Auto | Die drei echten Außenmesswerte ergaben 5,5 °C; die Steuerung wählte entsprechend nur Heizen und korrigierte Kühlen auf Heizen. |
| Aus | Alle drei Geräte wurden unabhängig als ausgeschaltet nachgelesen. Ein direkt am Testgerät ausgelöster Neustart im Lüftungsmodus wurde wieder ausgeschaltet. |
| Sleep und Boost bei Aus | Beide Einschaltversuche wurden mit HTTP 409 abgewiesen. |
| Oberfläche | Die produktive lokale Oberfläche zeigte echte Gerätezustände, Außentemperatur und die aktiven Betriebssteuerungen an. |
| Wiederherstellung | Ein/Aus, Betriebsart, Solltemperatur, Luftstrom und beide Lamellenpositionen wurden für alle drei Geräte wiederhergestellt und unabhängig nachgelesen. Die Betriebssteuerung steht wieder auf Manuell. |

## Beobachteter Fehler und Grenzen

Im ersten Testanlauf wies das Dachstudio einen Ausschaltbefehl trotz Serverwiederholungen mit WF-RAC-Ergebniscode `1` ab; die API meldete HTTP 500. Der Test wurde abgebrochen und alle Ausgangszustände erfolgreich wiederhergestellt. Beim anschließenden Auslesen meldete das Gerät Ergebniscode `0` und eine vorhandene Remote-Registrierung. Eine Ursache ist damit nicht nachgewiesen; der Fehler wird nicht als Erfolg gewertet.

Der zweite Testanlauf mit weniger unnötigen Schreibbefehlen an bereits ausgeschaltete Geräte bestand vollständig, einschließlich der erneuten Zustandsprüfung des Dachstudios. Die Schreibfehlerbehandlung wurde nicht gelockert und es wurden keine weiteren Remotes registriert.

Die Temperaturgrenzen 18/22 °C sowie die Kühlentscheidung bei mehr als 22 °C wurden hier nicht mit echter Außentemperatur geprüft; dafür bestehen die zuvor ausgeführten automatisierten Tests. Dieser kurze Hardwaretest belegt keine Langzeitzuverlässigkeit. Die gemessenen 18,5 Sekunden sind ein einzelner Beobachtungswert, keine garantierte Reaktionszeit.

Rohdaten liegen lokal im ignorierten Verzeichnis `data/hardware-check/`: `baseline.json`, `attempt-1.json` und `results.json`. Das Log des inzwischen beendeten lokalen Servers liegt unter `data/server.log`.
