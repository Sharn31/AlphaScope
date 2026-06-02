import yfinance as yf
from datetime import datetime, timedelta
import pytz


# ── Period → interval mapping ─────────────────────────────────────────────────
# yfinance needs the right interval for each period to get useful data points
PERIOD_INTERVAL = {
    "1d":  "5m",    # 1 day  → 5-minute candles  (~78 points)
    "1wk": "30m",   # 1 week → 30-minute candles (~56 points)
    "1mo": "1d",    # 1 month → daily candles    (~22 points)
    "3mo": "1d",    # 3 months → daily candles   (~66 points)
    "1y":  "1wk",   # 1 year → weekly candles    (~52 points)
}


def fetch_yahoo_stock(symbol, period="1d"):
    """Fetch latest price, high, low, volume — always fresh."""
    try:
        interval = PERIOD_INTERVAL.get(period, "5m")

        stock = yf.Ticker(symbol)

        # ✅ Use start/end dates instead of period= to bypass yfinance cache
        end   = datetime.now(pytz.UTC)
        days  = {"1d": 1, "1wk": 7, "1mo": 30, "3mo": 90, "1y": 365}.get(period, 1)
        start = end - timedelta(days=days)

        data = stock.history(
            start=start,
            end=end,
            interval=interval,
            auto_adjust=True,
            prepost=False,
        )

        if data.empty:
            # Fallback: try period= directly
            data = stock.history(period=period)

        if data.empty:
            return None

        latest = data.iloc[-1]
        price  = round(float(latest["Close"]), 2)
        high   = round(float(latest["High"]),  2)
        low    = round(float(latest["Low"]),   2)
        volume = int(latest["Volume"])

        return price, high, low, volume

    except Exception as e:
        print(f"[WARN] Yahoo fetch failed for {symbol}: {e}")
        return None


def fetch_yahoo_chart(symbol, period="1d"):
    """
    Returns price array + timestamps for chart rendering.
    Frontend receives: { symbol, period, price: [...], timestamps: [...] }
    """
    try:
        interval = PERIOD_INTERVAL.get(period, "5m")

        end   = datetime.now(pytz.UTC)
        days  = {"1d": 1, "1wk": 7, "1mo": 30, "3mo": 90, "1y": 365}.get(period, 1)
        start = end - timedelta(days=days)

        stock = yf.Ticker(symbol)
        data  = stock.history(
            start=start,
            end=end,
            interval=interval,
            auto_adjust=True,
            prepost=False,
        )

        if data.empty:
            data = stock.history(period=period)

        if data.empty:
            return None

        prices     = [round(float(p), 2) for p in data["Close"].tolist()]
        # ✅ Return real timestamps so chart x-axis shows correct dates
        timestamps = [
            idx.strftime("%m-%d %H:%M") if period == "1d"
            else idx.strftime("%m-%d")
            for idx in data.index
        ]

        return {
            "symbol":     symbol.upper(),
            "period":     period,
            "price":      prices,
            "timestamps": timestamps,
            "volume":     int(data["Volume"].iloc[-1]),
        }

    except Exception as e:
        print(f"[WARN] Yahoo chart fetch failed for {symbol}: {e}")
        return None


def fetch_company_info(symbol):
    stock = yf.Ticker(symbol)
    info  = stock.info

    if not info:
        return {"error": "No company info found"}

    return {
        "name":        info.get("longName"),
        "symbol":      info.get("symbol"),
        "sector":      info.get("sector"),
        "industry":    info.get("industry"),
        "market_cap":  info.get("marketCap"),
        "employees":   info.get("fullTimeEmployees"),
        "description": info.get("longBusinessSummary"),
        "website":     info.get("website"),
        "country":     info.get("country"),
    }


def search_symbol(query: str):
    """Returns just the top symbol match — used internally."""
    try:
        results = yf.Search(query, max_results=1)
        quotes  = results.quotes
        if not quotes:
            return None
        return quotes[0].get("symbol")
    except Exception as e:
        print(f"[ERROR] Symbol search failed: {e}")
        return None


def search_stocks(query: str, max_results: int = 8):
    """Returns full stock list — used by StockSearchView."""
    try:
        results = yf.Search(query, max_results=max_results)
        quotes  = results.quotes

        data = []
        for item in quotes:
            symbol   = item.get("symbol",   "")
            name     = item.get("longname") or item.get("shortname", "")
            sector   = item.get("sector",   "")
            exchange = item.get("exchange", "")

            if symbol and name:
                data.append({
                    "symbol":   symbol,
                    "name":     name,
                    "sector":   sector,
                    "exchange": exchange,
                })

        return data

    except Exception as e:
        print(f"[ERROR] Stock search failed: {e}")
        return []