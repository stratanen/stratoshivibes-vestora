#!/usr/bin/env python3
"""Prices for Vestora. Two modes:

  python3 scripts/build_prices.py           full run, once a day after the US close:
      builds data/history.json (weekly closing prices in EUR, 10 years) for every asset in scripts/catalog.py,
      checks each ISIN against OpenFIGI, and looks up the xStock token address (mint) of US assets on Jupiter.
  python3 scripts/build_prices.py --latest  quick run, every hour while markets are open:
      writes data/latest.json with only the current price of each non-crypto asset (crypto is live in the app).

Sources: Yahoo Finance chart API, Stooq as fallback for US tickers, ECB for the EUR/USD reference rate, Jupiter for xStocks.
If an asset fails on a given day, its previous data is kept, so a bad day never empties the app.
"""
import json, os, sys, time, datetime as dt, urllib.request, urllib.parse, csv, io

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog import CATALOG  # noqa: E402

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
OUT = os.path.join(DATA_DIR, 'history.json')
LATEST = os.path.join(DATA_DIR, 'latest.json')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) VestoraPriceBot/1.0 (+https://github.com/stratanen/stratoshivibes-vestora)'}
YEARS = 10
MUST = ('SPY', 'QQQ', 'BTC')  # the comparisons need these

# Yahoo exchange codes -> label shown in search results
EXCH = {'GER': 'Xetra', 'ATH': 'Athens', 'NMS': 'Nasdaq', 'NGM': 'Nasdaq', 'NCM': 'Nasdaq', 'NYQ': 'NYSE', 'PCX': 'NYSE Arca',
        'ASE': 'NYSE American', 'BTS': 'Cboe', 'AMS': 'Euronext Amsterdam', 'PAR': 'Euronext Paris', 'BRU': 'Euronext Brussels',
        'MIL': 'Borsa Italiana', 'CCC': 'Crypto'}

JUP_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search?query='
JUP_PRICE = 'https://lite-api.jup.ag/price/v3?ids='


def get(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8')
        except Exception as e:  # noqa: BLE001
            last = e
            if '404' in str(e):
                break
            time.sleep((2 + 3 * i) * (4 if '429' in str(e) else 1))
    raise last


def monday(ts):
    d = dt.datetime.fromtimestamp(ts, dt.timezone.utc).date()
    return d - dt.timedelta(days=d.weekday())


def yahoo_chart(ticker, rng, interval):
    err = None
    for host in ('query1', 'query2'):
        try:
            raw = get(f'https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(ticker)}?range={rng}&interval={interval}&includeAdjustedClose=true')
            return json.loads(raw)['chart']['result'][0]
        except Exception as e:  # noqa: BLE001
            err = e
    raise RuntimeError(f'yahoo {ticker}: {err}')


def yahoo(tickers):
    """Tries each alternative ticker. Returns (ticker, currency, {monday: close}, last_price, last_time, exchange)."""
    err = None
    for t in tickers.split('|'):
        try:
            j = yahoo_chart(t, f'{YEARS}y', '1wk')
            ts = j.get('timestamp') or []
            q = j['indicators']
            closes = (q.get('adjclose') or [{}])[0].get('adjclose') or q['quote'][0]['close']
            out = {monday(a): float(c) for a, c in zip(ts, closes) if c is not None and c > 0}
            if not out:
                raise RuntimeError('empty')
            m = j['meta']
            return t, m.get('currency', 'USD'), out, m.get('regularMarketPrice'), m.get('regularMarketTime'), m.get('exchangeName')
        except Exception as e:  # noqa: BLE001
            err = e
    raise RuntimeError(str(err))


def stooq(sym):
    raw = get(f'https://stooq.com/q/d/l/?s={sym}&i=w')
    out = {}
    for row in csv.DictReader(io.StringIO(raw)):
        try:
            d = dt.date.fromisoformat(row['Date']); c = float(row['Close'])
        except Exception:  # noqa: BLE001
            continue
        out[d - dt.timedelta(days=d.weekday())] = c
    if not out:
        raise RuntimeError('stooq empty')
    return 'USD', out, out[max(out)], None


def ecb_latest():
    raw = get('https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=csvdata')
    return float(list(csv.DictReader(io.StringIO(raw)))[-1]['OBS_VALUE'])


def clean_spikes(w, crypto):
    """Removes one-week glitches: a value far from both neighbours while the neighbours agree is a bad tick, not a market move."""
    lim = 2.5 if crypto else 1.8
    out, fixed = list(w), 0
    for i in range(1, len(out) - 1):
        a, b, c = out[i - 1], out[i], out[i + 1]
        if a and b and c and max(b / a, a / b) > lim and max(b / c, c / b) > lim and max(a / c, c / a) < 1.3:
            out[i] = a
            fixed += 1
    return out, fixed


def plausible(new, old, crypto):
    """A move larger than a real day can bring is treated as a data error."""
    if not old or not new:
        return True
    return max(new / old, old / new) <= (1.6 if crypto else 1.35)


def openfigi(isins):
    """ISIN -> set of exchange tickers, from OpenFIGI (free, no key: 10 ISINs per request, 25 requests a minute)."""
    out = {}
    for i in range(0, len(isins), 10):
        part = isins[i:i + 10]
        body = json.dumps([{'idType': 'ID_ISIN', 'idValue': x} for x in part]).encode()
        req = urllib.request.Request('https://api.openfigi.com/v3/mapping', data=body, headers={**UA, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            res = json.loads(r.read().decode('utf-8'))
        for x, j in zip(part, res):
            out[x] = {str(d.get('ticker', '')).upper() for d in j.get('data') or []}
        time.sleep(3)
    return out


def resolve_xstock(aid, last_usd):
    """xStock mint for a US ticker, or None. Accepted only if: exact symbol <TICKER>x, address starts with 'Xs',
    Jupiter marks it verified, its price is within 5% of the stock's last close and its market is not thin."""
    want = (aid + 'x').lower()
    res = json.loads(get(JUP_SEARCH + urllib.parse.quote(aid + 'x')))
    cands = [t for t in res if str(t.get('symbol', '')).lower() == want and str(t.get('id', '')).startswith('Xs')
             and (t.get('isVerified') or 'verified' in (t.get('tags') or []))]
    if len(cands) != 1:
        print(f'  {aid}x: {len(cands)} verified candidates; no xStock', file=sys.stderr)
        return None
    mint = cands[0]['id']
    q = json.loads(get(JUP_PRICE + mint)).get(mint) or {}
    p = q.get('usdPrice')
    liq = q.get('liquidity')
    if not p or not last_usd or abs(p / last_usd - 1) > 0.05:
        print(f'  {aid}x {mint}: price {p} vs close {last_usd} too far; skipped', file=sys.stderr)
        return None
    if liq is not None and float(liq) < 25000:
        print(f'  {aid}x {mint}: liquidity {liq} too thin; skipped', file=sys.stderr)
        return None
    print(f'  {aid}x -> {mint} (price {p:.2f} vs close {last_usd:.2f}, liquidity {liq})')
    return mint


def realign(prev, weeks, key, arr=None):
    """Moves an array from the previous file's week grid onto the new one (forward-filled)."""
    arr = arr if arr is not None else prev.get(key) or []
    try:
        p0 = dt.date.fromisoformat(prev['start'])
    except Exception:  # noqa: BLE001
        return [None] * len(weeks)
    out, lastv = [], None
    for w in weeks:
        i = (w - p0).days // 7
        if 0 <= i < len(arr) and arr[i] is not None:
            lastv = arr[i]
        out.append(lastv if i >= 0 else None)
    return out


def load(path):
    try:
        return json.load(open(path, encoding='utf-8'))
    except Exception:  # noqa: BLE001
        return {}


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'wrote {path}: {os.path.getsize(path)//1024} KB')


def full():
    prev = load(OUT)
    prev_assets = prev.get('assets') or {}
    today = dt.datetime.now(dt.timezone.utc).date()
    end = today - dt.timedelta(days=today.weekday())
    start = end - dt.timedelta(weeks=52 * YEARS)
    n = (end - start).days // 7 + 1
    weeks = [start + dt.timedelta(weeks=i) for i in range(n)]

    def to_grid(series):
        out, lastv, keys, k = [], None, sorted(series), 0
        for w in weeks:
            while k < len(keys) and keys[k] <= w:
                lastv = series[keys[k]]; k += 1
            out.append(lastv)
        return out

    # EUR/USD: dollars per euro
    try:
        _, _, fx, fx_last, _, _ = yahoo('EURUSD=X')
        fxg = to_grid(fx)
    except Exception as e:  # noqa: BLE001
        print('EURUSD failed:', e, file=sys.stderr)
        if not prev.get('eurusd'):
            raise
        fxg, fx_last = None, prev.get('eurusdLast')
    try:
        fx_last = ecb_latest() or fx_last
    except Exception as e:  # noqa: BLE001
        print('ECB latest failed (using Yahoo):', e, file=sys.stderr)
    if fxg is None:
        fxg = realign(prev, weeks, 'eurusd')
    first_fx = next((v for v in fxg if v), 1.1)
    fxg = [v or first_fx for v in fxg]

    assets, failed = {}, []
    for a in CATALOG:
        aid, cls, crypto = a['id'], a['cls'], a['cls'] == 'crypto'
        old = prev_assets.get(aid) or {}
        time.sleep(0.3)
        try:
            try:
                yt, cur, ser, last, last_t, ex = yahoo(a['yahoo'])
            except Exception:  # noqa: BLE001
                if not a.get('stooq'):
                    raise
                cur, ser, last, last_t = stooq(a['stooq'])
                yt, ex = a['yahoo'].split('|')[0], None
            grid = to_grid(ser)
            if cur == 'USD':
                eur = [None if v is None else v / fxg[i] for i, v in enumerate(grid)]
                last_eur = last / fx_last if last else eur[-1]
            elif cur == 'EUR':
                eur, last_eur = grid, last or grid[-1]
            else:
                raise RuntimeError('unsupported currency ' + cur)
            if not any(eur):
                raise RuntimeError('no data')
            eur, fixed = clean_spikes(eur, crypto)
            if fixed:
                print(f'  {aid}: smoothed {fixed} one-week glitch(es)', file=sys.stderr)
            if not plausible(last_eur, old.get('last'), crypto):
                confirmed = False
                if a.get('stooq'):
                    try:
                        c2, _, l2, _ = stooq(a['stooq'])
                        l2e = l2 / fx_last if c2 == 'USD' else l2
                        confirmed = l2e and abs(l2e / last_eur - 1) < 0.05
                    except Exception:  # noqa: BLE001
                        pass
                if not confirmed:
                    print(f'  {aid}: latest {last_eur:.6g} vs previous {old["last"]:.6g} not confirmed; keeping previous', file=sys.stderr)
                    last_eur = old['last']
            eur[-1] = last_eur  # this week's value = latest price
            rec = {'name': a['name'], 'cls': cls, 'usd': a['usd'], 'cur': cur, 'y': yt,
                   'w': [None if v is None else float(f'{v:.6g}') for v in eur], 'last': float(f'{last_eur:.6g}'), 'lastTime': last_t}
            if ex or old.get('ex'):
                rec['ex'] = EXCH.get(ex, ex) if ex else old['ex']
            for f in ('k', 'en', 'q'):
                if a.get(f):
                    rec[f] = a[f]
            assets[aid] = rec
        except Exception as e:  # noqa: BLE001
            failed.append(aid)
            print(f'  {aid} ({a["yahoo"]}) failed: {e}', file=sys.stderr)
            if old:
                assets[aid] = {**old, 'w': realign(prev, weeks, None, old['w'])}
                print('  kept previous data for', aid, file=sys.stderr)

    # ISIN: written only if OpenFIGI lists this ticker for it
    isins = [a['isin'] for a in CATALOG if a.get('isin') and a['id'] in assets]
    try:
        figi = openfigi(isins)
    except Exception as e:  # noqa: BLE001
        print('OpenFIGI failed; keeping yesterday\'s confirmed ISINs:', e, file=sys.stderr)
        figi = None
    for a in CATALOG:
        aid = a['id']
        if aid not in assets or not a.get('isin'):
            continue
        assets[aid].pop('isin', None)
        if figi is None:
            ok = (prev_assets.get(aid) or {}).get('isin') == a['isin']
        else:
            base = (assets[aid].get('y') or a['yahoo'].split('|')[0]).split('.')[0].upper()
            ok = base in figi.get(a['isin'], set())
            if not ok:
                print(f'  {aid}: ISIN {a["isin"]} not confirmed (OpenFIGI tickers: {sorted(figi.get(a["isin"], set()))[:8]}); left out', file=sys.stderr)
        if ok:
            assets[aid]['isin'] = a['isin']

    # xStocks: every US-listed stock and ETF
    for a in CATALOG:
        aid = a['id']
        if aid not in assets or not a.get('stooq') or a['cls'] == 'crypto':
            continue
        old = (prev_assets.get(aid) or {}).get('mint')
        assets[aid].pop('mint', None)
        time.sleep(4)  # Jupiter's free API allows only a few requests per second
        try:
            m = resolve_xstock(aid, assets[aid]['last'] * fx_last)
        except Exception as e:  # noqa: BLE001
            print(f'  {aid}x lookup failed: {e}', file=sys.stderr)
            m = old
        if m:
            assets[aid]['mint'] = m

    print(f'{len(assets)} of {len(CATALOG)} assets; failed today: {", ".join(failed) or "none"}')
    if len(assets) < len(CATALOG) // 2:
        sys.exit(f'Only {len(assets)} of {len(CATALOG)} assets downloaded; not overwriting the file.')
    for must in MUST:
        if must not in assets:
            sys.exit(f'{must} is missing; the comparisons need it. Not overwriting the file.')

    write(OUT, {'updated': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'start': start.isoformat(), 'weeks': n,
                'eurusd': [float(f'{v:.5g}') for v in fxg], 'eurusdLast': fx_last, 'assets': assets})


def latest():
    """Hourly: current price of every non-crypto asset, in EUR, into data/latest.json (small file)."""
    hist = load(OUT)
    assets = hist.get('assets') or {}
    if not assets:
        sys.exit('No history.json yet; run the full mode first.')
    try:
        fx = yahoo_chart('EURUSD=X', '5d', '1d')['meta']['regularMarketPrice']
    except Exception as e:  # noqa: BLE001
        print('EURUSD failed, using the daily rate:', e, file=sys.stderr)
        fx = hist.get('eurusdLast')
    out, n = {}, 0
    for aid, a in assets.items():
        if a.get('cls') == 'crypto':
            continue
        time.sleep(0.3)
        try:
            m = yahoo_chart(a.get('y') or aid, '5d', '1d')['meta']
            p, t, cur = m.get('regularMarketPrice'), m.get('regularMarketTime'), m.get('currency')
            if not p or not t or t <= (a.get('lastTime') or 0):
                continue
            e = p / fx if cur == 'USD' else p if cur == 'EUR' else None
            if e is None or not plausible(e, a.get('last'), False):
                print(f'  {aid}: {p} {cur} ignored', file=sys.stderr)
                continue
            out[aid] = [float(f'{e:.6g}'), t]
            n += 1
        except Exception as e:  # noqa: BLE001
            print(f'  {aid} failed: {e}', file=sys.stderr)
    print(f'{n} current prices')
    write(LATEST, {'updated': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'eurusd': fx, 'p': out})


if __name__ == '__main__':
    latest() if '--latest' in sys.argv else full()
