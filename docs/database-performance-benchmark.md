# Misurare le prestazioni del Playground

Questa procedura serve a confrontare il tempo lato server, le singole fasi di accesso al database e il costo di rendering della tabella. Non eseguire i carichi su un database di produzione: usare un database MySQL dedicato con dati sintetici e dimensioni rappresentative.

## Abilitare le misurazioni

Per registrare tutte le richieste monitorate nei log del server:

```env
DATABASE_PERFORMANCE_LOG_ALL=true
NEXT_PUBLIC_DATABASE_PERFORMANCE_LOG_ALL=true
```

Per registrare solo operazioni lente, lasciare disattivata la prima variabile e configurare la soglia (default: 1.000 ms):

```env
DATABASE_SLOW_OPERATION_MS=1000
NEXT_PUBLIC_DATABASE_RENDER_SLOW_MS=16
```

Riavviare l'app dopo aver modificato le variabili. Le variabili `NEXT_PUBLIC_*` vengono incorporate nella build client e richiedono una nuova build negli ambienti deployati.

## Eventi disponibili

Il server scrive righe JSON con `event: "database.performance"`. I campi `phases_ms` separano:

- `app_database_lookup`: lettura del dataset salvato nell'app;
- `connection_slot_wait`: attesa del limite locale o del lease condiviso;
- `external_connection_acquire`: validazione host/DNS e acquisizione del pool MySQL;
- `schema_metadata_query`: metadati della tabella;
- `external_page_query`, `external_count_query` o `external_query`: tempo speso nella query al database esterno;
- `internal_page_query` o `internal_count_query`: query dell'Activity history sul database dell'app.

Ogni evento include la durata totale lato server, esito e numero di righe restituite, contate o modificate quando disponibile. Non registra query, valori delle celle, connection string, nome del database o ID utente. Il `request_id` permette di correlare le fasi della stessa richiesta.

Il browser registra `event: "database.render.performance"` per i commit della tabella sopra soglia. Questo misura il costo React del rendering, non il tempo di rete. Per confrontare latenza vista dall'utente con il tempo server, usare anche la scheda Network degli strumenti sviluppatore.

## Matrice di benchmark

Usare tabelle sintetiche con circa 10 mila, 100 mila e 1 milione di righe. Per ciascuna dimensione predisporre una tabella con chiave primaria e una senza; aggiungere una colonna indicizzata e una non indicizzata. Annotare la versione MySQL, CPU/RAM, regione, schema e indici per rendere ripetibile il confronto.

Per ogni scenario eseguire almeno 20 richieste e confrontare mediana e 95° percentile:

1. apertura tabella e tempo fino alla visualizzazione della prima pagina;
2. conteggio esatto, misurato separatamente dall'apertura;
3. pagina successiva con cursore e, dove applicabile, paginazione `OFFSET`;
4. filtri `equals`, `starts with` e `contains` su colonne indicizzate e non indicizzate;
5. Activity history senza filtri e con filtri;
6. `SELECT` SQL che restituisce poche righe e query che supera il limite della risposta;
7. gli stessi casi con 1, 5 e 10 richieste concorrenti.

Per ogni run salvare mediana, p95, errori, righe restituite, `truncated` e, se possibile, l'output di `EXPLAIN` delle query lente. Non confrontare solo la durata totale: una richiesta lenta in `external_connection_acquire` indica rete/DNS/pool; una lenta in `external_*_query` indica query o database; una lenta nel browser con query rapida indica rendering.

## Seconda prova locale (15 ottobre 2026)

Su MySQL 8.0.40 locale ho creato due tabelle temporanee da 1 milione di righe, una con chiave primaria e una senza. La prima pagina con PK ha misurato 0,26 ms di mediana / 3,63 ms p95; il cursore dopo 500.000 righe 0,21 / 0,29 ms. Il conteggio esatto ha misurato 82,73 / 85,57 ms. Un `OFFSET 900.000` ha misurato 156,43 / 221,74 ms con PK e 220,92 / 238,37 ms senza PK. Un `contains` raro (`%rareneedle%`) ha misurato 305,74 / 308,93 ms.

Ho poi confrontato il filtro `startsWith` su una colonna testuale indicizzata e con collation case-insensitive, su 200.000 righe. La forma precedente con `LOWER(CAST(...))` misurava 13,25 / 18,11 ms e usava l'indice primario. La nuova forma diretta `column LIKE 'prefix%'` misurava 0,39 / 0,55 ms; `EXPLAIN` mostrava una range scan sull'indice testuale. Il risultato dipende dalla presenza di un indice adatto e dalla collation; colonne non indicizzate e `contains` con wildcard iniziale possono ancora richiedere scansioni. Le tabelle del benchmark sono state eliminate dopo la prova.

Queste sono misure di query calde in locale, non di richieste end-to-end tramite browser, API e rete.

## Come scegliere l'intervento

- Query lenta: esaminare `EXPLAIN`, indici e piano di esecuzione prima di modificare il client.
- Conteggio lento: mantenerlo asincrono o offrire un conteggio stimato per tabelle grandi.
- `OFFSET` lento: aggiungere paginazione keyset basata su una chiave stabile; senza una chiave univoca non esiste un cursore generale affidabile.
- `contains` lento: `LIKE '%valore%'` può richiedere la scansione di molte righe; un indice B-tree normale non accelera un pattern con wildcard iniziale. Per dataset grandi, valutare una strategia di ricerca dedicata prima di cambiare lo schema del database.
- Acquisizione lenta: separare DNS/validazione, handshake e attesa slot con misure di rete e del pool.
- Rendering lento: ridurre celle montate con virtualizzazione e controllare le dipendenze che causano rerender.
- Saturazione: usare le misure di attesa slot e gli errori 429 per regolare la concorrenza e dimensionare i pool.

## Limiti delle misure attuali

Le misure sono diagnostiche, non un sistema di telemetria centralizzato: i log vanno raccolti dal runtime che ospita l'app. Il rendering React Profiler produce misure affidabili soprattutto in sviluppo o con una build React profilata; il tempo di rete si legge separatamente dagli strumenti del browser. I risultati di benchmark non sono stati eseguiti automaticamente perché richiedono un database di prova con dimensioni e risorse controllate.
