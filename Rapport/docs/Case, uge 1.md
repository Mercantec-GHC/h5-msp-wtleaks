## Case: Real-time chat applikation med rum og filhåndtering WTLeaks

Hjælp! En bruger har igen lækket fortrolig information igennem War Thunder! De har derfor brug for hurtig og effektiv og ikke mindst sikker kommunikation. Værktøjer som Slack, Discord og Teams tilbyder dette, men er ofte enten for komplekse eller lukkede systemer. Det er her, vi kommer ind i billedet: hos WTLeaks har vi en løsning, der fungerer, så det ikke sker igen.

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
    todayMarker off
    
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
