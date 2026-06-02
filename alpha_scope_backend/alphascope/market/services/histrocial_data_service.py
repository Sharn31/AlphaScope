import yfinance as yf
from datetime import datetime, timedelta
import pytz
import math
import time
import pandas as pd

# ─── HISTORICAL CACHE ─────────────────────────────────────────────────────────
historical_cache = {}
CACHE_TTL = 300  # 5 minutes


INTERVAL_MAP = {
    "1D": (1,    "5m"),
    "1W": (7,    "30m"),
    "1M": (30,   "1d"),
    "3M": (90,   "1d"),
    "1Y": (365,  "1wk"),
}

# period= fallback strings for yfinance
PERIOD_FALLBACK = {
    "1D": "1d",
    "1W": "5d",
    "1M": "1mo",
    "3M": "3mo",
    "1Y": "1y",
}


# ─── SAFE FLOAT ───────────────────────────────────────────────────────────────
def _safe_float(val) -> float | None:
    """
    Convert val to float. Returns None if the value is NaN, Inf, or
    cannot be converted — so callers can skip the row.
    """
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


# ─── SAFE STRFTIME ────────────────────────────────────────────────────────────
def _safe_strftime(ts, fmt: str) -> str:
    """
    Convert pandas Timestamp / datetime to string safely.
    Strips timezone before formatting.
    """
    try:
        if hasattr(ts, "tzinfo") and ts.tzinfo is not None:
            ts = ts.tz_convert("UTC").tz_localize(None)
        if hasattr(ts, "to_pydatetime"):
            ts = ts.to_pydatetime()
        return ts.strftime(fmt)
    except Exception:
        return str(ts)[:10]


# ─── GET HISTORICAL DATA ──────────────────────────────────────────────────────
def get_historical_data(symbol: str, period: str = "2y"):
    """
    Fetch daily OHLCV history for ML/indicators.
    Uses period='2y' by default so ML has enough rows (60+ required).
    """
    try:
        stock = yf.Ticker(symbol)
        df    = stock.history(period=period)

        if df.empty:
            print(f"[DEBUG] Empty history for {symbol}")
            return None

        # Flatten MultiIndex columns yfinance sometimes returns
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        if "Close" not in df.columns or len(df) < 20:
            print(f"[DEBUG] Insufficient data for {symbol}: {len(df)} rows")
            return None

        return df.reset_index()

    except Exception as e:
        print(f"[DEBUG] Error fetching history for {symbol}: {e}")
        return None


# ─── GET CACHED HISTORY ───────────────────────────────────────────────────────
def get_cached_history(symbol: str, period: str = "2y"):
    """
    Returns cached OHLCV DataFrame for ML/indicators.
    Cache TTL: 5 minutes. Default period: 2y (required for ML training).
    """
    current_time = time.time()
    cache_key    = f"{symbol}_{period}"

    if cache_key in historical_cache:
        data, ts = historical_cache[cache_key]
        if current_time - ts < CACHE_TTL:
            print(f"[DEBUG] Using cache for {symbol}")
            return data

    df = get_historical_data(symbol, period)
    if df is not None:
        historical_cache[cache_key] = (df, current_time)
        print(f"[DEBUG] Cached {symbol} ({len(df)} rows)")

    return df


# ─── GET CHART DATA ───────────────────────────────────────────────────────────
def get_chart_data(symbol: str, interval: str = "1M") -> dict:
    """
    Returns OHLCV candle data for the frontend chart.

    Root cause of the 500 error:
    yfinance returns NaN for missing candles (weekends, holidays, pre-market).
    These NaN values cannot be JSON serialised and crash DRF's renderer.

    Fix: _safe_float() converts every price field — any row with a NaN
    price is skipped entirely before it reaches the JSON serialiser.
    """
    try:
        days, frequency = INTERVAL_MAP.get(interval, (30, "1d"))

        end   = datetime.now(pytz.UTC)
        start = end - timedelta(days=days)

        ticker = yf.Ticker(symbol)

        # ── Primary fetch: explicit date range ────────────────────────────
        df = ticker.history(
            start       = start,
            end         = end,
            interval    = frequency,
            auto_adjust = True,
            prepost     = False,
            actions     = False,
        )

        # ── Fallback: period= string if date range returned nothing ───────
        if df is None or df.empty:
            period_str = PERIOD_FALLBACK.get(interval, "1mo")
            print(f"[WARN] {symbol} {interval}: date range empty, trying period={period_str}")
            df = ticker.history(
                period      = period_str,
                interval    = frequency,
                auto_adjust = True,
                actions     = False,
            )

        if df is None or df.empty:
            print(f"[WARN] No chart data for {symbol} interval={interval}")
            return {"symbol": symbol, "interval": interval, "data": []}

        # Flatten MultiIndex if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = df.reset_index()

        # ── Determine timestamp column ────────────────────────────────────
        ts_col = "Datetime" if "Datetime" in df.columns else "Date"

        # ── Format string ─────────────────────────────────────────────────
        if frequency in ("5m", "30m"):
            fmt = "%m-%d %H:%M"   # "04-09 14:30"
        elif frequency == "1wk":
            fmt = "%b %Y"         # "Apr 2025"
        else:
            fmt = "%b %d"         # "Apr 09"  ← used for 1M / 3M daily

        # ── Strip future rows yfinance occasionally appends ───────────────
        today = datetime.now(pytz.UTC).date()

        data = []
        for _, row in df.iterrows():

            # ── Skip future rows ──────────────────────────────────────────
            try:
                ts = row[ts_col]
                row_date = pd.Timestamp(ts).date() if not isinstance(ts, datetime) else ts.date()
                if row_date > today:
                    continue
            except Exception:
                pass

            # ── Convert OHLCV to safe floats ──────────────────────────────
            # THIS is the critical fix — _safe_float returns None for NaN/Inf.
            # Any row where open/high/low/close is missing is skipped,
            # so nan never reaches the JSON serialiser.
            o = _safe_float(row.get("Open"))
            h = _safe_float(row.get("High"))
            l = _safe_float(row.get("Low"))
            c = _safe_float(row.get("Close"))

            if any(v is None for v in [o, h, l, c]):
                continue   # ← skip rows with any NaN price

            # Volume is optional — default to 0 if missing/NaN
            vol_raw = _safe_float(row.get("Volume", 0))
            v = int(vol_raw) if vol_raw is not None else 0

            ts = row[ts_col]
            data.append({
                "time":   _safe_strftime(ts, fmt),
                "open":   round(o, 2),
                "high":   round(h, 2),
                "low":    round(l, 2),
                "close":  round(c, 2),
                "volume": v,
            })

        print(f"[OK] {symbol} {interval}: {len(data)} candles (frequency={frequency})")
        return {"symbol": symbol, "interval": interval, "data": data}

    except Exception as e:
        print(f"[ERROR] Chart data failed for {symbol} {interval}: {e}")
        return {"symbol": symbol, "interval": interval, "data": []}