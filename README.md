# Vestora · StratoshiVibes

Παρακολούθηση και σχεδιασμός επενδύσεων για το Solana Seeker. Crypto, μετοχές, ETF, χρυσός, ακίνητα και ό,τι άλλο, σε ένα μέρος. Η εφαρμογή δείχνει πώς πάνε οι επενδύσεις σε σύγκριση με απλές εναλλακτικές (S&P 500, Nasdaq, Bitcoin, κατάθεση) και βοηθά να σχεδιάσεις τη συνέχεια, με εύρος σεναρίων και ορατές παραδοχές. Περιγράφει, δεν προτείνει. Τα στοιχεία του χρήστη μένουν μόνο στη συσκευή.

- Εφαρμογή: https://vestora.stratoshivibes.com/
- Απόρρητο: https://vestora.stratoshivibes.com/privacy.html
- Όροι: https://vestora.stratoshivibes.com/terms.html

## Ρύθμιση μία φορά

### 1. GitHub Pages
**Settings → Pages**: Source «Deploy from a branch», Branch `main`, folder `/ (root)`, **Save**. Στο **Custom domain** πρέπει να γράφει `vestora.stratoshivibes.com` (το διαβάζει από το αρχείο `CNAME`). Μόλις εμφανιστεί, τσέκαρε **Enforce HTTPS**.

### 2. DNS (εκεί που είναι το stratoshivibes.com, π.χ. Cloudflare)
Νέα εγγραφή: Type `CNAME`, Name `vestora`, Target `stratanen.github.io`. Στο Cloudflare: **DNS only** (γκρι σύννεφο).

### 3. Κωδικός για το APK
**Settings → Secrets and variables → Actions → New repository secret**: Name `KEYSTORE_PASSWORD`, Value ο ίδιος κωδικός με τα άλλα apps.

### 4. Helius
Στο Helius dashboard, στο ίδιο API key με τα άλλα apps, πρόσθεσε το `vestora.stratoshivibes.com` στα allowed domains. Χωρίς αυτό δεν δουλεύει ο έλεγχος SKR και Genesis Token ούτε η εισαγωγή από wallet.

### 5. Πρώτες τιμές
**Actions → Update prices → Run workflow**. Φτιάχνει το `data/history.json`. Μετά τρέχει μόνο του κάθε βράδυ Δευτέρα ως Παρασκευή. Χωρίς αυτό το αρχείο η εφαρμογή γράφει ότι δεν φορτώνουν οι τιμές.

## Φτιάξε το Android APK

1. **Actions → Build Android APK → Run workflow**.
2. **version_code**: 1 την πρώτη φορά, και +1 σε κάθε νέα έκδοση.
3. **version_name**: π.χ. `1.0.0`.
4. Το APK εμφανίζεται στη σελίδα **Releases**.

Για αλλαγές στην εφαρμογή δεν χρειάζεται νέο APK: ανεβαίνουν εδώ και φαίνονται αμέσως. Νέο APK μόνο όταν αλλάζει όνομα, εικονίδιο ή κάτι στο ίδιο το APK. Σε κάθε αλλαγή αρχείων ανέβαζε τον αριθμό στο `sw.js` (`vestora-v1` → `vestora-v2`).

## Τι υπάρχει στο repo

| Αρχείο | Τι είναι |
| --- | --- |
| `index.html` | Όλη η εφαρμογή |
| `data/history.json` | Εβδομαδιαίες τιμές σε ευρώ, 10 χρόνια (το φτιάχνει το workflow) |
| `scripts/build_prices.py` | Κατεβάζει τις τιμές (Yahoo Finance, με Stooq και ΕΚΤ ως εφεδρεία) |
| `wallet.bundle.js` | Σύνδεση wallet (Mobile Wallet Adapter), ίδια με τα άλλα apps |
| `sw.js` | Offline λειτουργία |
| `fonts/` | Γραμματοσειρά Commissioner (OFL) |
| `privacy.html`, `terms.html` | Σελίδες για το store |
| `.github/workflows/` | Τιμές και κατασκευή APK |

Για να προστεθεί νέο asset στη λίστα, γράψε μια γραμμή στο `CATALOG` του `scripts/build_prices.py` και τρέξε το «Update prices».

## Αλλαγές στον κώδικα

Το `index.html` χτίζεται από τα αρχεία του φακέλου `src/` με `bash src/build.sh`. Τα ελληνικά κείμενα είναι μέσα στον κώδικα και τα αγγλικά στο `src/en_dict.json`.

## Google Play

Η έκδοση Google Play ανοίγει τη `https://vestora.stratoshivibes.com/?edition=play`: χωρίς wallet και χωρίς SKR, με όλες τις λειτουργίες δωρεάν. Πακέτο `com.stratoshivibes.vestora.play`, ξεχωριστό από του dApp Store.

1. **Actions → Build Google Play bundle (AAB) → Run workflow** (version_code 1, version_name 1.0.0). Στα Releases βγαίνουν το `.aab` για το Play Console και ένα `-test.apk` για δοκιμή στο κινητό.
2. Στο Play Console: νέα εφαρμογή, ανέβασμα του `.aab`.
3. **Test and release → App integrity → App signing**: αντίγραψε το «SHA-256 certificate fingerprint» του *App signing key* και πρόσθεσέ το στο `.well-known/assetlinks.json`, δίπλα στο υπάρχον. Χωρίς αυτό η εφαρμογή ανοίγει με γραμμή διεύθυνσης στην κορυφή.
