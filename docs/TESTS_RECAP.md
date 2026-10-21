# Report dei test automatici

> Report storico dell'esecuzione del 20 ottobre 2026. Il codice è stato modificato dopo quell'esecuzione; non usare questi risultati come verifica del commit attuale senza rieseguire la suite.

Questo report descrive cosa è stato eseguito, quali comportamenti sono stati controllati e cosa si può concludere dai risultati. I test verificano funzioni e percorsi specifici: un esito positivo non equivale a una certificazione di sicurezza dell'intera applicazione.

## Risultato dell'ultima esecuzione

Esecuzione completa effettuata con:

```bash
npm test -- --reporter=verbose
```

**Esito: 41 test superati su 41, distribuiti in 10 file; nessun test fallito.** L'ultima esecuzione completa è del 20 ottobre 2026 e Vitest ha riportato una durata di circa 2 secondi. I test d'integrazione hanno usato database SQLite temporanei, creati durante l'esecuzione e rimossi alla fine.

## Risultati e casi verificati

### Connessioni e database

| File | Casi effettivamente provati | Esito |
| --- | --- | --- |
| [`tests/databaseConnectionConfig.test.js`](tests/databaseConnectionConfig.test.js) | 1. Le stringhe di connessione salvate nel formato precedente continuano a essere lette. 2. Opzioni SSH e SSL vengono serializzate e rilette mantenendo la stringa del database. 3. Un involucro di configurazione salvata con JSON non valido viene rifiutato. 4. SSH richiede un'impronta SHA-256 e valida/normalizza host, porta e username. 5. L'autenticazione SSH tramite chiave rifiuta una chiave che non sembra una private key. 6. SSL PostgreSQL sceglie `verify-full` se la modalità è sconosciuta, mentre SQLite ignora le opzioni SSL. | **6/6 superati** |
| [`tests/databaseQuery.integration.test.js`](tests/databaseQuery.integration.test.js) | Crea un vero database SQLite su file temporaneo con due righe; invoca la route `/api/playground/query`; controlla che la SELECT restituisca entrambe le righe; invia un UPDATE; esegue una seconda SELECT per verificare che il valore sia stato davvero modificato. Controlla anche che la ricerca del dataset sia vincolata all'utente autenticato e che venga finalizzato l'audit. | **1/1 superato** |
| [`tests/sqliteStorage.test.js`](tests/sqliteStorage.test.js) | 1. Crea un percorso di upload specifico per utente e converte il percorso in connection string e viceversa. 2. Permette al proprietario di validare il proprio file, ma rifiuta lo stesso file per un altro utente. 3. Rifiuta un symlink che punta fuori dalla directory dell'utente. 4. Elimina il file e la directory richiesti e controlla che non siano più presenti. | **4/4 superati** |
| [`tests/sqlIdentifiers.test.js`](tests/sqlIdentifiers.test.js) | Controlla che la quotatura di un identificatore sia demandata al generatore del dialetto e verifica le espressioni di uguaglianza che trattano correttamente i `NULL` per PostgreSQL, SQL Server, SQLite, MySQL e MariaDB. | **6/6 superati** |

### Login, sessione e autenticazione a due fattori

| File | Casi effettivamente provati | Esito |
| --- | --- | --- |
| [`tests/nextAuth.test.js`](tests/nextAuth.test.js) | 1. Controlla che la configurazione usi sessioni JWT, passi il secret configurato a NextAuth e registri GitHub con le credenziali server-side. 2. Controlla quali campi passano dall'utente al token e dal token alla sessione, verificando che password hash e segreto TOTP non vengano copiati. 3. Il proxy risponde 401 senza identità e 403 con 2FA attiva ma senza prova valida. 4. Il proxy permette il passaggio con prova 2FA valida e quando 2FA non è attiva. | **4/4 superati** |
| [`tests/nextAuthToken.integration.test.js`](tests/nextAuthToken.integration.test.js) | Usa le funzioni reali `encode` e `getToken` di NextAuth per creare e leggere cookie JWT cifrati, poi li passa alla guardia API. Verifica: sessione valida accettata; cookie alterato rifiutato; cookie cifrato con un secret diverso rifiutato; token scaduto rifiutato. Dopo il rifiuto non viene interrogato il database utenti. Con 2FA attiva, senza prova valida l'API nega l'accesso; con una prova reale, firmata e legata all'utente, lo consente. La sola lettura dell'utente dal DB è simulata. | **4/4 superati** |
| [`tests/nextAuthOAuth.integration.test.js`](tests/nextAuthOAuth.integration.test.js) | Esegue il gestore pubblico NextAuth e il provider GitHub effettivo del progetto. Gli endpoint OAuth sono serviti da un server locale controllato dal test; il profilo usa la funzione originale del provider GitHub. L'adapter Prisma persiste davvero utente e account in un SQLite temporaneo. Verifica login completo fino al cookie e all'endpoint `/api/auth/session`; callback con `state` alterato rifiutata senza account; POST di login con token CSRF errato rifiutata prima di iniziare OAuth. | **3/3 superati** |
| [`tests/requireTwoFactorApi.test.js`](tests/requireTwoFactorApi.test.js) | 1. Senza sessione l'API risponde 401 e non consulta l'utente nel database. 2. Utente autenticato senza 2FA: accesso consentito senza verificare una prova. 3. 2FA attiva senza prova: risposta 403. 4. 2FA attiva con prova valida: accesso consentito. 5. Sessione riferita a un utente che non esiste più: risposta 401. | **5/5 superati** |
| [`tests/twoFactor.test.js`](tests/twoFactor.test.js) | 1. Cifra e decifra un segreto TOTP nel formato versionato; un ciphertext alterato viene rifiutato. 2. Accetta un codice TOTP valido a sei cifre e rifiuta codici malformati o non validi. 3. Verifica lockout e scadenza del setup rispetto a un orario controllato, inclusa la durata di dieci minuti del segreto temporaneo. 4. Controlla l'aggiornamento atomico del passo TOTP verificato: un passo già consumato non può essere riutilizzato. | **4/4 superati** |
| [`tests/twoFactorProof.test.js`](tests/twoFactorProof.test.js) | 1. Una prova firmata è valida per l'utente e la finestra temporale previsti. 2. La stessa prova non è valida per un altro utente. 3. Firma modificata, stringa malformata, prova scaduta e prova emessa nel futuro vengono rifiutate. 4. La creazione della prova fallisce se manca il secret di firma. | **4/4 superati** |

### Riepilogo numerico

| Area | File | Test superati |
| --- | ---: | ---: |
| Connessioni e SQL | 3 | 13 |
| Autenticazione e 2FA | 6 | 24 |
| Storage SQLite | 1 | 4 |
| **Totale** | **10** | **41/41** |

La somma per area è organizzata per argomento: `sqlIdentifiers` è incluso nell'area Connessioni e SQL; `sqliteStorage` è conteggiato separatamente in Storage SQLite.

## Quanto è realistico il test con SQLite

Il test d'integrazione non si limita a simulare le query: crea e usa un database SQLite reale tramite Sequelize e passa dalla route API dell'app. Quindi copre il percorso applicativo di selezione del dataset, apertura della connessione esterna, esecuzione SQL, risposta API e rilascio della connessione.

Per mantenere il test isolato e ripetibile, sono simulati i servizi interni non pertinenti alla prova SQL: sessione/guardia 2FA, database applicativo Prisma che contiene la configurazione del dataset, decrittazione della connection string, audit e metriche. Il file SQLite viene creato nella directory temporanea del sistema e rimosso dopo il test. Non sono lette credenziali dal `.env` e non viene contattato alcun provider database remoto.

## NextAuth: cosa significa il risultato

La suite NextAuth ha tre livelli. `nextAuth.test.js` verifica configurazione/callback e alcuni rami del proxy con dipendenze simulate. `nextAuthToken.integration.test.js` usa i metodi reali di cifratura/decifratura JWT e la guardia API. `nextAuthOAuth.integration.test.js` esegue il gestore pubblico NextAuth, il provider GitHub effettivo e l'adapter Prisma contro un database SQLite reale.

Nel test OAuth il servizio remoto GitHub è sostituito da endpoint OAuth locali controllati: quindi si verificano il giro authorization → token → userinfo, la callback, il controllo `state`, la protezione CSRF, il profilo GitHub, la persistenza account/utente e la sessione. Non vengono contattati GitHub né usati account o credenziali reali. Il test Prisma usa un client temporaneo generato da `prisma/test-auth-schema.prisma`; non usa il database MySQL dell'app.

La protezione delle API viene inoltre testata separatamente in `requireTwoFactorApi.test.js`. Insieme, questi test controllano i rami principali di autenticazione/2FA implementati nel codice; non misurano la resistenza a ogni possibile attacco o configurazione errata in produzione.

## Comandi utili

Eseguire l'intera suite:

```bash
npm test
```

Eseguire un solo file, ad esempio la suite NextAuth:

```bash
npx vitest run tests/nextAuth.test.js
```

Eseguire un singolo test per nome:

```bash
npx vitest run tests/nextAuth.test.js -t "fails closed"
```

## Cosa non è stato verificato da questa suite

- Login end-to-end nel browser con GitHub e callback OAuth reale.
- Chiamate ai server GitHub reali e login con un account GitHub effettivo; nel test OAuth gli endpoint provider sono locali.
- Connessioni remote a MySQL, MariaDB, PostgreSQL o SQL Server con credenziali effettive.
- Carico concorrente elevato, latenza di rete, resilienza a interruzioni e comportamento sotto stress.
- Tutte le API, schermate e combinazioni di input dell'applicazione.
- Verifica completa delle configurazioni di deploy, cookie, domini, secret e variabili d'ambiente in produzione.

Per questo motivo, il risultato corretto da leggere è: **41 test su 41 superati, inclusi il flusso OAuth NextAuth con persistenza Prisma SQLite e la verifica di cookie JWT reali. Il provider remoto GitHub e il browser non sono stati coinvolti; la suite non è un collaudo esaustivo né una certificazione di sicurezza.**
