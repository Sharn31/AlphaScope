"""
market/services/ai_service.py
AlphaScope AI — Groq LLaMA3 + Finnhub news + full page/platform knowledge
Fixed: correct model name, natural language ticker mapping, web search for news
"""

import re
import requests
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from django.conf import settings


# ── Known S&P 500 / popular tickers ──────────────────────────────────────────
KNOWN_TICKERS = {
    "AAPL","MSFT","GOOGL","GOOG","AMZN","NVDA","META","TSLA","JPM","V",
    "MA","WMT","PFE","XOM","HD","DIS","NFLX","UBER","PYPL","BABA","AMD",
    "INTC","CRM","ADBE","ORCL","QCOM","SPY","QQQ","BAC","GS","MS","C",
    "WFC","UNH","CVX","LLY","JNJ","PG","KO","PEP","MCD","NKE","SBUX",
    "COST","AVGO","TXN","HON","UNP","CAT","DE","MMM","IBM","T","VZ",
    "CSCO","AMAT","LRCX","MU","NOW","SNOW","PLTR","RBLX","COIN","HOOD",
    "RIVN","LCID","NIO","XPEV","SHOP","SE","GRAB","DKNG","PENN","MGM",
    "WYNN","LVS","MRNA","BNTX","REGN","BIIB","GILD","AMGN","BMY","ABT",
    "MDT","BSX","SYK","ZBH","EW","ISRG","DHR","TMO","IQV","A","MTD",
    "BRK","BRK.A","BRK.B","TMUS","CHTR","CMCSA","FOX","FOXA","PARA",
    "WBD","LUMN","DISH","SIRI","SPOT","PINS","SNAP","LYFT",
    "ABNB","DASH","PTON","ZM","DOCU","OKTA","CRWD","S","PANW","FTNT",
    "NET","DDOG","ESTC","MDB","CFLT","GTLB","HUBS","BILL","COUP","PCTY",
    "AYX","SPSC","NCNO","PAYO","FOUR","GPN","FIS","FISV","SQ","AFRM",
    "SOFI","LC","OPEN","EXPI","Z","RDFN","CSGP","VICI","O","AMT","CCI",
    "EQIX","DLR","PSA","EXR","AVB","EQR","MAA","CPT","UDR","NDAQ",
    "ICE","CME","CBOE","MKTX","LPLA","RJF","SF","EVR","LAZ","HLI",
    "ROKU","TTD","PUBM","MGNI","IAS","DV","BURL","TJX","ROST",
    "FIVE","ULTA","LULU","GPS","ANF","AEO","PVH","VFC","HBI","UAA",
    "ADDYY","SKX","CROX","DECK","BOOT","SHOO",
    "F","GM","STLA","TM","HMC","RACE","FSR","GOEV",
    "WKHS","NKLA","HYLN","RIDE","SOLO","LI","BLNK","CHPT",
    "EVGO","VLTA","PTRA","NFE","CLNE","PLUG","FCEL","BE","BLDP",
}

# ── Natural language → ticker mapping ────────────────────────────────────────
# Handles "apple", "tesla", "microsoft" etc. in user messages
COMPANY_TO_TICKER = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "nvidia": "NVDA",
    "meta": "META",
    "facebook": "META",
    "tesla": "TSLA",
    "netflix": "NFLX",
    "uber": "UBER",
    "paypal": "PYPL",
    "alibaba": "BABA",
    "amd": "AMD",
    "intel": "INTC",
    "salesforce": "CRM",
    "adobe": "ADBE",
    "oracle": "ORCL",
    "qualcomm": "QCOM",
    "disney": "DIS",
    "walmart": "WMT",
    "jpmorgan": "JPM",
    "jp morgan": "JPM",
    "visa": "V",
    "mastercard": "MA",
    "pfizer": "PFE",
    "exxon": "XOM",
    "home depot": "HD",
    "coca cola": "KO",
    "cocacola": "KO",
    "pepsi": "PEP",
    "mcdonalds": "MCD",
    "nike": "NKE",
    "starbucks": "SBUX",
    "costco": "COST",
    "broadcom": "AVGO",
    "ibm": "IBM",
    "cisco": "CSCO",
    "snowflake": "SNOW",
    "palantir": "PLTR",
    "roblox": "RBLX",
    "coinbase": "COIN",
    "rivian": "RIVN",
    "lucid": "LCID",
    "shopify": "SHOP",
    "spotify": "SPOT",
    "snapchat": "SNAP",
    "airbnb": "ABNB",
    "doordash": "DASH",
    "peloton": "PTON",
    "zoom": "ZM",
    "docusign": "DOCU",
    "okta": "OKTA",
    "crowdstrike": "CRWD",
    "palo alto": "PANW",
    "fortinet": "FTNT",
    "cloudflare": "NET",
    "datadog": "DDOG",
    "mongodb": "MDB",
    "lyft": "LYFT",
    "ford": "F",
    "general motors": "GM",
    "toyota": "TM",
    "ferrari": "RACE",
    "nio": "NIO",
    "moderna": "MRNA",
    "pfizer": "PFE",
    "johnson": "JNJ",
    "goldman sachs": "GS",
    "goldman": "GS",
    "morgan stanley": "MS",
    "bank of america": "BAC",
    "wells fargo": "WFC",
    "citigroup": "C",
    "citi": "C",
}

# ── AlphaScope platform knowledge ────────────────────────────────────────────
PLATFORM_KNOWLEDGE = """
ALPHASCOPE PLATFORM — COMPLETE FEATURE GUIDE:

📊 DASHBOARD (/):
- Portfolio Value card — total current value of all holdings
- Total Gain/Loss card — profit/loss since inception
- Active Alerts card — number of price alerts set, triggered today count
- Paper Balance card — available virtual cash for trading
- Top Holdings section — top 5 stocks by value with P&L
- AI Recommendations section — ML + RL + LLM signals for held stocks
- Recent Trades section — last 5 trades placed

📈 TRADING (/trading):
- Search bar — search any stock by symbol or company name
- Live price with change % (WebSocket updates every 15 seconds)
- Price Chart — Line chart (your API data) or Candlestick (TradingView)
- Chart intervals: 1D, 1W, 1M, 3M, 1Y
- Technical Indicators: RSI (14), MACD, MA20, MA50
- AI Signals panel: ML (LightGBM), RL (PPO), LLM (LLaMA3) signals with confidence %
- Weighted ensemble consensus: BUY/SELL/HOLD based on all 3 strategies
- Place Order form: enter quantity, see estimated total, click BUY or SELL
- Smart Size suggestions: Safe/Balanced/Bold position sizes
- Your Holdings table: all positions with P&L
- Trade History: collapsible list of all past trades

💼 PORTFOLIO (/portfolio):
- All paper trading holdings with shares, avg cost, current price, P&L
- Total portfolio value and unrealised P&L

⭐ WATCHLIST (/watchlist):
- Stocks being monitored — add any symbol to track
- View price and basic info for watchlisted stocks

🔔 ALERTS (/alerts):
- Price alerts — set target price for any stock
- Get notified when stock hits target (above or below)
- Toggle alerts active/inactive, delete alerts

📰 NEWS (/news):
- Latest financial news from Finnhub for watchlist and portfolio stocks
- News sentiment analysis
- Filtered by stocks you hold or watch

⚙️ SETTINGS (/settings):
- Account settings: change email, change password
- Delete account option
- Theme toggle (dark/light mode)

🤖 AI SYSTEM:
- ML strategy: LightGBM classifier with 10 features (lag1/2/3, mom5/10, vol5/10, ma_ratio, rsi, vol_ratio)
- RL strategy: PPO agent trained on historical returns with momentum/volatility signals
- LLM strategy: LLaMA-3.1-8B-Instant via Groq — analyzes RSI, MACD, MA50 context
- Ensemble: weighted score = Σ(action × confidence) → BUY if >0.5, SELL if <-0.5
- SPS metric: composite score combining Sharpe, Calmar, Drawdown, Fill Rate, Consistency

💰 PAPER TRADING:
- Starts with $100,000 virtual money — no real money involved
- BUY = spend virtual cash to acquire shares
- SELL = sell held shares, cash returns to balance
- Reset Account = clear all trades and restart with $100,000
- All prices use real market data via yfinance + Finnhub APIs
"""

# ── Page context map ──────────────────────────────────────────────────────────
PAGE_NAMES = {
    "/":          "Dashboard",
    "/dashboard": "Dashboard",
    "/trading":   "Trading",
    "/portfolio": "Portfolio",
    "/watchlist": "Watchlist",
    "/alerts":    "Alerts",
    "/news":      "News",
    "/settings":  "Settings",
}

# ── Finance keyword check ─────────────────────────────────────────────────────
FINANCE_KEYWORDS = {
    "stock","market","trading","invest","portfolio","price","share",
    "buy","sell","hold","rsi","macd","moving average","indicator",
    "dividend","earnings","revenue","profit","loss","p&l","balance",
    "alert","watchlist","news","crypto","etf","fund","index","nifty",
    "sensex","nasdaq","nyse","dow","s&p","chart","candle","trend",
    "signal","ai","recommendation","paper","virtual","trade","broker",
    "bull","bear","volatility","momentum","sharpe","drawdown","return",
    "gain","value","forecast","analysis","technical","fundamental",
    "alphascope","dashboard","holdings","position","order","quantity",
    "apple","tesla","google","amazon","microsoft","nvidia","meta",
}

ALPHASCOPE_KEYWORDS = {
    "alphascope","dashboard","holdings","portfolio","watchlist","alert",
    "trading page","paper balance","ai signal","ai recommendation",
    "paper trading","virtual money","how do i","what is","how to",
    "help","explain","feature","page","section","button","reset",
}


def is_relevant_query(message: str) -> bool:
    msg = message.lower()
    if any(k in msg for k in FINANCE_KEYWORDS):
        return True
    if any(k in msg for k in ALPHASCOPE_KEYWORDS):
        return True
    # check natural language company names
    for company in COMPANY_TO_TICKER:
        if company in msg:
            return True
    # check explicit uppercase ticker symbols only against known list
    words = re.findall(r'\b[A-Z]{2,5}\b', message.upper())
    for word in words:
        if word in KNOWN_TICKERS:
            return True
    return False


# ── Extract ticker: known symbols + natural language company names ────────────
def extract_ticker(message: str) -> str | None:
    """
    Returns a valid ticker symbol from the message.
    Checks natural language company names first (e.g. 'apple' → 'AAPL'),
    then explicit uppercase symbols against the known tickers list.
    Never returns a raw word that isn't a real ticker.
    """
    msg_lower = message.lower()

    # 1. natural language company name match
    for company, ticker in COMPANY_TO_TICKER.items():
        if company in msg_lower:
            return ticker

    # 2. explicit uppercase ticker match (only if in KNOWN_TICKERS)
    words = re.findall(r'\b[A-Z]{2,5}\b', message.upper())
    for word in words:
        if word in KNOWN_TICKERS:
            return word

    return None


# ── Fetch Finnhub news ────────────────────────────────────────────────────────
def fetch_stock_news(symbol: str) -> list[str]:
    try:
        today = datetime.utcnow().date()
        past  = today - timedelta(days=5)
        res = requests.get(
            "https://finnhub.io/api/v1/company-news",
            params={
                "symbol": symbol,
                "from":   past.isoformat(),
                "to":     today.isoformat(),
                "token":  settings.FINNHUB_API_KEY,
            },
            timeout=4,
        )
        items = res.json()[:4]
        return [f"• {a.get('headline','')}" for a in items if a.get('headline')]
    except Exception:
        return []


# ── Fetch web search results via SerpAPI / fallback ──────────────────────────
def fetch_web_search(query: str) -> list[str]:
    """
    Fetches top web search snippets for a stock-related query.
    Uses SerpAPI if SERPAPI_KEY is configured, otherwise returns empty list.
    """
    api_key = getattr(settings, "SERPAPI_KEY", None)
    if not api_key:
        return []
    try:
        res = requests.get(
            "https://serpapi.com/search",
            params={
                "q":      query,
                "api_key": api_key,
                "num":    4,
                "engine": "google",
            },
            timeout=5,
        )
        data = res.json()
        results = data.get("organic_results", [])
        snippets = []
        for r in results[:4]:
            title   = r.get("title", "")
            snippet = r.get("snippet", "")
            if snippet:
                snippets.append(f"• {title}: {snippet}")
        return snippets
    except Exception:
        return []


# ── Check if query needs news / web search ───────────────────────────────────
def needs_news(message: str) -> bool:
    keywords = {
        "news","latest","why","reason","update","happening","today",
        "recent","price","fell","rise","dropped","up","down","crash",
        "rally","earnings","report","announce","quarter","beat","miss",
    }
    return any(k in message.lower() for k in keywords)


# ── Groq API call ─────────────────────────────────────────────────────────────
def _groq_chat(messages: list, max_tokens: int = 450) -> str:
    api_key = getattr(settings, "GROQ_API_KEY", None)
    if not api_key:
        raise Exception("GROQ_API_KEY not configured in settings")

    res = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
        },
        json={
            "model":       "llama-3.1-8b-instant",   # ✅ correct model name
            "messages":    messages,
            "temperature": 0.3,
            "max_tokens":  max_tokens,
        },
        timeout=20,
    )
    data = res.json()
    if "choices" not in data:
        raise Exception(f"Groq error: {data}")
    return data["choices"][0]["message"]["content"].strip()


# ── Main chatbot ──────────────────────────────────────────────────────────────
def ask_chatbot(
    user_id,
    user_message: str,
    username:    str   = "Trader",        # ✅ added for personalised greeting
    context:     list  = None,
    portfolio:   list  = None,
    market_data: list  = None,
    watchlist:   list  = None,
    page_context: str  = "",
    pathname:    str   = "",
) -> tuple[str, bool]:
    """
    Returns (reply: str, web_searched: bool)
    """
    portfolio   = portfolio   or []
    market_data = market_data or []
    watchlist   = watchlist   or []
    context     = context     or []
    username    = username    or "Trader"

    # ── Filter non-relevant queries ───────────────────────────────────────────
    if not is_relevant_query(user_message):
        return (
            f"Hi {username}! I'm AlphaScope AI, your trading assistant. I can help with:\n"
            "• Stock prices and analysis\n"
            "• Your portfolio and holdings\n"
            "• Technical indicators (RSI, MACD)\n"
            "• AI trading signals (ML, RL, LLM)\n"
            "• How to use AlphaScope features\n\n"
            "Ask me anything about stocks or trading!",
            False
        )

    web_searched = False
    news_lines   = []
    web_lines    = []
    live_prices  = {m["symbol"]: m["price"] for m in market_data}

    # ── Resolve ticker (safe — no false positives) ────────────────────────────
    ticker = extract_ticker(user_message)

    # ── Parallel: fetch Finnhub news + web search if relevant ────────────────
    if needs_news(user_message) and ticker:
        web_searched = True
        with ThreadPoolExecutor(max_workers=2) as ex:
            news_future = ex.submit(fetch_stock_news, ticker)
            web_future  = ex.submit(
                fetch_web_search,
                f"{ticker} stock news {datetime.utcnow().strftime('%B %Y')}"
            )
            try:
                news_lines = news_future.result(timeout=5)
            except Exception:
                news_lines = []
            try:
                web_lines = web_future.result(timeout=5)
            except Exception:
                web_lines = []

    # ── Format portfolio ──────────────────────────────────────────────────────
    if portfolio:
        port_str = "\n".join(
            f"  • {p['symbol']}: {p['shares']} shares @ ${p['avg_cost']:.2f} avg "
            f"(now ${p['current_price']:.2f}, P&L: {float(p.get('pnl_pct') or 0):+.1f}%)"
            for p in portfolio
        )
    else:
        port_str = "No holdings yet."

    # ── Format market data ────────────────────────────────────────────────────
    if market_data:
        mkt_str = "\n".join(
            f"  • {m['symbol']}: ${m['price']}"
            + (f" ({float(m.get('change_pct') or 0):+.2f}%)" if m.get("change_pct") else "")
            for m in market_data
        )
    else:
        mkt_str = "No live prices loaded."

    # ── Format watchlist ──────────────────────────────────────────────────────
    wl_str = ", ".join(watchlist) if watchlist else "none"

    # ── Format news + web search results ─────────────────────────────────────
    news_str = ""
    if news_lines:
        news_str += f"\nLATEST FINNHUB NEWS FOR {ticker}:\n" + "\n".join(news_lines)
    if web_lines:
        news_str += f"\nWEB SEARCH RESULTS FOR {ticker}:\n" + "\n".join(web_lines)

    # ── Determine current page name ───────────────────────────────────────────
    page_name = PAGE_NAMES.get(pathname, page_context or pathname or "Unknown page")

    # ── System prompt ─────────────────────────────────────────────────────────
    system_prompt = f"""You are AlphaScope AI, an expert trading assistant built into the AlphaScope paper trading platform.

{PLATFORM_KNOWLEDGE}

CURRENT SESSION:
- User's name: {username}  ← always address the user by this name
- User is on: {page_name}
- Watchlist: {wl_str}

USER'S PORTFOLIO:
{port_str}

LIVE MARKET DATA:
{mkt_str}
{news_str}

RECENT CONVERSATION:
{chr(10).join(context[-4:]) if context else "None"}

RESPONSE RULES:
- Always address the user as {username} — use their name naturally in responses
- On first message or greetings, open with "Hi {username}! 👋"
- Be concise — max 4-5 sentences or bullet points
- Use real portfolio/price data above when answering
- If asked about a page feature, explain it using the PLATFORM GUIDE above
- For stock signals: mention ML, RL, LLM consensus from portfolio data if available
- Always clarify this is paper trading (virtual money, not real)
- Never recommend real financial investments
- Format numbers with $ signs
- If web search results are provided above, use them to answer news/price questions

"""

    messages = [
        {"role": "system", "content": system_prompt},
    ]

    # add last 4 conversation turns
    for turn in context[-4:]:
        if "U:" in turn and " A:" in turn:
            parts = turn.split(" A:", 1)
            if len(parts) == 2:
                messages.append({"role": "user",      "content": parts[0][2:].strip()})
                messages.append({"role": "assistant",  "content": parts[1].strip()})

    messages.append({"role": "user", "content": user_message})

    # ── Call Groq ─────────────────────────────────────────────────────────────
    try:
        reply = _groq_chat(messages, max_tokens=450)
    except Exception as e:
        print(f"[Groq Error] {e}")
        return "AI service temporarily unavailable. Please try again in a moment.", web_searched

    return reply, web_searched