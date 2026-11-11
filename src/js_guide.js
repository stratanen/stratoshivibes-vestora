/* ---------- "Πώς υπολογίζεται" / "How it works": every number in the app explained simply, with the user's own figures ----------
   This file is written in both languages side by side (T(greek, english)) and is NOT passed through the i18n extractor. */
const T=(el,en)=>LANG==='en'?en:el;
const HOW_IDS=['prices','value','capital','gain','avg','twr','mwr','bench','risk','fees','plan','left'];
function howMine(html){return `<div class="mine"><span class="mlbl">${T('Στο δικό σου χαρτοφυλάκιο','In your portfolio')}</span>${html}</div>`}
function howEx(html){return `<div class="hex"><span class="mlbl">${T('Παράδειγμα','Example')}</span>${html}</div>`}
function howFx(html){return `<p class="fx">${html}</p>`}
function howCard(id,q,sub,body,open){
  return `<details class="howc" id="h-${id}"${open?' open':''}><summary><span class="hq">${q}</span><span class="hs">${sub}</span></summary><div class="hb">${body}</div></details>`;
}
function renderHowPage(){
  const box=$('howBody');if(!box)return;
  const D0=typeof D!=='undefined'?D:null,has=!!(D0&&D0.hold),pro=isPro();
  const b=(v,c)=>`<b class="num${c?' '+c:''}">${v}</b>`;
  const lockNote=T('Με το Pro βλέπεις εδώ το δικό σου νούμερο.','With Pro you see your own figure here.');
  const noData=T('Πρόσθεσε τις αγορές σου (ή φόρτωσε το παράδειγμα από τις Ρυθμίσεις) για να δεις εδώ τα δικά σου νούμερα.','Add your purchases (or load the example from Settings) to see your own figures here.');
  const gain=has?D0.end-D0.inv+D0.income:0;
  const r=depRate();
  const cards=[];

  /* 1. prices */
  cards.push(howCard('prices',T('Από πού έρχονται οι τιμές;','Where do the prices come from?'),T('Πηγές, ώρα ενημέρωσης, «αβέβαιη τιμή»','Sources, update times, “uncertain price”'),
    `<p>${T('Κάθε τιμή στην εφαρμογή έχει γραμμένη από κάτω την πηγή της και πόσο πρόσφατη είναι.','Every price in the app has its source and how recent it is written underneath.')}</p>
    <ul>
      <li>${T('<b>Μετοχές και ETF:</b> η τιμή κλεισίματος του χρηματιστηρίου. Ενημερώνεται κάθε βράδυ μετά το κλείσιμο της Αμερικής.','<b>Stocks and ETFs:</b> the exchange closing price, updated every evening after the US close.')}</li>
      <li>${T('<b>Bitcoin, Ethereum, Solana, xStocks και tokens του Solana:</b> ζωντανή τιμή από το Jupiter κάθε φορά που ανοίγεις την εφαρμογή.','<b>Bitcoin, Ethereum, Solana, xStocks and Solana tokens:</b> a live price from Jupiter every time you open the app.')}</li>
      <li>${T('<b>Tokens του Ethereum:</b> από το DefiLlama. <b>Hyperliquid:</b> από το ίδιο το Hyperliquid.','<b>Ethereum tokens:</b> from DefiLlama. <b>Hyperliquid:</b> from Hyperliquid itself.')}</li>
      <li>${T('<b>Ό,τι πρόσθεσες με το χέρι</b> (π.χ. ακίνητο): η τιμή που έβαλες εσύ, μέχρι να την αλλάξεις.','<b>Anything you added by hand</b> (e.g. property): the price you entered, until you change it.')}</li>
    </ul>
    <p>${T('Όλα μετατρέπονται σε ευρώ. Ό,τι είναι σε δολάρια μετατρέπεται με την ισοτιμία ευρώ/δολαρίου, οπότε και η κίνηση του δολαρίου επηρεάζει την αξία σου, όπως στην πραγματικότητα.','Everything is converted to euros. Dollar assets use the euro/dollar rate, so dollar moves affect your value, just as they do in reality.')}</p>
    <p>${T('<b>Έλεγχοι:</b> αν μια ζωντανή τιμή απέχει απίστευτα πολύ από το χθεσινό κλείσιμο, αγνοείται και μένει το κλείσιμο. Αν ένα token έχει πολύ μικρή αγορά, γράφει <span class="neg">αβέβαιη τιμή</span>: η τιμή υπάρχει, αλλά μπορεί να μην πουλιέται στην πράξη σε αυτήν.','<b>Checks:</b> if a live price is unbelievably far from yesterday’s close, it is ignored and the close is kept. If a token trades in a very thin market it says <span class="neg">uncertain price</span>: the price exists, but you may not be able to sell at it.')}</p>
    <p>${T('Το ιστορικό είναι <b>εβδομαδιαίο</b> για 10 χρόνια: για κάθε εβδομάδα κρατιέται μία τιμή. Η τρέχουσα εβδομάδα παίρνει πάντα την πιο πρόσφατη τιμή.','History is <b>weekly</b> for 10 years: one price per week. The current week always uses the latest price.')}</p>`,true));

  /* 2. value */
  let mv=noData;
  if(has){const top=D0.hold.slice(0,3).map(h=>`<li>${esc(meta(h.a).name)}: ${nf(h.qty<1?4:2).format(h.qty)} × ${price(h.now)} = ${b(eur.format(h.val))}</li>`).join('');
    mv=`<ul>${top}</ul><p>${T('…και ούτω καθεξής για όλες τις θέσεις. Σύνολο:','…and so on for every holding. Total:')} ${b(eur.format(D0.end))}</p>`}
  cards.push(howCard('value',T('Πόσο αξίζει το χαρτοφυλάκιό μου;','What is my portfolio worth?'),T('Συνολική αξία','Total value'),
    `<p>${T('Για κάθε θέση: <b>πόσα κομμάτια έχεις × τρέχουσα τιμή</b>. Μετά προστίθενται όλες οι θέσεις.','For each holding: <b>how many units you own × current price</b>. Then all holdings are added up.')}</p>
    ${howFx(T('Συνολική αξία = Σ (ποσότητα × τρέχουσα τιμή)','Total value = Σ (quantity × current price)'))}
    ${howMine(mv)}`));

  /* 3. capital */
  cards.push(howCard('capital',T('Πόσα χρήματα έβαλα;','How much money did I put in?'),T('Καθαρό κεφάλαιο','Net capital'),
    `<p>${T('Όσα πλήρωσες για αγορές (μαζί με τις προμήθειες), μείον όσα πήρες πίσω από πωλήσεις (μετά τις προμήθειες).','What you paid for purchases (including fees), minus what you got back from sales (after fees).')}</p>
    ${howFx(T('Καθαρό κεφάλαιο = αγορές + προμήθειες − έσοδα πωλήσεων','Net capital = purchases + fees − sale proceeds'))}
    <p>${T('Τα tokens που πήρες από <b>staking</b> ή ανταμοιβές δεν μετράνε ως κεφάλαιο, γιατί δεν τα πλήρωσες: μετράνε ως κέρδος.','Tokens you received from <b>staking</b> or rewards are not counted as capital, because you did not pay for them: they count as profit.')}</p>
    ${howMine(has?`<p>${T('Καθαρό κεφάλαιο:','Net capital:')} ${b(eur.format(D0.inv))}</p>`:noData)}`));

  /* 4. gain */
  cards.push(howCard('gain',T('Κέρδισα ή έχασα;','Did I make or lose money?'),T('Κέρδος/ζημιά σε ευρώ','Profit/loss in euros'),
    `<p>${T('Το πιο απλό και το πιο σημαντικό νούμερο: πόσα έχεις σήμερα σε σχέση με όσα έβαλες. Αν πήρες μερίσματα ή τόκους, προστίθενται κι αυτά.','The simplest and most important number: what you have today compared with what you put in. Dividends or interest you received are added too.')}</p>
    ${howFx(T('Κέρδος = συνολική αξία − καθαρό κεφάλαιο + μερίσματα','Profit = total value − net capital + dividends'))}
    ${howMine(has?`<p>${eur.format(D0.end)} − ${eur.format(D0.inv)}${D0.income?' + '+eur.format(D0.income):''} = ${b((gain>0?'+':'')+eur.format(gain),sgn(gain))}</p>`:noData)}`));

  /* 5. average price */
  let ma=noData;
  if(has){const h=D0.hold[0];ma=`<p>${esc(meta(h.a).name)}: ${T('μέση τιμή','average price')} ${b(price(h.avg))}, ${T('τρέχουσα','current')} ${b(price(h.now))} → ${b(pct(h.plp),sgn(h.pl))} (${b((h.pl>0?'+':'')+eur.format(h.pl),sgn(h.pl))})</p>`}
  cards.push(howCard('avg',T('Τι είναι η μέση τιμή και το κέρδος κάθε θέσης;','What are the average price and the gain of each holding?'),T('Μέση τιμή αγοράς','Average purchase price'),
    `<p>${T('Αν αγόρασες το ίδιο πράγμα πολλές φορές σε διαφορετικές τιμές, η μέση τιμή είναι όσα πλήρωσες συνολικά (με τις προμήθειες) διά την ποσότητα.','If you bought the same thing several times at different prices, the average price is the total you paid (with fees) divided by the quantity.')}</p>
    ${howFx(T('Μέση τιμή = (ποσά αγορών + προμήθειες) ÷ ποσότητα','Average price = (purchase amounts + fees) ÷ quantity'))}
    ${howEx(T('Αγοράζεις 1 μετοχή στα 100 € και 1 στα 200 €. Μέση τιμή 150 €. Αν σήμερα είναι 180 €, κερδίζεις 30 € ανά μετοχή, δηλαδή +20%.','You buy 1 share at €100 and 1 at €200. Average price €150. If it is €180 today, you gain €30 per share, i.e. +20%.'))}
    <p>${T('Όταν πουλάς ένα μέρος, η μέση τιμή όσων κρατάς <b>δεν αλλάζει</b>.','When you sell part of it, the average price of what you keep <b>does not change</b>.')}</p>
    ${howMine(ma)}`));

  /* 6. TWR */
  let mt=noData;
  if(has)mt=D0.short?`<p>${T('Χρειάζονται τουλάχιστον 2 μήνες ιστορικού για να βγει αυτό το νούμερο.','At least 2 months of history are needed for this figure.')}</p>`
    :`<p>${D0.twrA!=null?T('Ανά έτος:','Per year:')+' '+b(pct(D0.twrA),sgn(D0.twr))+' · ':''}${T('Συνολικά:','In total:')} ${b(pct(D0.twr),sgn(D0.twr))}</p>`;
  cards.push(howCard('twr',T('Πόσο καλές ήταν οι επιλογές μου;','How good were my choices?'),T('Απόδοση επιλογών (TWR)','Return on choices (TWR)'),
    `<p>${T('Μετράει <b>πόσο καλά τα πήγαν τα πράγματα που διάλεξες</b>, ανεξάρτητα από το πότε και πόσα χρήματα έβαλες. Είναι ο τρόπος που μετριούνται τα επαγγελματικά funds, ώστε να συγκρίνονται δίκαια.','It measures <b>how well the things you chose performed</b>, regardless of when and how much money you put in. It is how professional funds are measured, so they can be compared fairly.')}</p>
    <p>${T('Πώς: για κάθε εβδομάδα βρίσκουμε πόσο ανέβηκε ή έπεσε το χαρτοφυλάκιο, <b>αφαιρώντας</b> τα χρήματα που έβαλες ή έβγαλες εκείνη την εβδομάδα. Μετά οι εβδομάδες «αλυσοδένονται» μεταξύ τους.','How: for each week we find how much the portfolio rose or fell, <b>leaving out</b> the money you added or took out that week. Then the weeks are “chained” together.')}</p>
    ${howFx(T('(1 + απόδοση εβδ. 1) × (1 + απόδοση εβδ. 2) × … − 1','(1 + week 1 return) × (1 + week 2 return) × … − 1'))}
    ${howEx(T('Μια εβδομάδα +10%, την επόμενη −10%. Δεν είσαι στο 0%: 1,10 × 0,90 = 0,99, δηλαδή <b>−1%</b>. Γι’ αυτό οι αποδόσεις πολλαπλασιάζονται και δεν προστίθενται.','One week +10%, the next −10%. You are not at 0%: 1.10 × 0.90 = 0.99, i.e. <b>−1%</b>. That is why returns are multiplied, not added.'))}
    <p>${T('Αν έχεις πάνω από έναν χρόνο ιστορικού, δείχνεται και <b>ανά έτος</b>, ώστε να συγκρίνεται με επιτόκια και άλλες επενδύσεις.','If you have more than a year of history it is also shown <b>per year</b>, so it can be compared with interest rates and other investments.')}</p>
    ${howMine(mt)}`));

  /* 7. MWR */
  let mm=noData;
  if(has)mm=!pro?`<p>${lockNote}</p>`:D0.mwr==null?`<p>${T('Χρειάζεται τουλάχιστον ένας χρόνος ιστορικού.','At least one year of history is needed.')}</p>`
    :`<p>${T('Απόδοση των χρημάτων σου:','Return on your money:')} ${b(pct(D0.mwr),sgn(D0.mwr))} ${T('τον χρόνο','a year')}${D0.twrA!=null?` · ${T('απόδοση επιλογών','return on choices')} ${b(pct(D0.twrA),sgn(D0.twrA))}`:''}</p>`+
     (D0.twrA!=null?`<p>${D0.mwr<D0.twrA-.005?T('Τα χρήματά σου απέδωσαν λιγότερο από τις επιλογές σου: έβαλες περισσότερα σε στιγμές που ακολούθησαν πτώσεις.','Your money earned less than your choices: you put more in at moments that were followed by drops.')
       :D0.mwr>D0.twrA+.005?T('Τα χρήματά σου απέδωσαν περισσότερο από τις επιλογές σου: έβαλες περισσότερα σε καλές στιγμές.','Your money earned more than your choices: you put more in at good moments.')
       :T('Οι δύο αποδόσεις είναι σχεδόν ίδιες: ο χρονισμός των καταθέσεών σου δεν άλλαξε κάτι.','The two returns are almost the same: the timing of your deposits made little difference.')}</p>`:'');
  cards.push(howCard('mwr',T('Πόσο απέδωσαν τα δικά μου χρήματα;','How much did my own money earn?'),T('Απόδοση των χρημάτων σου (MWR)','Return on your money (MWR)'),
    `<p>${T('Εδώ μετράει και το <b>πότε</b> έβαλες χρήματα. Είναι σαν να ρωτάς: «με ποιο ετήσιο επιτόκιο θα έπρεπε να είχα μια κατάθεση, για να έχω σήμερα τα ίδια χρήματα, κάνοντας τις ίδιες καταθέσεις τις ίδιες μέρες;»','Here <b>when</b> you put money in counts too. It is like asking: “what yearly interest rate would a deposit need, for me to have the same money today, making the same payments on the same days?”')}</p>
    ${howEx(T('Βάζεις 100 € και ανεβαίνει +50% (150 €). Ενθουσιάζεσαι και βάζεις άλλα 1.000 € (1.150 €). Μετά πέφτει −20% και μένεις με 920 €.<br>Οι <b>επιλογές</b> σου: +50% και μετά −20%, συνολικά <b>+20%</b>.<br>Τα <b>χρήματά</b> σου: έβαλες 1.100 € και έχεις 920 €, δηλαδή <b>έχασες 180 €</b>.<br>Το ίδιο χαρτοφυλάκιο, δύο πολύ διαφορετικές απαντήσεις. Η διαφορά είναι ο χρονισμός.','You put in €100 and it rises +50% (€150). Excited, you add €1,000 (€1,150). Then it falls −20% and you are left with €920.<br>Your <b>choices</b>: +50% then −20%, <b>+20%</b> overall.<br>Your <b>money</b>: you put in €1,100 and have €920, so you <b>lost €180</b>.<br>Same portfolio, two very different answers. The difference is timing.'))}
    ${howMine(mm)}`));

  /* 8. benchmarks */
  let mb=noData;
  if(has&&D0.bench.SPY){const v=D0.bench.SPY.B[W-1],d=D0.end-v;mb=`<p>${T('Τα ίδια ποσά στο S&P 500:','The same amounts in the S&P 500:')} ${b(eur.format(v))} · ${T('εσύ:','you:')} ${b(eur.format(D0.end))} → ${b((d>0?'+':'')+eur.format(d),sgn(d))}</p>`}
  cards.push(howCard('bench',T('Θα τα πήγαινα καλύτερα με ένα απλό ETF;','Would I have done better with a simple ETF?'),T('Σύγκριση με S&P 500, Bitcoin, κατάθεση…','Comparison with S&P 500, Bitcoin, deposit…'),
    `<p>${T('Η εφαρμογή ξαναπαίζει την ιστορία σου: <b>κάθε φορά που αγόρασες κάτι, κάνει ότι αγόρασε με το ίδιο ποσό την ίδια μέρα</b> S&P 500 (ή Bitcoin, ή κατάθεση κ.λπ.). Όταν πούλησες, πουλάει από την εναλλακτική το ίδιο ποσό.','The app replays your history: <b>every time you bought something, it pretends it bought the S&P 500 (or Bitcoin, or a deposit, etc.) with the same amount on the same day</b>. When you sold, it sells the same amount from the alternative.')}</p>
    <p>${T('Έτσι η σύγκριση είναι δίκαιη: ίδια χρήματα, ίδιες μέρες, μόνο η επιλογή αλλάζει.','So the comparison is fair: same money, same days, only the choice changes.')}</p>
    <p>${T(`Η «κατάθεση» υπολογίζεται με το επιτόκιο που έχεις στις Ρυθμίσεις (τώρα ${nf(2).format(r)}%). Η «μηνιαία αγορά» μοιράζει το ίδιο σύνολο σε ίσα ποσά κάθε μήνα.`,`The “deposit” uses the interest rate in Settings (now ${nf(2).format(r)}%). “Monthly buying” splits the same total into equal monthly amounts.`)}</p>
    ${howMine(mb)}`));

  /* 9. risk */
  let mr=noData;
  if(has)mr=!pro?`<p>${lockNote}</p>`:D0.short?`<p>${T('Χρειάζεται περισσότερο ιστορικό.','More history is needed.')}</p>`
    :`<p>${T('Μέγιστη πτώση:','Maximum drop:')} ${b(pct(D0.mdd),'neg')}${D0.vol!=null?` · ${T('διακύμανση:','volatility:')} ${b(nf(0).format(D0.vol*100)+'%')} ${T('τον χρόνο','a year')}`:''}</p>`;
  cards.push(howCard('risk',T('Πόσο ρίσκο είχε η διαδρομή;','How risky was the ride?'),T('Μέγιστη πτώση και διακύμανση','Maximum drop and volatility'),
    `<p>${T('<b>Μέγιστη πτώση από κορυφή:</b> η μεγαλύτερη βουτιά που έκανε το χαρτοφυλάκιο από το ψηλότερο σημείο του μέχρι το χαμηλότερο που ακολούθησε. Δείχνει «πόσο πόνο» θα ένιωθες στη χειρότερη στιγμή.','<b>Maximum drop from peak:</b> the biggest fall the portfolio made from its highest point to the lowest point that followed. It shows “how much pain” you would have felt at the worst moment.')}</p>
    ${howEx(T('Από 10.000 € ανεβαίνει στα 12.000 € και μετά πέφτει στα 9.000 €. Μέγιστη πτώση: 9.000 ÷ 12.000 − 1 = <b>−25%</b>.','From €10,000 it rises to €12,000 and then falls to €9,000. Maximum drop: 9,000 ÷ 12,000 − 1 = <b>−25%</b>.'))}
    <p>${T('Μετριέται πάνω στην απόδοση επιλογών, ώστε μια νέα κατάθεση να μην «κρύβει» μια πτώση.','It is measured on the return on choices, so a new deposit cannot “hide” a drop.')}</p>
    <p>${T('<b>Διακύμανση:</b> πόσο πολύ ανεβοκατεβαίνει το χαρτοφυλάκιο από εβδομάδα σε εβδομάδα, αναγμένο σε χρόνο. Ένα κοινό ETF μετοχών έχει περίπου 15–20%, το Bitcoin 50–70%.','<b>Volatility:</b> how much the portfolio swings from week to week, scaled to a year. A broad stock ETF is around 15–20%, Bitcoin 50–70%.')}</p>
    ${howMine(mr)}`));

  /* 10. fees */
  cards.push(howCard('fees',T('Πόσα πλήρωσα σε προμήθειες;','How much did I pay in fees?'),T('Κόστος συναλλαγών','Trading costs'),
    `<p>${T('Όλες οι προμήθειες που έγραψες στις συναλλαγές αθροίζονται και συγκρίνονται με το ποσό των αγορών σου. Οι προμήθειες μπαίνουν στη μέση τιμή, οπότε μειώνουν το κέρδος σου, όπως και στην πραγματικότητα.','All the fees you entered in transactions are added up and compared with the amount you bought. Fees are included in the average price, so they reduce your profit, as they do in reality.')}</p>
    ${howMine(has?`<p>${b(eur2.format(D0.fees))} · ${D0.bought>0?b(nf(2).format(D0.fees/D0.bought*100)+'%')+' '+T('του ποσού των αγορών','of the amount bought'):''}</p>`:noData)}`));

  /* 11. plan */
  let mp=`<p>${T('Συμπλήρωσε το πλάνο σου για να δεις εδώ τα δικά σου νούμερα.','Fill in your plan to see your own figures here.')}</p>`;
  try{if(typeof planRun==='function'&&has){const R=planRun(),L=R.last,a=R.args,own=L.contrib,grow=L.p50-own;
    mp=`<p>${T('Σε','In')} ${b(a.years)} ${T('χρόνια, με','years, with')} ${b(eur.format(a.monthly))} ${T('τον μήνα, το μεσαίο σενάριο δίνει','a month, the middle scenario gives')} ${b(eur.format(L.p50))}.</p>
      <div class="split"><span style="flex:${Math.max(own,0)}" class="own"></span><span style="flex:${Math.max(grow,0)}" class="grow"></span></div>
      <p class="small">${T('Δικά σου χρήματα (σημερινή αξία + καταβολές):','Your own money (today’s value + payments):')} ${b(eur.format(own))}<br>${T('Απόδοση και ανατοκισμός:','Returns and compounding:')} ${b((grow>0?'+':'')+eur.format(grow),sgn(grow))}${a.real?' · '+T('σε σημερινά ευρώ','in today’s euros'):''}</p>`}}catch(e){console.warn('how plan',e)}
  cards.push(howCard('plan',T('Πώς βγαίνει το πλάνο για το μέλλον;','How is the plan for the future worked out?'),T('Ανατοκισμός, σενάρια, παραδοχές','Compounding, scenarios, assumptions'),
    `<p>${T('<b>Ανατοκισμός:</b> κάθε μήνα η απόδοση υπολογίζεται πάνω σε <b>όλα</b> όσα έχουν μαζευτεί, δηλαδή και στα κέρδη των προηγούμενων μηνών, και μετά προστίθεται η μηνιαία καταβολή σου. Έτσι τα κέρδη φέρνουν κι αυτά κέρδη, και το αποτέλεσμα μεγαλώνει όλο και πιο γρήγορα με τα χρόνια.','<b>Compounding:</b> every month the return is calculated on <b>everything</b> built up so far, including earlier months’ gains, and then your monthly payment is added. So gains earn gains too, and the result grows faster and faster over the years.')}</p>
    ${howEx(T('1.000 € με 6% τον χρόνο: μετά από 1 χρόνο 1.060 €, μετά από 10 χρόνια ~1.790 €, μετά από 30 χρόνια ~5.740 €. Χωρίς ανατοκισμό τα 30 χρόνια θα έδιναν μόνο 2.800 €.','€1,000 at 6% a year: after 1 year €1,060, after 10 years ~€1,790, after 30 years ~€5,740. Without compounding, 30 years would give only €2,800.'))}
    <p>${T('<b>Σενάρια:</b> οι αγορές δεν ανεβαίνουν ίσια. Γι’ αυτό η εφαρμογή «παίζει» 400 διαφορετικές πιθανές πορείες, με καλές και κακές χρονιές. Το <b>μεσαίο σενάριο</b> είναι αυτό που βρίσκεται στη μέση: τα μισά βγαίνουν καλύτερα, τα μισά χειρότερα. Το <b>εύρος</b> δείχνει πού πέφτουν τα 8 στα 10.','<b>Scenarios:</b> markets do not rise in a straight line. So the app plays out 400 different possible paths, with good and bad years. The <b>middle scenario</b> sits in the middle: half come out better, half worse. The <b>range</b> shows where 8 out of 10 land.')}</p>
    <p>${T(`<b>Παραδοχές (μέτριες):</b> μετοχές και ETF 6% τον χρόνο, crypto 8% αλλά με πολύ μεγάλες διακυμάνσεις, καταθέσεις ${nf(2).format(r)}% (από τις Ρυθμίσεις). Οι «συντηρητικές» αφαιρούν 2 μονάδες, οι «αισιόδοξες» προσθέτουν 2. Οι διακυμάνσεις μειώνουν τον ανατοκισμό: αν χάσεις 50% και μετά κερδίσεις 50%, μένεις στο 75%.`,`<b>Assumptions (moderate):</b> stocks and ETFs 6% a year, crypto 8% but with very large swings, deposits ${nf(2).format(r)}% (from Settings). “Conservative” subtracts 2 points, “optimistic” adds 2. Swings reduce compounding: lose 50% then gain 50% and you are at 75%.`)}</p>
    <p>${T('Η ετήσια χρέωση που δηλώνεις αφαιρείται κάθε μήνα. Με «σημερινά ευρώ» τα ποσά διορθώνονται για πληθωρισμό 2,5% τον χρόνο, ώστε να δείχνουν πραγματική αγοραστική δύναμη.','The yearly fee you enter is deducted every month. With “today’s euros” amounts are adjusted for 2.5% yearly inflation, so they show real buying power.')}</p>
    ${howMine(mp)}`));

  /* 12. not included */
  cards.push(howCard('left',T('Τι ΔΕΝ υπολογίζεται;','What is NOT included?'),T('Για να ξέρεις τα όρια','So you know the limits'),
    `<ul>
      <li>${T('<b>Φόροι:</b> κανένας φόρος δεν αφαιρείται, ούτε από κέρδη ούτε από μερίσματα.','<b>Taxes:</b> no tax is deducted, neither on gains nor on dividends.')}</li>
      <li>${T('<b>Κρυφά κόστη:</b> το spread και η χρέωση μετατροπής νομίσματος του broker δεν φαίνονται, εκτός αν τα γράψεις στην προμήθεια.','<b>Hidden costs:</b> the spread and your broker’s currency conversion fee are not visible unless you include them in the fee.')}</li>
      <li>${T('<b>Μερίσματα που δεν κατέγραψες:</b> μετράνε μόνο όσα πέρασες στις συναλλαγές.','<b>Dividends you did not record:</b> only those entered in transactions count.')}</li>
      <li>${T('<b>Το μέλλον:</b> το πλάνο δείχνει τι γίνεται <b>αν</b> ισχύσουν οι παραδοχές. Δεν είναι πρόβλεψη και δεν είναι επενδυτική συμβουλή.','<b>The future:</b> the plan shows what happens <b>if</b> the assumptions hold. It is not a forecast and not investment advice.')}</li>
    </ul>`));

  box.innerHTML=`<div class="howtoc">${HOW_IDS.map((id,i)=>`<a href="#h-${id}" data-hid="${id}">${i+1}</a>`).join('')}</div>`+cards.join('');
}
function openHow(id){go('how');setTimeout(()=>{const d=$('h-'+id);if(!d)return;d.open=true;d.scrollIntoView({behavior:RM.matches?'auto':'smooth',block:'start'})},80)}
$('howBody').addEventListener('click',e=>{const a=e.target.closest('[data-hid]');if(!a)return;e.preventDefault();openHow(a.dataset.hid)});
$('kpis').addEventListener('click',e=>{const k=e.target.closest('.kpi[data-how]');if(k)openHow(k.dataset.how)});
$('kpis').addEventListener('keydown',e=>{const k=e.target.closest('.kpi[data-how]');if(k&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openHow(k.dataset.how)}});
