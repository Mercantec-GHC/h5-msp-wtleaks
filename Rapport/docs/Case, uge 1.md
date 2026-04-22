## Case: Real-time chat applikation med rum og filhåndtering WTLeaks

Hjælp! En bruger har igen lækket fortrolig information igennem War Thunder! De har derfor brug for hurtig og effektiv og ikke mindst sikker kommunikation. Værktøjer som Slack, Discord og Teams tilbyder dette, men er ofte enten for komplekse eller lukkede systemer. Det er her, vi kommer ind i billedet: hos WTLeaks har vi en løsning, der fungerer, så det ikke sker igen.
### Projektbeskrivelse
Vi vil udvikle en chat-applikation/platform, hvor brugere kan skrive med hinanden, enten i private eller offentlige rum. Brugere vælger selv, hvilke rum, de vil deltage i, og rummene identificeres med et ID og et navn. Offentlige rum kan brugere finde i en liste eller ved søgning, og private rum kan kun deltages i ved brug af givet id og adgangskode. Der er ikke nogen begrænsning for, hvor mange rum, en bruger kan deltage i. Beskeder er tilknyttet brugeren, der sender dem, og kan fjernes til hver en tid. Alle rum har en ejer og en valgfri mængde moderatorer, som kan fjerne både beskeder og brugere fra det tilknyttede rum. Brugere skal have fri adgang til at ændre bl.a. deres skærmnavn.
#### Formål
For vores brugere er målene med vores skalerbare chat-løsning, at de kan:
- Kommunikere i real-time
- Organisere samtaler i rum
- Dele filer
- Være sikre med deres data

For os er målene med dette projekt at vise vores forståelse og kompetencer indenfor:
- Real-time kommunikation
- Full Stack udvikling (frontend + backend)
- Håndtering af brugere
- Arbejde under tidspres

```mermaid
---
config:
    themeVariables:
        taskTextColor: 'black'
        taskTextOutsideColor: 'black'
---
gantt
    title H5 MSP WTLeaks – estimeret tidsplan
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m
    excludes  weekends, 2026-05-14, 2026-05-15, 2026-05-25
    
    section Dokumentation
    Rapportskrivning  : 2026-04-20, 20d
    Oprettelse af GitHub Projects-side  : 2026-04-20, 1d
    Opstart på dokumentation  : 2026-04-20, 3d
    
    section Udvikling
    %% Uge 1
    Case, problemformulering, estimeret tidsplan  : case, 2026-04-20, 3d
    Opstart på projektstruktur  : 2026-04-20, 3d
    Node.js-opsætning  : node, 2026-04-20, 1d
    Opsætning af Linux-server  : tux, 2026-04-20, 1d
    Kommunikation mellem sockets  : sock, 2026-04-21, 1d
    Auth/JWT  : jwt, 2026-04-21, 9d
    Test af chatrum  : 2026-04-22, 1d
    Opsætte Postgres  : 2026-04-22, 2d
    Opsætte start på API  : 2026-04-23, 2d
    Merge, test på tværs  : 2026-04-23, 2d
    Godkendelse af case og tidsplan  : crit, milestone, 2026-04-25, 0d
    
    %% Uge 2
    Kommunikation med API  : 2026-04-27, 5d
    Videreudvikling på API  : 2026-04-27, 5d
    Oprettelse af chatrum  : 2026-04-27, 2d
    Login  : 2026-04-29, 3d
    Administratorer  : 2026-04-29, 3d
    Private/offentlige chatrum  : 2026-04-29, 3d
    Auth og deltagelse på chatrum  : 2026-04-29, 3d
    Færdig MVP  : crit, milestone, 2026-05-02, 0d
    
    %% Uge 3
    Moderatorer  : 2026-05-04, 1d
    Profilbilleder  : 2026-05-04, 1d
    Ændring af brugerinfo  : 2026-05-04, 1d
    Sletning af beskeder  : 2026-05-05, 1d
    Sletning af bruger  : 2026-05-05, 1d
    Søgning på off. chatrum  : 2026-05-05, 1d
    Fildeling  : 2026-05-06, 3d
    
    %% Uge 4
    Ekstra styling  : 2026-05-11, 3d
    Finpudsning  : 2026-05-11, 3d
    
    %% Uge 5
    Dedikerede test  : 2026-05-18, 3d
    Aflevering  : crit, milestone, 2026-05-21, 0d
    Præsentation  : 2026-05-21, 3d
    
    %% Uge 6
    Eksamensforberedelse  : 2026-05-26, 1d
    Eksamen  : crit, milestone, 2026-05-28, 0d
```