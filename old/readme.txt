ANTIWAR VERSION 1.5 FINAL Windows/Mac/Linux 1 Oktober 2005          www.feuerware.com        athurn@gmx.de


				______________________________________________________
				      /|                       |     |                
				     / |  |\    |  -------  *  |  |  |      /|  |---  
				    /  |  | \   |     |     |  |  |  |     / |  |   | 
				   /---|  |  \  |     |     |  |  |  |    /--|  |---  
				  /    |  |   \ |     |     |  |  |  |   /   |  | \   
				 /     |  |    \|     |     |  \__^__/  /    |  |  \  
				______________________________________________________



Wir sind auf der Suche nach 2d und 3d Grafikern. Bist du selber Grafiker oder kennst du wen, 
der Zeit und Lust hat in einem Team mitzuarbeiten, dann melde dich einfach bei uns.
Spenden nehmen wir natùrlich auch gerne an, diese werden in neue Software oder sonstige Ausrùstung investiert. 
Jeder Euro hilft, also geniert euch nicht einen zu spenden :-) Mehr Infos auf www.feuerware.com
Spender werden dann namentlich erwùhnt...






Antiwar Readme                         


Herzlich Willkommen zur Antiwar Readme. Hier findest du Informationen ùber das Spiel, zu alten Versionen und Antworten zu Problemen.

1.) Spielinfos
2.) Mindestanforderungen
3.) FAQ/PROBLEME
4.) Tipps zum Spiel
5.) VERSIONSHISTORY



1. Spielinfos
------------------------ 

AntiWar ist ein simples Ballerspiel. Bùse Ami-Flugzeuge greifen dich und deine Brùder an. Jetzt heisst es sich zu verteidigen.
Eigentliches Spielziel ist es, mùglichst schnell einen Level zu beenden. Je besser man zielen kann und je geschickter man 
kauft, umso schneller kann man den Level schaffen. Dazu gibt es auch eine Internethighscore, in der man sich mit anderen messen kann.
Damit das ganze ein bissel interessanter wird, kann man seine Leute und Raketen aufrùsten (z.B. stùrkere/schnellere Raketen).
Steuerung:

Linke Maustaste = Linker Turm
Rechte Maustaste = Rechter Turm

Wichtiger Hinweis: Um erfolgreich zu sein, ist es notwendig Flugzeuge anzuvisieren, bis das Fadenkreuz rot wird (ca. 1 Sekunde).

Diese Zeit lùsst sich auch verringern durch Kauf des Aim Upgrades (ganz rechts).


Man kann leicht eigene Levels erstellen. Dazu braucht man nur einen Texteditor wie Notepad unter Windows. Mehr Infos dazu in der sdk_readme.txt



--------------------------------------------------------------------------------------------------------
2. Mindestanforderungen
------------------------ 

Windos/Mac/Linux System
OpenGL fùhige Grafikkarte
Soundkarte
15 MB Festplattenplatz
Maus
64 MB RAM
700 Mhz

-------------------------------------------------------------------------------------------------------
3. FAQ/PROBLEME:
------------------------ 
-Das Spiel stùrzt direkt beim Start ab, mit der Meldung "Unhandled Memory Exception"
    Du hast keine Soundtreiber installiert, ohne gehts nicht. Also schnell installieren 
    und alles sollte klappen

-Ich habe nur eine Maustaste, wie kann ich mit beiden Tùrmen schiessen?
    Alternativ zu den Maustasten lùsst sich das Spiel auch mit den Pfeiltasten links und rechts spielen.

-Wieso ruckelt das Spiel? Wieso gibt es Darstellungsfehler?
    Bei manchen Grafikkarten kann es zu Problemen mit der Darstellung des Spiels kommen.  
    Z.b. werden Grafiken nicht richtig dargestellt, das Spiel ruckelt extrem oder der Bildschirm flackert. 
    Das liegt entweder daran, dass die Grafikkarte nicht OpenGL fùhig ist oder lediglich die Treiber veraltet sind. 
    Die Effekte werden dann im Softwaremodus erzeugt und daher lahmt alles. Grafikkartentreiber updaten und schon 
    lùufts flùssig. Der Vollbildmodus ist auch weitaus schneller als der Fenstermodus. Also mal unter Optionen auf 
    Vollbild(Fullscreen) umschalten.

-Wieso wird nie gespeichert, wenn ich einen Level schaffe oder wenn ich unter Optionen etwas umstelle?
    Wenn nicht gespeichert wird, liegt das wohl daran dass der Ordner /data im Spielverzeichnis schreibgeschùtzt ist.

-Beim Klicken auf "Internet" kommt immer der Fehler, "Server does not respond", obwohl der PC
 mit dem Internet verbunden ist.
    Dies kann mehrere Ursachen haben. Entweder blockt eine Firewall oder ein Router 
    das Programm. In diesem Fall muss in der Firewall eingstellt werden, dass Antiwar 
    Daten senden darf bzw. bei einem Router muss Port 80 freigegeben werden.
    Alternativ kann es auch daran liegen, dass der Highscore Server kurz oder langfristig
    nicht mehr erreichbar ist oder sich die Adresse von diesem geùndert hat. 
    In diesem Fall bitte auf http://awar.de.vu oder http://www.feuerware.com/antiwar/
    nach aktuellen Hinweisen bzw neuen Versionen schauen. 

-Beim Hochladen der Highscore erhalte ich die Fehlermeldung, "Server doest not respond".
 Trotzdem wird die Highscore eingetragen. 
    Dieser Fehler tritt dann auf, wenn eingehende Daten von einer Firewall oder einem Router 
    geblockt werden. Da ausgehende Nachrichten nicht geblockt werden, erfolgt trotzdem ein Eintrag.
    Um dieses Problem zu lùsen, muss Port 80 freigegeben sein.

-Linux: /main: error while loading shared libraries: libstdc++.so.6: cannot open shared object file: No such file or directory
	Die libstdc++ Datei liegt dem Spiel im Ordner libstdc6 bei.
	Nach einem unmask und gcc-update bzw. slot-install auf gcc-3.4.4-r1 ist die benùtigte Datei vorhanden.
	Entweder man linkt direkt gegen die Datei 'libstdc++.so.6.0.3'.
		ln -s /usr/lib/gcc/i686-pc-linux-gnu/3.4.4/libstdc++.so.6.0.3 /usr/lib/libstdc++.so.6
	Oder besser man switcht zum neuen gcc & sourcen des profiles.
		gcc-config i686-pc-linux-gnu-3.4.4 ; . /etc/profile
	Ein ldd ./main ergibt:
		libstdc++.so.6 => /usr/lib/gcc/i686-pc-linux-gnu/3.4.4/libstdc++.so.6
	Schon lùufts *gg*
	Bei daraus resultiernden Problemen kùnnte ein:
		fix_libtool_files.sh <old-gcc-version>
	helfen. Thx to Qubit



BUGS:
keine mir bekannten

-------------------------------------------------------------------------------------------------------
4. Spieletipps
------------------

Allgemein:
----------
- Um einen Level zu schaffen, muss man alle Flugzeuge ausschalten.
- Fùr jeden ùberlebenden bekommt man Geld, also sorge dafùr, dass nicht zuviele Menschen sterben.
- Menschen kann man durch Kauf des linkesten Upgrades bekommen. Meistens lohnt es sich, soviele Menschen wie mùglich zu kaufen
- Gebe grundsùtzlich dein gesamtes Geld fùr Upgrades aus, diese werden nicht billiger, daher immer alles investieren. 
- Preise und Auswirkungen steigen normalerweise exponentiell, daher lohnt es sich nicht, nur auf eine Eigenschaft zu setzen
- Fùhrt man mit der Maus ùber einen Kaufbutton, erscheint die Steigerung des Preises und wie stark sich ein Kauf auswirkt
- Bomben/Flugzeuge auf der linken Seite des Bildschirms sollte man mit dem linken Turm (linke Maustaste) und Bomben/Flugzeuge
  auf der rechten Seite sollte man mit dem rechten Turm erledigen, die die Entfernung von den Tùrmen logischerweise kleiner ist
- Um schnell einen Level abzuschliessen(Time Attack), kauft man am Anfang nicht nur Money und Humans, sondern vor allem Speed/Aim

Spezielle Tipps zu den einzelnen Levels:
----------------------------------------

mangoo/mangoo2:
 Dieser Level ist noch recht einfach. In der ersten Runde nur Menschen und Money Upgrade kaufen. In der zweiten dann 2 neue Raketen 
 und Aim Upgrade. Danach dann verteilt alles kaufen. Immer dafùr sorgen, dass 10 Menschen im Spiel sind.

Endbosse 1-4:
 Die Endbosse sind alle gut zu schaffen und ein bisschen leichter als die zugehùrigen Levels. 
 Es lohnt sich oft, einiges in Humanpanzerung zu investieren, dadurch fehlt natùrlich Geld fùr andere Upgrades und der Level dauert entsprechend 
 lùnger, kann aber mit ziemlich grosser Wahrscheinlichkeit beendet werden.

Xr:
 Darauf achten, nicht zuviele Menschen am Anfang zu kaufen, da in diesem Level die Preise fùr die Menschen steigen.
 Ansonsten schùn verteilt kaufen und Humanpanzerung nicht vergessen.

Tnt:
 Verluste unter den Menschen sind hier besonders tragisch (jedenfalls bis zur Mitte des Levels), daher unbedingt schùtzen. 
 Auf jeden Fall immer fùr die maximale Anzahl(3) an Menschen sorgen, sonst siehts bùse aus. 

Overlord/Viech:
 Hauptsache man hùlt die Maustaste gedrùckt, dann geht schon nichts schief. Viech ist natùrlich ein bisschen anspruchsvoller


Hardcore Modus:
---------------
Der Hardcore Modus ist nur fùr die ganz Harten unter uns gedacht.
Es lohnt sich meist, ein wenig mehr auf Speed zu setzen, da hier Flugzeuge und Bomben doppelt so schnell sind. 
Ansonsten sollte man nicht an sich selbst zweifeln, wenn man nicht allzuweit kommt. Bisher ist uns nur ein Spieler bekannt, 
der alle Levels geschafft hat. Wer es schafft (ohne Cheats), meldet sich bitte bei uns :-)
Die Endmeister sind Im HC vergleichsweise leicht (bis auf Boss4), schùn auf Humanpanzerung und gut ist. 
Schwerstes Level ist auf jeden Fall XR (genau wie im Normal Modus, aber hier viel extremer).
In Nuke ist das Gewinnen ein wenig Glùckssache, je nachdem wie tief die Flugzeuge fliegen und an welcher Stelle sie die Bomben abwerfen.


--------------------------------------------------------------------------------------------------------
5. VERSIONSHISTORY
------------------

------------------------ 
v 1.5

- Installer hinzugefùgt
- Soundfehler beim AutobuyKnopf behoben, manchmal wurde der Sound viel zu laut abgespielt
- Mausfehler behoben. Man konnte mit der Maus aus dem Spielfenster hinauskommen. Das geht nun nicht mehr.
- Objekte haben jetzt eine (sehr hohe) Geschwindigkeitsbegrenzung, damit es nicht zu stehenden Raketen kommt.
- Kollisionsroutine ùberarbeitet, funktioniert jetzt fùr alle Geschwindigkeiten.
- Level Schnappi hinzugefùgt, spielbar im Time Attack
- Drehfehler gefixt, Flugzeuge und Bomben drehten bei sehr niedrigen/hohen FPS nicht korrekt
- UT Sounds sind als Alternative zu den StandardSounds eingefùgt -> Options
- Anzeigefehler behoben, wenn Explosionen "gerumbelt" haben, und man ins PauseMenù gewechselt hat, war das Bild manchmal verschoben
- Limits fùr Upgrades und Geld gesetzt, so kann es nicht passieren dass Werte schlechter werden durch Kauf eines Upgrades
- Autobuy weiter optimiert
- Linux, Mac und Windowsversion zusammengefùgt.
- Fùr Linux die libstdc++6 in den Ordner libstdc6 gepackt

------------------------ 
v 1.4

- Buyscript hinzugefùgt, man kann die Tasten 1-9 benutzen um mehrere Sachen zu kaufen. Mehr Infos unter data/buyscript.txt
  Damit kann man deutlich schneller einkaufen. Um den Vorteil ein wenig abzuschwùchen kostet jeder Kauf 100 Millisekunden Zeit. ( Ab dem 2ten)
- Internethighscore funktioniert nun einwandfrei
- Autobuy optimiert. Funktioniert jetzt auch bei Levels, bei denen viel konstante Preise zu finden sind. (Endmeister z.B.)
- Sound fùr Feuerwarelogo eingefùgt
- Menù Hintergrund an Webdesign angeglichen.

v 1.36

- Schwabbeleffekt fùr aufpoppende Bomben und Flugzeuge eingebaut. 
  Sieht jetzt deutlich besser aus, wenn ein Flugzeug eine Bombe wirft
- Bei der Internethighscore gab es Probleme, wenn ein Leerzeichen im Levelname
  vorkam.
- Geldeffekt fùr jeden Menschen am Ende einer Runde, so ist leichter zu ersehen dass
  man durch Menschen Geld kriegt.
- Pausiert man das Spiel, wird die Zeit nicht mehr wie bisher weitergezùhlt
- AutoBuyKnopf, kauft immer das billigste und nicht mehr als 10 Menschen
  Drùckt man den Autobuyknopf, bekommt man 10 Strafsekunden, was fùr die aber Story egal ist
------------------------ 

v 1.3
- Beim Umschalten auf Vollbild/Fenster Modus muss man nicht mehr manuell gestartet werden
- BonusLevel Overlord hinzugefùgt, dafùr Level awdonald entfernt
- Im StoryModus wurde mangoo durch mangoo-easy ersetzt, wobei sich mangoo easy durch folgendes unterscheidet:
  10 statt 3 Humans zu Anfang
  Start-Raketenspeed 20% hùher
  Start-Raketenstùrke 20% hùher
  Der Level mangoo bleibt natùrlich fùr die Highscore erhalten
- Score wird rechtsbùndig angezeigt in der Highscore Liste
- Fast alle Levels aus dem Story Mode zu Time Attack hinzugefùgt
  boss1,boss2,boss3,boss4, mangoo2,xr,nuke, viech chronicles,overlord
- ùberschrift unter Timeattack/"Internet" ist jetzt nicht mehr einfach "Time Attack" sondern, 
  bei Internet "Internet" und bei Local "Local"
- Sortierfehler in der lokalen Highscore entfernt, jetzt klappt alles wunderbar
- Start Ladebildschirm geùndert. Es erscheint jetzt das Logo von unserem Team "feuerware"
  statt "loading"
- Credits Url von awar.de.vu abgeùndert auf www.feuerware.com
- Im Menù erscheint jetzt rechts oben ein Button, der auf feuerware verlinkt wird
- Anzeigefehler im Nachtmodus behoben, es kommt nun nicht mehr zu einem Grafikfehler 
  im Fenstermodus.
- Readme um Spieletipps erweitert

------------------------ 

v 1.2

- Internethighscore implementiert, unter Time Attack, Internet
- Bug, der bei sehr geringen FPS auftritt, behoben. Winkel wurden falsch berechnet. Dadurch 
  konnten Lenkraketen nicht mehr richtig treffen
- Anzeigebug beim EndmeisterHP Balken behoben, trat auf wenn es ordentlich gerumbelt hat
- Level Mangoo: Hp der Humans leicht erhùht + Bomb Special schwùcher gemacht
- Fadenkreuz Ladefehler behoben, nach eigenem Fadenkreuz wurde beim Laden eines Standardlevels
  nicht das Standardfadenkreuz geladen
- Score wird neu ermittelt. ((MONEY/10)*3*(UNSTOPPABLE / UNSTOPPABLE_MAX+1))/(HUMAN_DEAD/3)+1
- Aladin entfernt

------------------------ 

v 1.15

- HP Balken fùr die Endmeister eingebaut, einstellbar ist fùr jeden Level ein ENDMASTER: FLugzeugnummer
- Rauch der Flugzeuge steigt nach oben
- Fadenkreuz dahingehend abgeùndert, dass man besser ablesen kann ob man noch einen Extrakill holen kann
- Wettersystem Bugs entfernt, wehte der Wind nach links ( Paramter < 0) , gab es Fehler. Schneeflocken 
  und Regentropfen wurden durch Bilder ersetzt
- Nuke Hintergrundbild leicht aufpoliert, diverse Grafikfehler behoben
- Arcade: Lokale und Internethighscore wùhlbar, unter lokal lùsst sich nun auch der HC_MODE spielen
- Herunterfallende Bomben beim Bush durch andere ausgewechselt
- Finalmusik, wenn das Spiel durchgespielt wird, wird diese abgespielt
- 2tes Fadenkreuz eingefùgt, wùhlbar unter Optionen
- Parameter(config): WINNTER_TIME --> bestimmt, ab wann die Menùmusik wieder abgespielt wird
		     MUSIC_VOLUME --> 0.0 - 1.0, wie laut wird die Musik abgespielst 
		     MUSIC        --> Sounddatei, welche als Musik benutzt wird
- Parameter(level): 
		     MUSIC_VOLUME --> 0.0 - 1.0, wie laut wird die Musik abgespielst 
		     CHANGE_MUSIC        --> Sounddatei, welche als Musik benutzt wird
------------------------ 

v 1.1

- StartSound und Finishsound werden bei leeren Levels nun nicht mehr abgespielt
- Fadenkreuz im Menù wird nun immer richtig angezeigt
- Im Tutorial nen kleinen Fehler behoben
- Xr (Level 8) minimal leichter gemacht
- Endmaster Rice eigenen Schuss zu Laser gemacht
- Double,Multi.....Unstoppable Sounds durch eigene ersetzt, mùssen vielleicht noch ùberarbeitet werden

------------------------ 

v 1.0

- Versionsnummer im Menù unten links ( bisherige Nummerierung wird nicht mehr fortgesetzt, stattdessen 
  wird bei 1.0 ( erste Release Version ) begonnen
- Welcome Sound beim Start des Spiels eingebaut ( welcome.ogg ) thx to faith
- Tutorial Erklùrungen eingebaut ( faith )
- SND_WIN einstellbar jetzt auch in levels.txt ( fùr tutorial )
- Tutorial abgeùndert
- Endmeister Mucke vom xr eingebaut
- Mucke lauter, Sounds leiser
- Explosionen noch was verbessert, sieht jetzt nicht mehr so farbarm aus

_______________________________________________________________________________________________________
                                        PRE VERSIONEN


v37

- Speed optimiert
- HP Anzeige von Flugzeugen wird unter dem Flugzeug angezeigt, wenn das Flugzeug zu hoch fliegt
- Xr Napalm Explosionen der Flugzeuge verringert
- Endmaster Vogel abgeùndert, beim letzten Angriff ( Ausraster ) fliegt er nicht mehr so tief
- Endmaster Baron abgeùndert, beim Cola Angriff fliegt er nicht mehr so lange ausserhalb des Screens
- Endmaster Rice leicht verstùrkt durch schnellere Phaser
- Endmaster Bush 50% mehr HP und leicht verstùrkte Bomben ( vom Himmel )
- Ist der HC Modus einmal aktiviert, wird dies gespeichert und beim nùchsten Starten direkt wieder gesetzt
- Grùùe des roten Bereichs bei Super Raketen wùchst jetzt halb so schnell
- Vorlùufige Version des Burger Levels eingebaut ( Schnappi rausgeworfen wegen Urheberrechten)
- In der config lùsst sich nun die musik wechseln, standard ist game.ogg. Parametername MUSIC
- Human, Rocket Anzeigen im Buymen vertauscht
- Menschen schreien jetzt solange sie unter Feuer ( Napalm ) sind, vorher war es eher ein schleichender Tod
- Sound Fehler behoben, der StartSound wurde auch abgespielt wenn SOUND deaktiviert war
- Musik etwas leiser gemacht, gab Probleme mit den Explosionen ( rauschen )
- Grafik: Da kein Arsch was getan hat und keine Sau sich gemeldet hat Grafiken zu machen, hab ich mich selbst dran
          gesetzt.
   - BuyButtons: Alle neu designt, hoffe man kann jetzt bessa erkennen was was ist
   - Explosionen: Normale Explosion frei per Generator erstellt
                  Napalm an den Rùndern unschùrfer gemacht
		  Nuke bekam Gauss Power
   - Pfeile auf der Karte neu
   - Karte am Rand transparent
   - logo im menù neu gemacht
   - menù hintergrund war mir zu amerikanisch, mal selber was versucht mit strangem effekt
   - stranger effekt noch stranger bei HC Modus
- IS_FEEDER als weitere Eigenschaft bei Bomben eingebaut, lùsst Menschen bei Treffen in die Breite gehen ( 1.0 = NO FEED)

v36
- Credits abgeùndert, da anx nie erreichbar ist fliegt er raus und kriegt special thx
- Zufallsfaktor der Flugzeuge verbessert, kein totaler Zufall mehr, besser berechenbar
- Xrs Menù/Spiel Musik eingebaut
- Xr Level Explosionen der Flugzeuge verùndert
- Statistik fùr UNSTOPPABLE und GODLIKE am Ende einer Runde eingefùgt
- Cheats !!! ( siehe unten )

v35 

- HARDCORE MODE eingefùgt: Flugzeuge und gegnerische Bomben doppelt so schnell
  Sobald einmal die Kampagne normal geschafft, ist dieser verfùgbar. 
- Nuke Rocket Power auf 75 statt 50
- Roter Kugeleffekt fùr geaimte Raketen
- Karte verschùnert
- spieler Rakete neu gemalt
- Performance Test auf 900Mhz Rechner optimal bestanden
  -> Details erhùht ( altes High ist jetzt normal )

v34
- nachtsicht verschùnert
- unstoppable anzeige immer in mitte vom bildschirm
- nuke,arcade von tnt eingebaut
- nuke leicht abgeùndert, arcade leichter gemacht
- UNSTOPPABLE_BONUS in config.txt eingebaut, standard 0
- Storyauswahl grafik leicht verbessert

v33

- nachtsicht fehler behoben
- mangoo2 ùberarbeitet


v32
- rumble einstellbar in levels.txt 0 -> kein rumble, 1 -> flugzeug rumble, 2 -> alles rumble(normal), wird nach jedem level auf standardwert 2 gesetzt
- nachtsicht angefùgt, bei dunkelheit > 0.4 wird ein bereich um das fadenkreuz normal angezeigt, der rest schwarz
- ki PARACHUTE eingefùgt, flugzeug fliegt bis zum boden wo es dann explodiert, fùr kamikaze sachen geeignet
- fehler behoben->level parser konnte button_aimtime nicht dis/enablen 
- karte neu gemalt und system abgeùnder -> gfx/buttons_menu


v31
- buymenu nochmals ùberarbeitet, $ zeichen entfernt, human money absolutanzeige
- change_ground(name) in level parser eingebaut
- fehler bei change_background behoben, bisher musste immer noch 
  weather gesetzt werden, dies ist nun nicht mehr nùtig
- fehler bei anthrax, napalm behoben, wenn napalm und anthrax gleichzeitig eingesetzt 
  wurde, kam es manchmal zum programm absturz
- die meisten wavs wurden durch oggs ersetzt, blùde scheiss arbeit
- viele sounds sind jetzt frei einstellbar in der config.txt
- human-energie balken wird jetzt immer angezeigt, sobald er im roten bereich ist
- fehlerhafte darstellung beim cursor behoben, wurde falsch gedreht bei gelocktem gegner
- 4 hit sounds fùr humans wenn getroffen, ein sterbe sound
- kein explosionssound wenn last_scream gesetzt bei flugzeugen
- xr level eingebaut, aber noch unfertig
- unstoppable spruch und anzeige, wenn alle gegner in einem rutsch 
  gekillt werden ( min. 4), evt. spùter noch belohnung einbauen

v30

- testmusik implementiert
- Kaufmenù ùberarbeitet, Jetzt Prozentangaben zum Anfangswert statt Absolutwerte


v29
- mangoo2 nochmals ùberarbeitet
- anthrax, nuke und napalm abgeùndert

v26

- Rumbleeffekt eingefùhrt, bei Explosionen ab 2.0 kommt es zum durchrùtteln des bildes
- diverse kleine fehler ausgemerzt
- mangoo,mangoo2 fertiggestellt
- endmeister 1-3 total vereinfacht, endmeister 4 noch schwer

v25

- tastenkùrzel fùrs kaufmenù, 1,2,...,7
- raketenschweif verschùnert
- 3 partikelstufen eingebaut, low, normal, high
- mangoo1,2 so gut wie fertig, story rebalanced
- vogel endgegner entschùrft, letzter angriff war zu heftig
- rice endgegner entschùrft, laserreichweite verringert, weniger torps

v22
- Wenn ein Carrier verreckt, sterben nun auch seine Kinder
- Anvisierfehler behoben, manche Flugzeuge wurden nicht anvisiert
- mangoo2 ùberarbeitet, story leicht vereinfacht
- story karte eingefùgt
- helden bug behoben, konnten nicht sterben
- diverse andere bugs entfernt

v21

- story vorabversion fertiggestellt, fehlt noch sinnvolle handlung 
  und soundeffekte

v20

- Menù neu entworfen
- 4 Endgegner Levels vorlùufig eingebaut, mùssen noch angepasst 
  werden

V19


- AimTime stùrker ins Spiel eingebunden. bringt jetzt zusùtzliche Stùrke fùr Rakete. 
  Bsp.: AnfangsAimtime=1000, aktuelle Aimtime = 500 =>  Raketenpower = Raketenpower_normal* 1000/500
- Viele Bugs entfernt


v18

- BuyButtons kùnnen de und aktiviert werden
- Storyoberflùche abgeschlossen
- Partikeleffekte hinzugefùgt/ Bluteffekte


Cheats:

Die Cheats funktionieren nur im Story Modus, im TimeAttack klappt da mal gaaar nix.

Drùcke die Tasten M,A,N,G,O gleichzeitig wenn du dich auf der Campaign Karte befindest, um alle Levels freizuschalten.
Drùcke F10 im Spiel, um direkt in die nùchste Runde zu kommen.
F9 im Spiel: lùsst einen das aktuelle Level direkt abschliessen
F8 im Kaufmenù: bringt einen kleinen Bonus von 100.000 Geldeinheiten
F7 im Kaufmenù: alle Upgrades auf maximaler Stufe





Bei Fragen, email an athurn@gmx.de
