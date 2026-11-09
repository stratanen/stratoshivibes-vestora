#!/usr/bin/env python3
"""Builds data/history.json for Vestora: weekly closing prices in EUR for a fixed list of assets.

Runs in GitHub Actions once a day. Sources: Yahoo Finance chart API (weekly candles, 10 years),
with Stooq as a fallback for US tickers. EUR/USD comes from the same weekly series (EURUSD=X),
with the ECB reference rate as a fallback for the latest value.
If one asset fails to download, the previous data for that asset is kept, so a bad day never empties the app.
"""
import json, os, sys, time, datetime as dt, urllib.request, urllib.error, csv, io

OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'history.json')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) VestoraPriceBot/1.0 (+https://github.com/stratanen/stratoshivibes-vestora)'}
YEARS = 10

# id, Yahoo ticker, name shown in the app, class, USD exposure (0..1, for the "euro +10%" scenario), Stooq ticker (fallback)
CATALOG = [
    # crypto
    ('BTC', 'BTC-USD', 'Bitcoin', 'crypto', 1, None),
    ('ETH', 'ETH-USD', 'Ethereum', 'crypto', 1, None),
    ('SOL', 'SOL-USD', 'Solana', 'crypto', 1, None),
    # index ETFs (US listed, also available on Solana as xStocks: SPYx, QQQx, GLDx)
    ('SPY', 'SPY', 'S&P 500 (SPY)', 'etf', 1, 'spy.us'),
    ('QQQ', 'QQQ', 'Nasdaq 100 (QQQ)', 'etf', 1, 'qqq.us'),
    ('GLD', 'GLD', 'Χρυσός (GLD)', 'etf', 1, 'gld.us'),
    # UCITS ETFs traded in EUR
    ('VWCE', 'VWCE.DE', 'Vanguard FTSE All-World (VWCE)', 'etf', 0.7, None),
    ('EUNL', 'EUNL.DE', 'iShares Core MSCI World (EUNL)', 'etf', 0.7, None),
    ('SXR8', 'SXR8.DE', 'iShares Core S&P 500 (SXR8)', 'etf', 1, None),
    ('EQQQ', 'EQQQ.DE', 'Invesco Nasdaq-100 (EQQQ)', 'etf', 1, None),
    ('XGLD', '4GLD.DE', 'Xetra-Gold (4GLD)', 'etf', 1, None),
    # US stocks (also available as xStocks)
    ('AAPL', 'AAPL', 'Apple', 'stock', 1, 'aapl.us'),
    ('MSFT', 'MSFT', 'Microsoft', 'stock', 1, 'msft.us'),
    ('NVDA', 'NVDA', 'NVIDIA', 'stock', 1, 'nvda.us'),
    ('TSLA', 'TSLA', 'Tesla', 'stock', 1, 'tsla.us'),
    ('AMZN', 'AMZN', 'Amazon', 'stock', 1, 'amzn.us'),
    ('GOOGL', 'GOOGL', 'Alphabet', 'stock', 1, 'googl.us'),
    ('META', 'META', 'Meta', 'stock', 1, 'meta.us'),
    ('COIN', 'COIN', 'Coinbase', 'stock', 1, 'coin.us'),
    ('MSTR', 'MSTR', 'Strategy (MSTR)', 'stock', 1, 'mstr.us'),
    # Athens Stock Exchange
    ('ALWN', 'ALWN.AT', 'Allwyn (πρώην ΟΠΑΠ)', 'stock', 0, None),
    ('ETE', 'ETE.AT', 'Εθνική Τράπεζα', 'stock', 0, None),
    ('EUROB', 'EUROB.AT', 'Eurobank', 'stock', 0, None),
    ('TPEIR', 'TPEIR.AT', 'Τράπεζα Πειραιώς', 'stock', 0, None),
    ('ALPHA', 'ALPHA.AT', 'Alpha Bank', 'stock', 0, None),
    ('PPC', 'PPC.AT', 'ΔΕΗ', 'stock', 0, None),
    ('MTLN', 'MTLN.AT', 'Metlen', 'stock', 0, None),
    ('HTO', 'HTO.AT', 'ΟΤΕ', 'stock', 0, None),
]

WEEK = 7 * 86400


def get(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode('utf-8')
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + 3 * i)
    raise last


def monday(ts):
    d = dt.datetime.fromtimestamp(ts, dt.timezone.utc).date()
    return d - dt.timedelta(days=d.weekday())


def yahoo(ticker):
    """Returns (currency, {monday_date: close}, last_price, last_time)."""
    for host in ('query1', 'query2'):
        try:
            raw = get(f'https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(ticker)}?range={YEARS}y&interval=1wk&includeAdjustedClose=true')
            j = json.loads(raw)['chart']['result'][0]
            ts = j.get('timestamp') or []
            q = j['indicators']
            closes = (q.get('adjclose') or [{}])[0].get('adjclose') or q['quote'][0]['close']
            out = {}
            for t, c in zip(ts, closes):
                if c is not None and c > 0:
                    out[monday(t)] = float(c)
            m = j['meta']
            return m.get('currency', 'USD'), out, m.get('regularMarketPrice'), m.get('regularMarketTime')
        except Exception as e:  # noqa: BLE001
            print(f'  yahoo {host} {ticker}: {e}', file=sys.stderr)
    raise RuntimeError('yahoo failed')


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
    last_d = max(out)
    return 'USD', out, out[last_d], None


def ecb_latest():
    raw = get('https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=csvdata')
    rows = list(csv.DictReader(io.StringIO(raw)))
    return float(rows[-1]['OBS_VALUE'])


def main():
    prev = {}
    if os.path.exists(OUT):
        try:
            prev = json.load(open(OUT, encoding='utf-8'))
        except Exception:  # noqa: BLE001
            prev = {}

    today = dt.datetime.now(dt.timezone.utc).date()
    end = today - dt.timedelta(days=today.weekday())
    start = end - dt.timedelta(weeks=52 * YEARS)
    n = (end - start).days // 7 + 1
    weeks = [start + dt.timedelta(weeks=i) for i in range(n)]

    def to_grid(series):
        """Forward-fills a {monday: value} dict onto the weekly grid. Weeks before the first value stay None."""
        out, lastv = [], None
        keys = sorted(series)
        k = 0
        for w in weeks:
            while k < len(keys) and keys[k] <= w:
                lastv = series[keys[k]]; k += 1
            out.append(lastv)
        return out

    # EUR/USD: dollars per euro
    try:
        _, fx, fx_last, _ = yahoo('EURUSD=X')
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

    assets = {}
    for aid, yt, name, cls, usd, st in CATALOG:
        print('fetching', aid)
        try:
            try:
                cur, ser, last, last_t = yahoo(yt)
            except Exception:  # noqa: BLE001
                if not st:
                    raise
                cur, ser, last, last_t = stooq(st)
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
            eur[-1] = last_eur  # this week's value = latest price
            assets[aid] = {'name': name, 'cls': cls, 'usd': usd, 'w': [None if v is None else float(f'{v:.6g}') for v in eur],
                           'last': float(f'{last_eur:.6g}'), 'lastTime': last_t}
        except Exception as e:  # noqa: BLE001
            print(f'  {aid} failed: {e}', file=sys.stderr)
            if aid in (prev.get('assets') or {}):
                old = prev['assets'][aid]
                assets[aid] = {**old, 'w': realign(prev, weeks, None, old['w'])}
                print('  kept previous data for', aid, file=sys.stderr)

    if len(assets) < len(CATALOG) // 2:
        sys.exit(f'Only {len(assets)} of {len(CATALOG)} assets downloaded; not overwriting the file.')
    for must in ('SPY', 'QQQ', 'BTC'):
        if must not in assets:
            sys.exit(f'{must} is missing; the comparisons need it. Not overwriting the file.')

    data = {'updated': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'start': start.isoformat(), 'weeks': n,
            'eurusd': [float(f'{v:.5g}') for v in fxg], 'eurusdLast': fx_last, 'assets': assets}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'wrote {OUT}: {len(assets)} assets, {n} weeks, {os.path.getsize(OUT)//1024} KB')


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


if __name__ == '__main__':
    main()
