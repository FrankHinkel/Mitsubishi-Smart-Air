# Serverless Modus für Smart Air

Stand: 30. September 2026. Machbarkeitsprüfung und Umsetzungsplan auf Basis des Repositorys bei Commit `80f2b91` sowie der unten verlinkten Plattformdokumentation.

Ein Modus ohne Raspberry oder eigenen Server ist für die lokale Bedienung der WF-RAC-Klimageräte gut machbar. Die App kann das vorhandene lokale Protokoll selbst ausführen und ihren Zustand lokal speichern. Mehrere aktive Apps können sich Abfragen und Ergebnisse teilen. Die wesentliche Einschränkung ist der Betrieb bei geschlossener App: Die bisherigen Timer und die kontinuierliche Messaufzeichnung lassen sich auf iPhone und iPad nicht mit derselben Zuverlässigkeit wie auf einem dauerhaft laufenden Server übernehmen.

**Empfehlung:** Direktmodus als Standard, Datenaustausch zwischen ausdrücklich gekoppelten Apps im lokalen Netz als Optimierung und bestehender Servermodus als optionale Erweiterung. Zuerst den direkten Zugriff auf echter Hardware nachweisen, danach den Datenaustausch ergänzen. Die vorliegende Änderung dokumentiert diese Arbeit; sie implementiert noch keinen App-Modus.

## Umfang und Annahmen

Die Planung geht vorläufig vom Apple App Store für iPhone und iPad aus. Mac oder Android erfordern zusätzliche Plattformarbeit. Die Zielplattform und die notwendige Zuverlässigkeit der Hintergrundfunktionen wurden beim Auftraggeber angefragt und sind noch offen. Für die nachfolgenden Phasen wird angenommen, dass Einschränkungen im Direktmodus akzeptabel sind und der Server für volle Hintergrundfunktionalität optional bleiben darf.

Mit „serverless“ ist hier gemeint: kein vom Kunden betriebener Dauerläufer und kein Cloud-Backend für die lokale Steuerung. Eine aktive App darf vorübergehend Verbindungen von gekoppelten Apps annehmen. Das macht sie nicht zu einem zuverlässigen Hintergrundserver.

Die Klimageräte müssen bereits im erreichbaren Heimnetz eingerichtet sein. Die Einrichtung eines neuen WF-RAC im WLAN und eine vollständige Ablösung der Hersteller-App werden hier nicht zugesichert. Fernsteuerung außerhalb des Heimnetzes ist ein eigener Funktionsbereich und gehört nicht zu diesem Plan. Eine optionale Cloud würde die fehlende lokale Erreichbarkeit der Klimageräte allein nicht lösen.

## Befunde aus dem bestehenden Projekt

| Bereich | Aktueller Zustand | Konsequenz für den Direktmodus |
| --- | --- | --- |
| Oberfläche | `app.js` ruft relative `/api/...`-Routen auf und empfängt Snapshots über `EventSource` | Oberfläche braucht eine austauschbare Schnittstelle für Daten und Steuerung |
| Gerätezugriff | `device-api.js` sendet JSON über `curl` an HTTP oder HTTPS, Port 51443, `/beaver/command/...` | Protokoll ist vorhanden; Prozessaufrufe müssen durch native Netzwerkfunktionen ersetzt werden |
| Protokoll | Vier Kommandos: `getDeviceInfo`, `getAirconStat`, `updateAccountInfo`, `setAirconStat`; Base64, CRC16 und Temperaturtabellen | Große Teile der fachlichen Logik können wiederverwendet werden; `Buffer` und CommonJS brauchen eine portable Umsetzung |
| Registrierung | Persistente `operatorId`, Prüfung von `remoteList`, Fehler bei belegten Remote-Plätzen | Mehrere Apps dürfen nicht bei jedem Start neue Remotes registrieren |
| Abfragekoordination | Warteschlange pro IP und Port, 1,1 Sekunden Pause vor jeder Anfrage, Schreibpriorität | Gute Grundlage, aber nur innerhalb eines Node-Prozesses wirksam |
| Polling | Server standardmäßig alle 60 Sekunden; zusätzlich Browserabfragen pro Gerät, nach Interaktion alle 5 Sekunden für 60 Sekunden | Mehrere Oberflächen können bereits zusätzliche echte Geräteabfragen auslösen; SSE beseitigt diese nicht |
| Speicherung | `database.js` und `measures.js` starten die externe `sqlite3`-CLI | Native Speicherung im App-Container erforderlich |
| Timer | Server speichert Fristen in SQLite und prüft Sleep und Boost standardmäßig alle 30 Sekunden | Die Frist wird heute nicht als Timer in die Klimaanlage übertragen |
| Messungen | Monatliche SQLite-Dateien, 10-Minuten-Buckets, eindeutiger Schlüssel aus Bucket, Gerätename und Temperaturart | Für Austausch sind stabile Geräteidentität, Herkunft und tatsächlicher Messzeitpunkt nötig |
| App-Paket | Kein iOS-Projekt und keine Capacitor-Konfiguration vorhanden | Native App-Verpackung, Lebenszyklus und Berechtigungen sind neue Arbeit |

Die Befunde sind durch Quellcodeprüfung bestätigt. Es wurde keine App auf einem iPhone installiert und kein Klimagerät angesprochen. Die Machbarkeit des nativen Transports und der Zusammenarbeit verschiedener Firmwarestände ist deshalb noch experimentell zu bestätigen.

## Bewertung der Machbarkeit

| Anforderung | Bewertung | Grenze oder Nachweis |
| --- | --- | --- |
| Lokale Bedienung mit einer App ohne Server | Gut machbar | Native HTTP-Verbindung, Registrierung und Schreibbestätigung auf echter Hardware nachweisen |
| Gemeinsamer aktueller Zustand mehrerer aktiver Apps | Gut machbar mit zusätzlicher Koordination | Bonjour findet Apps, danach authentifizierte Verbindung und gemeinsame Abfragezuständigkeit |
| Weniger Statusanfragen an die Klimageräte | Gut machbar im verbundenen Netz | Ein Abfrageverantwortlicher pro Klimagerät; bei Netztrennung keine globale Exklusivität |
| Bedienung nach Ausfall einer anderen App | Machbar | Fristbasierte Übernahme und vorsichtiger direkter Rückfall |
| Sleep und Boost bei gesperrtem oder beendetem iPhone | Mit aktuellem Protokoll nicht zuverlässig erfüllbar | Nachgewiesener geräteeigener Timer oder dauerhaft laufender lokaler Teilnehmer erforderlich |
| Lückenlose Messhistorie bei ausschließlich inaktiven Apps | Nicht erfüllbar mit der vorhandenen Implementierung | Messlücken anzeigen; rückwirkende Gerätehistorie ist nicht implementiert |
| Verkauf über den App Store | Technisch plausibel | Hardwaretests, vollständige native Integration und App Review bleiben erforderlich |

Apple garantiert weder beliebige Hintergrundausführung noch Netzwerkanfragen zu festen Zeiten. Daraus folgt für dieses Produkt: Hintergrundtasks, lokale Benachrichtigungen und ein weiterer ebenfalls suspendierter iPhone-Teilnehmer ersetzen keinen Timer-Ausführer. Auch eine Alarmanzeige ist kein Nachweis eines rechtzeitig ausgeführten Klimabefehls. [Apple Developer Technical Support zu Hintergrundgrenzen](https://developer.apple.com/forums/thread/685525)

## Empfohlene Architektur

### Oberfläche und gemeinsame Fachlogik

Die vorhandene Oberfläche zunächst als gebündelte Weboberfläche mit Capacitor weiterverwenden. Das vermeidet einen sofortigen kompletten UI-Neubau. Die App lädt ihre Oberfläche aus dem installierten Paket und startet ohne Raspberry, Login oder Netzverbindung bis zur Anzeige des gespeicherten Zustands.

Die Protokollkodierung, Normalisierung und Steuerlogik in portable Module extrahieren. Byteoperationen über `Uint8Array`, plattformgeeignete Base64-Funktionen und explizite Exporte umsetzen. Node-Adapter dürfen dieselben Module weiterverwenden. Temperaturtabellen und die vorhandenen Firmware-Fallbacks erhalten, bis Tests eine Änderung rechtfertigen.

Eine Schnittstelle `SmartAirBackend` zwischen UI und Ausführung vorsehen: Geräte auflisten und bearbeiten, suchen, Status beziehen, Änderungen senden, Ereignisse abonnieren, Messungen lesen und Fähigkeiten melden. Die UI arbeitet mit fachlichen Methoden und Zustandsereignissen statt mit einem simulierten lokalen HTTP-Server.

Zwei Implementierungen vorsehen:

- `ServerBackend` nutzt die vorhandene REST-API und SSE des optionalen Servers.
- `LocalBackend` nutzt lokale Speicherung, den nativen WF-RAC-Transport und optional den Datenaustausch mit gekoppelten Apps.

Den Betriebsmodus pro Standort eindeutig auswählen. Im Servermodus übernimmt der Server die Klimakommunikation; die App startet für dieselben Geräte kein zusätzliches direktes Polling. Ein später als Peer integrierter Server kann auch im gemeinsamen Koordinationsmodell arbeiten. Ein unbekannter, unabhängig laufender Server oder fremder Controller lässt sich durch App-Koordination nicht vom Abfragen ausschließen. Ein Moduswechsel darf keine stillschweigende Übernahme laufender Automationen auslösen.

### Native Funktionen

Für iOS einen begrenzten nativen Adapter für HTTP-Zugriff, Netzwerksuche, Peer-Verbindungen und Lebenszyklus vorsehen. `URLSession` ist die erste Transportwahl; Protokollverhalten und Header gegen die reale Firmware prüfen. Capacitor bietet native HTTP-Unterstützung als mögliche Grundlage, beweist aber noch nicht die Kompatibilität mit WF-RAC. [Capacitor HTTP API](https://capacitorjs.com/docs/apis/http)

Die Verbindung zum Klimagerät darf nicht von Browser-CORS oder WebView-Fetch abhängen. Native HTTP-Aufrufe brauchen weiterhin passende Systemberechtigungen und Transportkonfiguration. Das heutige `curl --insecure` nicht als globale Abschaltung der Zertifikatsprüfung übernehmen. HTTP-Zugriff auf unterstützte lokale Geräte gezielt erlauben; bei HTTPS Zertifikate und mögliche Bindung an ein zuvor bestätigtes Gerät im Prototyp prüfen.

Für die aktuelle ATS-Konfiguration lokale IP-Zugriffe und `NSAllowsLocalNetworking` anhand des gewählten Mindest-iOS prüfen; seit iOS 17 unterscheidet Apple IP-Zugriffe anders als ältere Versionen. Kein pauschales `NSAllowsArbitraryLoads` als Standard. [Apple zu lokalen ATS-Ausnahmen](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)

SQLite über eine im App-Paket enthaltene native Bibliothek beziehungsweise einen geprüften Adapter verwenden. Keine Shell-Prozesse für `curl`, `sqlite3`, `arp` oder `ip`. Peer-Schlüssel und vertrauliche Kopplungsdaten im Keychain speichern; Protokoll-Remote-IDs getrennt von Peer-Identitäten behandeln.

## Geräte finden und Apps koppeln

Die vorhandene ARP- und Nachbartabellensuche ist kein übertragbarer iOS-Einstieg. Zuerst bekannte Adressen und gekoppelte Geräteeinträge verwenden, danach eine bewusst ausgelöste, begrenzte TCP-Suche auf Port 51443 im tatsächlich angeschlossenen IPv4-Netz. Netzmaske berücksichtigen und kein `/24`, festes `en0` oder Kunden-Heimnetz hart codieren. Für große Netze Suchbudget und manuell eingrenzbaren Bereich anbieten. Identifikation erfolgt durch WF-RAC-Antwort und `airconId`, nicht allein durch einen offenen Port.

Manuelle IP-Eingabe bleibt verfügbar. Bei DHCP-Änderungen zunächst gespeicherte Geräteidentitäten prüfen und nur bei Bedarf erneut suchen. IP-Adressen sind veränderliche Verbindungsdaten; `airconId` plus bei Bedarf Standortkontext ist die stabile Identität. Bonjour dient dem Finden anderer Smart-Air-Apps; dass WF-RAC selbst Bonjour anbietet, ist nicht nachgewiesen.

Apps veröffentlichen und suchen einen spezifischen Bonjour-Dienst, vorläufig `_smartair._tcp`, über Apples Network framework. Den endgültigen Dienstnamen vor Veröffentlichung auf Kollisionen prüfen. `NSLocalNetworkUsageDescription` und den konkreten Dienst in `NSBonjourServices` deklarieren. Für diese normale Bonjour-Nutzung ist kein eigenes UDP-Broadcast-Protokoll nötig; rohe Broadcasts oder bestimmte zusätzliche Bonjour-Operationen hätten weitere Entitlement-Anforderungen. Berechtigungsverweigerung und spätere Freigabe auf echten Geräten testen. [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy), [Apple NWBrowser](https://developer.apple.com/documentation/network/nwbrowser)

Gleiches WLAN ist keine Autorisierung zum Lesen oder Steuern. Ein neues App-Gerät über zeitlich begrenzte Kopplung mit Bestätigung auf beiden Geräten aufnehmen, etwa durch QR-Code mit einmaligem Geheimnis und Schlüsselfingerabdruck. Danach verschlüsselte, gegenseitig authentifizierte Verbindungen mit gepinnten Peer-Schlüsseln verwenden. Bonjour-Ankündigungen enthalten keine Klimadaten oder Remote-IDs. Kopplung widerrufen und bei geteilten Haushaltsgeheimnissen diese erneuern. Statusfreigabe und Steuerrecht explizit verwalten.

Gast-WLAN, Client-Isolation und getrennte VLANs können den Austausch verhindern. Die App erklärt dann den fehlenden Peer-Kontakt und versucht bei erreichbarem Klimagerät den Direktmodus. Ein normaler Browser wird im ersten Schritt kein vollständiger nativer Peer; er nutzt weiterhin den optionalen Server.

## Abfragen und Steuerung koordinieren

### Gemeinsame Statusabfragen

Pro Klimagerät übernimmt ein aktiver, gekoppelter und zum Gerät verbundener Teilnehmer die Abfragen. Alle anderen erhalten die bestätigten Snapshots über die Peer-Verbindung. Die Auswahl erfolgt deterministisch innerhalb der verbundenen Gruppe; eine stabile Teilnehmer-ID entscheidet Gleichstände. Ein erreichbarer optionaler Server kann nach späterer Integration bevorzugt werden.

Als Startwerte für den Prototyp: Statusabfrage alle 60 Sekunden, Peer-Heartbeat alle 5 Sekunden, Zuständigkeit nach 20 Sekunden ohne Bestätigung verfallen lassen. Diese Werte sind Entwurfsentscheidungen, keine belegten Geräteanforderungen. Monotone lokale Fristen verwenden. Jeder Snapshot enthält `airconId`, Erfassungszeit, Quelle, Sitzung beziehungsweise Amtsperiode und Sequenznummer. Empfangene Daten behalten den ursprünglichen Erfassungszeitpunkt; Weiterreichen macht alte Daten nicht frisch.

Gleichzeitige Aktualisierungswünsche zusammenfassen. Das jüngste ausreichend frische Ergebnis liefern; nur der zuständige Teilnehmer startet eine nötige echte Anfrage. Nach manueller Änderung zunächst die bestätigte Schreibantwort verteilen, danach bei Bedarf genau eine zusammengefasste Kontrollabfrage. Die bisherigen zusätzlichen 5-Sekunden-Abfragen nicht unverändert pro App übernehmen.

Beim Wechsel in den Hintergrund die Zuständigkeit bestmöglich abgeben und Polling sowie Peer-Dienst stoppen. Bei abruptem Abbruch läuft die Frist ab. Nach Ablauf neu abstimmen und mit kurzem Zufallsversatz direkt übernehmen, falls kein erreichbarer Verantwortlicher existiert. Fehler führen zu begrenzten Wiederholungen mit wachsendem Abstand. Nach Netzwechsel Verbindungen und Fristen neu bewerten.

Eine Netzpartition kann zwei voneinander getrennte Verantwortliche erzeugen. WF-RAC bietet im geprüften Code keine Sperre, die einen alten Verantwortlichen anhand einer Amtsperiode ausschließt. Deshalb ist dies eine Optimierung mit begrenztem Rückfall, keine Garantie weltweit genau einer Geräteanfrage. Nach Wiederverbindung Zuständigkeiten zusammenführen und doppelte Abfragen stoppen.

### Schreibbefehle und Registrierung

Schreibwünsche normalerweise über denselben Verantwortlichen serialisieren. Wünsche enthalten nur die vom Benutzer geänderten Felder, eine Befehls-ID, kurze Gültigkeitsdauer und die erwartete Statusrevision. Der Verantwortliche verbindet diese mit seinem aktuellen bestätigten Zustand und kodiert erst dann den vollständigen WF-RAC-Rahmen. Bei veraltetem Zustand, Übernahme oder unklarem Ausgang zuvor frisch lesen. So wird verhindert, dass ein veralteter App-Snapshot unabhängige Änderungen innerhalb der koordinierten Gruppe zurücksetzt. Gleichzeitige Änderungen durch eine externe Fernbedienung bleiben ohne geräteseitige Revisionsprüfung ein separat zu testender Konfliktfall.

Auf derselben Verbindung deduplizieren und bestätigte Befehle kurzfristig persistent merken. Bei verlorener Schreibantwort zunächst Zustand lesen und Ergebnis als bestätigt, fehlgeschlagen oder unklar behandeln. Das Geräteprotokoll besitzt hier keine nachgewiesene Idempotenz-ID: Über Teilnehmerabstürze und Netztrennungen hinweg keine exakt einmalige Ausführung versprechen. Veraltete Offline-Befehle nicht später automatisch nachholen. Widersprüchliche Änderungen melden oder nach frischem Zustand neu bestätigen lassen.

Die vorhandene Warteschlange und Pause als Ausgangspunkt erhalten und gemeinsame Abfragen daran anbinden. Protokollversuche und Wiederholungen zählen zum Anfragebudget. Manuelle Schreibbefehle priorisieren, aber keine Endlosschleifen oder unbeschränkten Warteschlangen zulassen.

Eine dauerhafte Remote-Registrierung pro Gerät verwalten. Als zu prüfende Variante teilen ausdrücklich gekoppelte Apps eine eigene, bestätigte Remote-ID für dieses Klimagerät, damit der Wechsel des Verantwortlichen keinen neuen Remote-Platz verbraucht. Das ist keine bereits bestätigte Firmwarefunktion. Fremde Einträge aus `remoteList` nicht automatisch als eigene Berechtigung übernehmen. Server- und App-Registrierung bei der Migration bewusst abstimmen.

Die aktuell verlinkte Referenzimplementierung beschreibt vier registrierte Remotes und eine mögliche 60-Sekunden-Schreibsperre nach Befehlen anderer Controller. Diese Angaben sind Hinweise für den Prototyp, keine Messung der hier verwendeten Firmware. Bestehende kurze Wiederholungen lösen eine solche Sperre möglicherweise nicht. Registrierung, gemeinsame Remote-ID und parallele Nutzung der Hersteller-App daher als frühes Freigabekriterium testen. Wenn das Teilen nicht funktioniert, eigene beständige Registrierungen mit klarer Behandlung voller Plätze vorsehen und den Mehrgeräteumfang entsprechend begrenzen. [WF-RAC-Referenzimplementierung](https://github.com/JobDoesburg/homebridge-mhi-wfrac)

## Speicherung und Funktionsgrenzen

| Funktion | Direktmodus | Optionaler Servermodus |
| --- | --- | --- |
| Power, Modus, Temperatur, Lüfter und Lamellen | Bei erreichbarem Klimagerät und aktiver App | Wie bisher über Server |
| Statusanzeige | Lokaler oder geteilter Snapshot mit sichtbarem Alter | Server-Snapshot |
| Messhistorie | Messungen während aktiver Erfassung, danach Austausch bereits vorhandener Messungen | Fortlaufend bei laufendem Server und erreichbaren Geräten |
| Sleep-Timer | Erst freigeben, wenn geräteeigene Ausführung nachgewiesen ist; sonst im ersten Direktmodus deaktivieren | Bisherige serverseitige Ausführung mit Fehlerstatus |
| Boost mit garantierter Rückstellung | Erst bei nachgewiesener autonomer Rückstellung freigeben; sonst deaktivieren | Bisherige serverseitige Ausführung |
| REST-Messdatenexport | Datei-Export aus der App vorsehen; kein ständig verfügbarer App-Endpunkt | Bestehende REST-API bleibt verfügbar |

Zustände lokal transaktional speichern. Geräteeinstellungen wie Namen und Sichtbarkeit mit Revisionen und Änderungsherkunft austauschen; Löschungen über versionierte Löschmarkierungen übermitteln. Gerätestatus wird aus bestätigten Beobachtungen übernommen, nicht aus der letzten allgemeinen Speicheränderung. Sequenzen nur innerhalb der jeweiligen Sitzung vergleichen; bei unklarer Reihenfolge oder stark abweichender Uhr frisch abfragen, statt alte Daten zur Wahrheit zu machen.

Messungen bekommen eine stabile Ereignis-ID, `airconId`, Erfassungszeitpunkt und Quelle. Empfangene Peer-Messungen nicht erneut als lokale Messungen erzeugen. Ereignisse deduplizieren, dann 10-Minuten-Ansichten daraus ableiten. Historienaustausch in begrenzten Paketen nach Zeitbereich und Cursor; zunächst nur neu fehlende Messungen. Ganze SQLite-Dateien nicht live zwischen Apps kopieren. Speichergrenzen, Aufbewahrung und Export vorsehen.

Serverdaten über versionierten Export beziehungsweise authentifizierte API übernehmen. Alte Integer-IDs und Gerätenamen explizit auf stabile Geräteidentitäten abbilden; mehrdeutige Zuordnungen melden. Laufende Server-Timer werden nicht still zu lokalen App-Timern. Im Servermodus bleiben sie beim Server; ein Wechsel bei laufenden Timern benötigt eine klare Anzeige der verbleibenden Ausführung. Import, Wiederholung des Imports und Zurückwechseln dürfen keine doppelten Geräte oder Messungen erzeugen.

Eine spätere Untersuchung geräteeigener Timer ist sinnvoll. Dafür sind zusätzliche Protokollbefunde und Tests nötig; die vorhandenen vier Kommandos belegen diese Fähigkeit nicht. Eine benutzerfreundliche Erinnerung kann eine getrennte Funktion sein, ersetzt aber keinen garantierten Abschaltbefehl.

## Umsetzung in Phasen

Die Zeitangaben sind grobe Engineering-Schätzungen für eine erfahrene Person, vorhandene Testgeräte und zunächst iPhone sowie iPad. Sie enthalten keine Zusage für App Review und müssen nach dem Hardwareprototyp neu geschätzt werden.

| Phase | Arbeitspakete | Abnahmekriterium | Aufwand |
| --- | --- | --- | --- |
| 0 Direkter Hardwareprototyp | Kleines natives Testpaket; manueller Gerätezugriff; HTTP/HTTPS; Berechtigungen; Lesen, Registrierung und Schreiben; mehrere Remote-IDs und Hersteller-App prüfen | Auf echtem iPhone reproduzierbarer direkter Zugriff ohne Node/Raspberry, bestätigte Änderungen und dokumentierte Firmwaregrenzen | 3 bis 5 Tage |
| 1 Portable Fachlogik | Codec und Protokoll von Node entkoppeln; `SmartAirBackend` und Fähigkeiten einführen; bestehende Serveradapter anbinden; zentrale Abfragekoordination | Bisheriger Serverpfad funktioniert weiter; Referenzrahmen und Datenfelder bleiben gleich; mehrere UI-Anfragen erzeugen eine zusammengefasste Geräteabfrage | 4 bis 6 Tage |
| 2 Eigenständige App | Capacitor-Paket, native Adapter und SQLite; lokale Geräteverwaltung; manuelles Hinzufügen und begrenzte Suche; Zustand und Fehleralter anzeigen; eingeschränkte Timer-Fähigkeiten im UI | Frische Installation bedient ein reales Gerät ohne Server; Wiederstart erhält Geräte, Registrierung und Daten; verweigerte Berechtigung ist verständlich behandelbar | 5 bis 8 Tage |
| 3 Lokaler App-Austausch | Bonjour, Kopplung, verschlüsselte Verbindungen, Abfragezuständigkeit, Befehlsweiterleitung, Übernahme und Deduplizierung | Zwei bis drei reale App-Geräte teilen Daten und reduzieren echte Geräteabfragen; Sperren, Beenden und Trennungen bleiben bedienbar | 5 bis 8 Tage |
| 4 Historie und Serveroption | Ereignismodell, Historienaustausch, Löschmarkierungen, Export/Import, Serverwechsel; optional Server als Peer integrieren | Offline erzeugte Historien werden ohne Duplikate zusammengeführt; alte Daten und laufende Server-Timer bleiben nachvollziehbar | 4 bis 6 Tage |
| 5 Veröffentlichung vorbereiten | Hardware- und Lebenszyklusmatrix, TestFlight, Barrierefreiheit, Support und Datenschutztexte, Review-Zugang, Lizenzen und Produktdarstellung | Dokumentierte Tests auf Zielgeräten und Firmwareständen; nachvollziehbarer Review-Pfad und zutreffende Funktionsbeschreibung | 4 bis 6 Tage |

Insgesamt etwa 25 bis 39 Arbeitstage, also ungefähr 5 bis 8 Arbeitswochen zuzüglich Rückmeldungen, fehlender Hardware und Review-Wartezeiten. Für ein erstes Direktmodus-Testpaket ohne Peer-Austausch sind die Phasen 0 bis 2 mit ungefähr 12 bis 19 Arbeitstagen der sinnvollste Einstieg.

Nach Phase 0 fällt die Entscheidung für den nativen Transport, die Registrierungsstrategie und den möglichen Timerumfang. Falls der direkte Schreibzugriff auf den Zielgeräten nicht reproduzierbar funktioniert, die App-Umsetzung nicht auf dieser unbestätigten Annahme fortsetzen. Falls verpflichtende Hintergrundfunktionen keine autonome Gerätefunktion haben, erfüllt ein ausschließlich serverloses iPhone-Produkt diese Anforderung nicht.

## Prüfplan und messbare Abnahme

- Codec: Anonymisierte echte Lese- und Schreibrahmen als Referenzdaten verwenden. CRC, Base64, Temperaturtabellen, Power, alle Modi, Lüfter und Lamellen prüfen. Ungültige oder abgeschnittene Rahmen zuverlässig ablehnen. Ein reiner Encoder-Decoder-Rundlauf reicht nicht als Protokollnachweis.
- Einzelgerät: Ohne laufenden Raspberry frisch installieren, Gerät hinzufügen, jede Steuerfunktion anwenden, Bestätigung lesen, App beenden und wieder öffnen. Registrierung bleibt erhalten. Internetzugriff abschalten, WLAN beibehalten und lokale Bedienung erneut prüfen.
- Mehrere Apps: Zwei und anschließend drei gekoppelte Geräte zehn Minuten ohne Bedienung gleichzeitig aktiv halten. Im fehlerfreien Fall bei 60-Sekunden-Intervall ungefähr zehn Statusabfragen pro Klimagerät zuzüglich dokumentierter Startabfragen erwarten, nicht zehn pro App. Anfragen beim ausführenden Transport zählen; Scan, Registrierung, Kontrollabfragen und Wiederholungen gesondert erfassen.
- Übernahme: Verantwortlichen sperren, zwangsweise beenden und aus dem WLAN nehmen. Neuer Verantwortlicher übernimmt innerhalb der gewählten Frist plus Verbindungszeit. Alter Teilnehmer darf nach Rückkehr keinen veralteten Snapshot oder alten Befehl ausführen. Messlücken bleiben sichtbar, wenn alle Apps inaktiv waren.
- Konflikte: Zwei Teilnehmer ändern unterschiedliche und gleiche Felder. Alte Statusrevisionen, verlorene Antworten, Neustart während Schreiben und wiederholte Befehls-IDs testen. Keine unbemerkte Rücksetzung unabhängiger Felder und keine verzögerte Ausführung abgelaufener Wünsche.
- Firmware: Remote-Plätze füllen ohne fremde Einträge zu löschen; Registrierung und Wiederstart testen. Hersteller-App parallel bedienen, dokumentierte Sperrcodes beobachten und Warteverhalten prüfen. Gemeinsame eigene Remote-ID und Übergabe zwischen Apps separat nachweisen.
- Netz: Berechtigung verweigern und nachträglich erlauben; DHCP-Wechsel, verschiedene Netzmasken, Guest-/Client-Isolation, VPN und WLAN-Wechsel prüfen. IPv6 bei App-/Peer-Netzwerk und optionalem Server berücksichtigen; tatsächliche IPv4-Abhängigkeit des WF-RAC erfassen und den Review-Netzwerktest darauf abstimmen.
- Vertrauen: Ungekoppelten Peer, falschen Schlüssel, widerrufene Kopplung, wiederholte Nachrichten und inkompatible Protokollversionen ablehnen. Bonjour allein darf keine Datenfreigabe auslösen.
- Persistenz: Beide Apps unabhängig mit neuen Messungen starten, wieder verbinden und erneut starten. Keine Duplikate, keine durch Umbenennung abgespaltene Historie, ursprüngliche Messzeiten bleiben erhalten. Import und Export mit alter Serverdatenbank prüfen.
- Timer: Die Oberfläche bietet nur nachgewiesene Fähigkeiten an. Bei eventuellen Gerätetimern Ablauf mit gesperrten, beendeten und ausgeschalteten App-Geräten sowie unterbrochenem App-WLAN prüfen. Eine sichtbare Countdown-Anzeige allein gilt nicht als Nachweis.

## Voraussetzungen für den App Store

Eine mitgelieferte Oberfläche mit direkter Gerätebedienung, lokalem Speicher und nativer Kopplung bietet einen nachvollziehbaren App-Nutzen. Ein reiner Verweis auf die bisherige Weboberfläche wäre schwächer. App Review ist trotzdem keine zugesicherte Folge der technischen Machbarkeit. Gebündelte Ressourcen verwenden, Hintergrundmodi nur für ihren vorgesehenen Zweck nutzen und die tatsächliche Geräte- und Netzkompatibilität darstellen. [Apple App Review Guidelines, insbesondere 2.5 und 4.2](https://developer.apple.com/app-store/review/guidelines/)

Für die Hardwareprüfung einen klar gekennzeichneten Demo-Modus mit denselben UI-Abläufen und kontrollierten simulierten Fehlerfällen planen. Er beweist keine echte Gerätekompatibilität. Review-Notizen, Demonstrationsvideo und gegebenenfalls Hardware bereitstellen, damit Apple die eigentliche Funktion prüfen kann. Support- und Datenschutzseite vor Veröffentlichung fertigstellen. [Apple zur Review-Vorbereitung bei besonderer Hardware](https://developer.apple.com/app-store/review/)

Für die Veröffentlichung Herkunft wiederverwendeter Protokollteile und Bibliothekslizenzen erfassen. Die derzeit verlinkte WF-RAC-Referenz nennt Apache 2.0; das belegt nicht automatisch die Herkunft aller vorhandenen Quellcodebestandteile. App-Name, Icon und Store-Metadaten dürfen keine unbelegte offizielle Mitsubishi-Zugehörigkeit suggerieren; Produktdarstellung vor Einreichung gegen Apples Vorgaben prüfen. [Referenzprojekt und Lizenz](https://github.com/JobDoesburg/homebridge-mhi-wfrac), [Apple Vorgaben zur Produktdarstellung und zu Rechten, 2.3.7 und 5.2](https://developer.apple.com/app-store/review/guidelines/)

## Noch zu klärende Produktentscheidungen

1. Zielplattform für die erste Veröffentlichung: nur iPhone/iPad, zusätzlich Mac oder auch Android?
2. Sind die beschriebenen Hintergrundgrenzen akzeptabel, oder müssen Sleep, Boost-Rückstellung und lückenlose Messungen ohne optionalen Dauerläufer funktionieren?

Für den ersten Prototyp sind diese offenen Punkte kein Hindernis. Sie müssen vor der verbindlichen Festlegung des Store-Funktionsumfangs beantwortet werden. Weitere technische Entscheidungen werden anhand der Hardwarebefunde aus Phase 0 getroffen.
