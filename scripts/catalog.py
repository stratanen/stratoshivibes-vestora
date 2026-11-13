"""The list of assets Vestora knows, with prices downloaded every day.

Each entry: id (used inside the app, never change it once published), Yahoo ticker (alternatives separated by |),
name shown in the app (Greek), class, USD exposure (0..1, for the "euro +10%" scenario), and optional extras:
  stooq: fallback ticker for US listings
  isin:  checked against OpenFIGI every day; left out of the file if it does not confirm it
  k:     kind, used by the stress test and the plan: ndq, tech, gold, bond, mm (money market), btc
  en:    English name, when the Greek name differs
  q:     extra search words (Greek or English)
If a ticker stops working (delisting, rename), the daily job logs it and keeps the last good data.
"""


def A(id, yahoo, name, cls, usd, **kw):
    return dict(id=id, yahoo=yahoo, name=name, cls=cls, usd=usd, **kw)


def US(id, name, cls='stock', **kw):
    return A(id, id, name, cls, 1, stooq=id.lower().replace('-', '.') + '.us', **kw)


CATALOG = [
    # ---------- crypto ----------
    A('BTC', 'BTC-USD', 'Bitcoin', 'crypto', 1),
    A('ETH', 'ETH-USD', 'Ethereum', 'crypto', 1),
    A('SOL', 'SOL-USD', 'Solana', 'crypto', 1),

    # ---------- European (UCITS) ETFs, in EUR ----------
    # world
    A('VWCE', 'VWCE.DE', 'Vanguard FTSE All-World (VWCE)', 'etf', 0.7, isin='IE00BK5BQT80', q='παγκόσμιο world all world vanguard'),
    A('VGWL', 'VGWL.DE', 'Vanguard FTSE All-World, διανομή (VGWL)', 'etf', 0.7, isin='IE00B3RBWM25', en='Vanguard FTSE All-World, distributing (VGWL)', q='παγκόσμιο world vwrl'),
    A('EUNL', 'EUNL.DE', 'iShares Core MSCI World (EUNL)', 'etf', 0.7, isin='IE00B4L5Y983', q='παγκόσμιο world iwda swda'),
    A('XDWD', 'XDWD.DE', 'Xtrackers MSCI World (XDWD)', 'etf', 0.7, isin='IE00BJ0KDQ92', q='παγκόσμιο world'),
    A('IUSQ', 'IUSQ.DE', 'iShares MSCI ACWI (IUSQ)', 'etf', 0.65, isin='IE00B6R52259', q='παγκόσμιο world acwi'),
    A('SPYI', 'SPYI.DE', 'SPDR MSCI ACWI IMI (SPYI)', 'etf', 0.65, isin='IE00B3YLTY66', q='παγκόσμιο world acwi imi'),
    A('IUSN', 'IUSN.DE', 'iShares MSCI World Small Cap (IUSN)', 'etf', 0.6, isin='IE00BF4RFH31', q='μικρές εταιρείες small cap'),
    A('IS3Q', 'IS3Q.DE', 'iShares MSCI World Quality Factor (IS3Q)', 'etf', 0.7, isin='IE00BP3QZ601', q='quality ποιότητα'),
    # USA
    A('SXR8', 'SXR8.DE', 'iShares Core S&P 500 (SXR8)', 'etf', 1, isin='IE00B5BMR087', q='sp500 s&p cspx'),
    A('VUAA', 'VUAA.DE', 'Vanguard S&P 500, συσσώρευση (VUAA)', 'etf', 1, isin='IE00BFMXXD54', en='Vanguard S&P 500, accumulating (VUAA)', q='sp500 s&p'),
    A('VUSA', 'VUSA.DE', 'Vanguard S&P 500, διανομή (VUSA)', 'etf', 1, isin='IE00B3XXRP09', en='Vanguard S&P 500, distributing (VUSA)', q='sp500 s&p'),
    A('XDEW', 'XDEW.DE', 'Xtrackers S&P 500 Equal Weight (XDEW)', 'etf', 1, isin='IE00BLNMYC90', q='sp500 s&p equal weight ίση στάθμιση'),
    A('ZPRV', 'ZPRV.DE', 'SPDR MSCI USA Small Cap Value (ZPRV)', 'etf', 1, isin='IE00BSPLC413', q='small cap value'),
    A('EQQQ', 'EQQQ.DE', 'Invesco Nasdaq-100 (EQQQ)', 'etf', 1, isin='IE0032077012', k='ndq', q='nasdaq'),
    A('SXRV', 'SXRV.DE', 'iShares Nasdaq 100 (SXRV)', 'etf', 1, isin='IE00B53SZB19', k='ndq', q='nasdaq cndx'),
    A('QDVE', 'QDVE.DE', 'iShares S&P 500 Information Technology (QDVE)', 'etf', 1, isin='IE00B3WJKG14', k='tech', q='τεχνολογία technology'),
    A('VVSM', 'VVSM.DE', 'VanEck Semiconductor (VVSM)', 'etf', 1, isin='IE00BMC38736', k='tech', q='ημιαγωγοί semiconductors chips smh'),
    # Europe
    A('EXSA', 'EXSA.DE', 'iShares STOXX Europe 600 (EXSA)', 'etf', 0, isin='DE0002635307', q='ευρώπη europe stoxx'),
    A('MEUD', 'MEUD.PA', 'Amundi STOXX Europe 600 (MEUD)', 'etf', 0, isin='LU0908500753', q='ευρώπη europe stoxx'),
    A('SXR7', 'SXR7.DE', 'iShares Core MSCI EMU (SXR7)', 'etf', 0, isin='IE00B53QG562', q='ευρωζώνη eurozone emu'),
    A('EXW1', 'EXW1.DE', 'iShares Core EURO STOXX 50 (EXW1)', 'etf', 0, isin='DE0005933956', q='ευρωζώνη euro stoxx 50'),
    A('DFEN', 'DFEN.DE', 'VanEck Defense (DFEN)', 'etf', 0.5, isin='IE000YYE6WK5', q='άμυνα defense dfns'),
    # emerging markets
    A('IS3N', 'IS3N.DE', 'iShares Core MSCI EM IMI (IS3N)', 'etf', 0.5, isin='IE00BKM4GZ66', q='αναδυόμενες emerging eimi'),
    A('VFEM', 'VFEM.DE', 'Vanguard FTSE Emerging Markets (VFEM)', 'etf', 0.5, isin='IE00B3VVMM84', q='αναδυόμενες emerging'),
    A('XMME', 'XMME.DE', 'Xtrackers MSCI Emerging Markets (XMME)', 'etf', 0.5, isin='IE00BTJRMP35', q='αναδυόμενες emerging'),
    A('QDV5', 'QDV5.DE', 'iShares MSCI India (QDV5)', 'etf', 0.3, isin='IE00BZCQB185', q='ινδία india'),
    # dividends
    A('VGWD', 'VGWD.DE', 'Vanguard FTSE All-World High Dividend (VGWD)', 'etf', 0.5, isin='IE00B8GKDB10', q='μέρισμα μερίσματα dividend vhyl'),
    A('ZPRG', 'ZPRG.DE', 'SPDR S&P Global Dividend Aristocrats (ZPRG)', 'etf', 0.5, isin='IE00B9CQXS71', q='μέρισμα μερίσματα dividend'),
    A('TDIV', 'TDIV.AS', 'VanEck Developed Markets Dividend Leaders (TDIV)', 'etf', 0.4, isin='NL0011683594', q='μέρισμα μερίσματα dividend'),
    A('IQQH', 'IQQH.DE', 'iShares Global Clean Energy (IQQH)', 'etf', 0.5, isin='IE00B1XNHC34', q='πράσινη ενέργεια clean energy'),
    # bonds and money market
    A('VAGF', 'VAGF.DE', 'Vanguard Global Aggregate Bond, € hedged (VAGF)', 'etf', 0, isin='IE00BG47KH54', k='bond', q='ομόλογα bonds'),
    A('EUNH', 'EUNH.DE', 'iShares Core € Govt Bond (EUNH)', 'etf', 0, isin='IE00B4WXJJ64', k='bond', q='ομόλογα κρατικά government bonds'),
    A('EUN5', 'EUN5.DE', 'iShares Core € Corp Bond (EUN5)', 'etf', 0, isin='IE00B3F81R35', k='bond', q='ομόλογα εταιρικά corporate bonds'),
    A('XEON', 'XEON.DE', 'Xtrackers EUR Overnight Rate (XEON)', 'etf', 0, isin='LU0290358497', k='mm', q='money market ταμειακό διαθέσιμα €str'),
    # gold
    A('XGLD', '4GLD.DE', 'Xetra-Gold (4GLD)', 'etf', 1, isin='DE000A0S9GB0', k='gold', q='χρυσός gold'),
    A('PPFB', 'PPFB.DE', 'iShares Physical Gold (PPFB)', 'etf', 1, isin='IE00B4ND3602', k='gold', q='χρυσός gold sgln igln'),

    # ---------- US ETFs, in USD ----------
    US('SPY', 'S&P 500 (SPY)', 'etf', q='sp500 s&p'),
    US('VOO', 'Vanguard S&P 500 (VOO)', 'etf', q='sp500 s&p'),
    US('IVV', 'iShares Core S&P 500 (IVV)', 'etf', q='sp500 s&p'),
    US('VTI', 'Vanguard Total Stock Market (VTI)', 'etf', q='ηπα usa total market'),
    US('VT', 'Vanguard Total World (VT)', 'etf', q='παγκόσμιο world'),
    US('VXUS', 'Vanguard Total International (VXUS)', 'etf', q='εκτός ηπα international'),
    US('VEA', 'Vanguard Developed Markets (VEA)', 'etf', q='ανεπτυγμένες developed'),
    US('VWO', 'Vanguard Emerging Markets (VWO)', 'etf', q='αναδυόμενες emerging'),
    US('EEM', 'iShares MSCI Emerging Markets (EEM)', 'etf', q='αναδυόμενες emerging'),
    US('QQQ', 'Nasdaq 100 (QQQ)', 'etf', k='ndq', q='nasdaq'),
    US('QQQM', 'Invesco Nasdaq 100 (QQQM)', 'etf', k='ndq', q='nasdaq'),
    US('DIA', 'Dow Jones (DIA)', 'etf', q='dow jones'),
    US('IWM', 'Russell 2000 (IWM)', 'etf', q='μικρές εταιρείες small cap russell'),
    US('SCHD', 'Schwab US Dividend Equity (SCHD)', 'etf', q='μέρισμα μερίσματα dividend'),
    US('VIG', 'Vanguard Dividend Appreciation (VIG)', 'etf', q='μέρισμα μερίσματα dividend'),
    US('JEPI', 'JPMorgan Equity Premium Income (JEPI)', 'etf', q='εισόδημα income covered call'),
    US('VUG', 'Vanguard Growth (VUG)', 'etf', q='ανάπτυξη growth'),
    US('VGT', 'Vanguard Information Technology (VGT)', 'etf', k='tech', q='τεχνολογία technology'),
    US('XLK', 'Technology Select Sector (XLK)', 'etf', k='tech', q='τεχνολογία technology'),
    US('SMH', 'VanEck Semiconductor (SMH)', 'etf', k='tech', q='ημιαγωγοί semiconductors chips'),
    US('SOXX', 'iShares Semiconductor (SOXX)', 'etf', k='tech', q='ημιαγωγοί semiconductors chips'),
    US('ARKK', 'ARK Innovation (ARKK)', 'etf', k='tech', q='καινοτομία innovation'),
    US('XLF', 'Financial Select Sector (XLF)', 'etf', q='τράπεζες χρηματοοικονομικά financials'),
    US('XLE', 'Energy Select Sector (XLE)', 'etf', q='ενέργεια energy'),
    US('XLV', 'Health Care Select Sector (XLV)', 'etf', q='υγεία health'),
    US('VNQ', 'Vanguard Real Estate (VNQ)', 'etf', q='ακίνητα real estate reit'),
    US('BND', 'Vanguard Total Bond Market (BND)', 'etf', k='bond', q='ομόλογα bonds'),
    US('AGG', 'iShares Core US Aggregate Bond (AGG)', 'etf', k='bond', q='ομόλογα bonds'),
    US('TLT', 'iShares 20+ Year Treasury (TLT)', 'etf', k='bond', q='ομόλογα αμερικανικό δημόσιο treasury bonds'),
    US('IEF', 'iShares 7-10 Year Treasury (IEF)', 'etf', k='bond', q='ομόλογα treasury bonds'),
    US('SHY', 'iShares 1-3 Year Treasury (SHY)', 'etf', k='bond', q='ομόλογα treasury bonds'),
    US('SGOV', 'iShares 0-3 Month Treasury (SGOV)', 'etf', k='mm', q='έντοκα γραμμάτια t-bills money market'),
    US('GLD', 'Χρυσός (GLD)', 'etf', k='gold', en='Gold (GLD)', q='χρυσός gold'),
    US('SLV', 'Ασήμι (SLV)', 'etf', en='Silver (SLV)', q='ασήμι silver'),
    US('GDX', 'Μεταλλεία χρυσού (GDX)', 'etf', en='Gold Miners (GDX)', q='χρυσός gold miners'),
    US('IBIT', 'iShares Bitcoin Trust (IBIT)', 'etf', k='btc', q='bitcoin btc etf'),

    # ---------- US stocks, in USD ----------
    US('AAPL', 'Apple'), US('MSFT', 'Microsoft'), US('NVDA', 'NVIDIA', k='tech'), US('TSLA', 'Tesla', k='tech'),
    US('AMZN', 'Amazon'), US('GOOGL', 'Alphabet', q='google'), US('META', 'Meta', q='facebook instagram'),
    US('COIN', 'Coinbase', k='tech'), US('MSTR', 'Strategy (MSTR)', k='tech', q='microstrategy'),
    US('AVGO', 'Broadcom', k='tech'), US('AMD', 'AMD', k='tech'), US('PLTR', 'Palantir', k='tech'),
    US('NFLX', 'Netflix'), US('ORCL', 'Oracle'), US('ADBE', 'Adobe'), US('CRM', 'Salesforce'), US('INTC', 'Intel'),
    US('UBER', 'Uber'), US('PYPL', 'PayPal'), US('HOOD', 'Robinhood', k='tech'), US('CRCL', 'Circle', k='tech'),
    US('BRK-B', 'Berkshire Hathaway', q='buffett'), US('JPM', 'JPMorgan'), US('BAC', 'Bank of America'),
    US('V', 'Visa'), US('MA', 'Mastercard'), US('LLY', 'Eli Lilly'), US('UNH', 'UnitedHealth'), US('JNJ', 'Johnson & Johnson'),
    US('WMT', 'Walmart'), US('COST', 'Costco'), US('KO', 'Coca-Cola'), US('PEP', 'PepsiCo'), US('DIS', 'Disney'), US('XOM', 'ExxonMobil'),

    # ---------- Athens Stock Exchange (large and mid caps), in EUR ----------
    *[A(i, y, n, 'stock', 0, en=e, q=q) for i, y, n, e, q in [
        ('ETE', 'ETE.AT', 'Εθνική Τράπεζα', 'National Bank of Greece', 'nbg εθνικη'),
        ('EUROB', 'EUROB.AT', 'Eurobank', None, 'γιουρομπανκ'),
        ('TPEIR', 'TPEIR.AT', 'Τράπεζα Πειραιώς', 'Piraeus Bank', 'piraeus πειραιως'),
        ('ALPHA', 'ALPHA.AT', 'Alpha Bank', None, 'αλφα'),
        ('BOCHGR', 'BOCHGR.AT', 'Τράπεζα Κύπρου', 'Bank of Cyprus', 'bank of cyprus'),
        ('OPTIMA', 'OPTIMA.AT', 'Optima bank', None, 'οπτιμα'),
        ('CREDIA', 'CREDIA.AT|TATT.AT', 'CrediaBank (πρώην Attica Bank)', 'CrediaBank (formerly Attica Bank)', 'attica bank αττικης'),
        ('PPC', 'PPC.AT', 'ΔΕΗ', 'PPC (Public Power Corporation)', 'ppc δεη'),
        ('MTLN', 'MTLN.AT', 'Metlen', None, 'mytilineos μυτιληναιος'),
        ('HTO', 'HTO.AT', 'ΟΤΕ', 'OTE (Hellenic Telecom)', 'ote cosmote οτε'),
        ('ALWN', 'ALWN.AT', 'Allwyn (πρώην ΟΠΑΠ)', 'Allwyn (formerly OPAP)', 'opap οπαπ'),
        ('MOH', 'MOH.AT', 'Motor Oil', None, 'μοτορ οιλ'),
        ('ELPE', 'ELPE.AT', 'HELLENiQ ENERGY (πρώην ΕΛΠΕ)', 'HELLENiQ ENERGY', 'ελληνικα πετρελαια ελπε helleniq'),
        ('BELA', 'BELA.AT', 'Jumbo', None, 'τζαμπο'),
        ('GEKTERNA', 'GEKTERNA.AT', 'ΓΕΚ ΤΕΡΝΑ', 'GEK TERNA', 'gek terna'),
        ('TITC', 'TITC.AT|TITC.BR', 'Τιτάν', 'Titan', 'titan cement τσιμεντα'),
        ('EEE', 'EEE.AT', 'Coca-Cola HBC', None, 'κοκα κολα'),
        ('ADMIE', 'ADMIE.AT', 'ΑΔΜΗΕ', 'IPTO (ADMIE)', 'admie'),
        ('EYDAP', 'EYDAP.AT', 'ΕΥΔΑΠ', 'Athens Water (EYDAP)', 'eydap'),
        ('EYAPS', 'EYAPS.AT', 'ΕΥΑΘ', 'Thessaloniki Water (EYATH)', 'eyath'),
        ('LAMDA', 'LAMDA.AT', 'Lamda Development', None, 'λαμδα ελληνικο'),
        ('VIO', 'VIO.AT', 'Viohalco', None, 'βιοχαλκο'),
        ('CENER', 'CENER.AT', 'Cenergy', None, 'σενεργκι'),
        ('ELHA', 'ELHA.AT', 'ElvalHalcor', None, 'ελβαλχαλκορ'),
        ('AEGN', 'AEGN.AT', 'Aegean Airlines', None, 'αιγαιον'),
        ('PPA', 'PPA.AT', 'ΟΛΠ', 'Piraeus Port (OLP)', 'olp λιμανι πειραια'),
        ('OLTH', 'OLTH.AT', 'ΟΛΘ', 'Thessaloniki Port (OLTH)', 'olth λιμανι θεσσαλονικης'),
        ('THEON', 'THEON.AS', 'Theon International', None, 'θεον'),
        ('AKTR', 'AKTR.AT', 'Aktor (πρώην Intrakat)', 'Aktor (formerly Intrakat)', 'ακτωρ intrakat'),
        ('ELLAKTOR', 'ELLAKTOR.AT', 'Ελλάκτωρ', 'Ellaktor', 'ellaktor'),
        ('AVAX', 'AVAX.AT', 'ΑΒΑΞ', 'AVAX', 'avax'),
        ('SAR', 'SAR.AT', 'Σαράντης', 'Sarantis', 'sarantis'),
        ('QUEST', 'QUEST.AT', 'Quest Holdings', None, 'κουεστ'),
        ('OTOEL', 'OTOEL.AT', 'Autohellas', None, 'αυτοελλας hertz'),
        ('FOYRK', 'FOYRK.AT', 'Fourlis', None, 'φουρλης ikea'),
        ('KRI', 'KRI.AT', 'Κρι Κρι', 'Kri Kri', 'kri kri'),
        ('ACAG', 'ACAG.AT', 'AustriaCard', None, 'austriacard'),
        ('PROF', 'PROF.AT', 'Profile Software', None, 'προφιλ'),
        ('QLCO', 'QLCO.AT', 'Qualco', None, 'κουαλκο'),
        ('INTEK', 'INTEK.AT|IDEAL.AT', 'IDEAL Holdings', None, 'ιντεαλ'),
        ('BYLOT', 'BYLOT.AT|INLOT.AT', "Bally's Intralot", None, 'intralot ιντραλοτ'),
        ('INTRK', 'INTRK.AT', 'Intracom Holdings', None, 'ιντρακομ'),
        ('TRESTATES', 'TRESTATES.AT', 'Trade Estates', None, 'trade estates ακινητα'),
        ('NOVAL', 'NOVAL.AT', 'Noval Property', None, 'noval ακινητα'),
        ('PREMIA', 'PREMIA.AT', 'Premia Properties', None, 'premia ακινητα'),
        ('DIMAND', 'DIMAND.AT', 'Dimand', None, 'ντιμαντ ακινητα'),
        ('ATTICA', 'ATTICA.AT', 'Attica Group', None, 'attica ferries blue star'),
        ('PLAT', 'PLAT.AT', 'Thrace Plastics', None, 'πλαστικα θρακης'),
        ('ALMY', 'ALMY.AT', 'Alumil', None, 'αλουμυλ'),
        ('PETRO', 'PETRO.AT', 'Πετρόπουλος', 'Petros Petropoulos', 'petropoulos'),
        ('AEM', 'AEM.AT', 'Alter Ego Media', None, 'αλτερ εγκο'),
        ('PERF', 'PERF.AT', 'Performance Technologies', None, 'performance'),
        ('INLIF', 'INLIF.AT', 'Interlife', None, 'ιντερλαιφ ασφαλιστικη'),
        ('EXAE', 'EXAE.AT', 'Euronext Athens (πρώην ΕΧΑΕ)', 'Euronext Athens (formerly ATHEX)', 'χρηματιστηριο athex εχαε'),
    ]],
]
