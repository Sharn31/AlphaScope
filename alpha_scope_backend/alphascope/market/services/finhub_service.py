import requests
from django.conf import settings
from datetime import datetime, timedelta
import logging
logger = logging.getLogger(__name__)

def fetch_finhub_stock(symbol):
    api_key=settings.FINNHUB_API_KEY

    url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={api_key}"
    
    response=requests.get(url)
    data=response.json()
    price=data.get("c")
    high=data.get("h")
    low=data.get("l")
    volume=data.get("v")
    
    return price,high,low,volume

def fetch_news(symbol):
    api_key=settings.FINNHUB_API_KEY
    
    today = datetime.today().date()
    last_week = today - timedelta(days=7)

    url = (
        f"https://finnhub.io/api/v1/company-news?"
        f"symbol={symbol}&from={last_week}&to={today}&token={api_key}"
    )

    response = requests.get(url)
    news = response.json()

    return news[:5]   

import requests
from datetime import datetime, timedelta

def fetch_finnhub_sentiment(symbol):
    api_key = settings.FINNHUB_API_KEY
    
    # Free endpoint: company news (last 7 days)
    date_to = datetime.today().strftime("%Y-%m-%d")
    date_from = (datetime.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    url = (
        f"https://finnhub.io/api/v1/company-news"
        f"?symbol={symbol}&from={date_from}&to={date_to}&token={api_key}"
    )

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        articles = response.json()

        if not articles:
            logger.warning(f"No news for {symbol}")
            return None

        articles_in_week = len(articles)

        # Simple keyword-based sentiment scoring
        bullish_keywords = ["beat", "surge", "rally", "upgrade", "growth", "profit", "record", "gain", "strong", "buy"]
        bearish_keywords = ["miss", "drop", "crash", "downgrade", "loss", "cut", "weak", "lawsuit", "layoff", "sell"]

        bullish_count = 0
        bearish_count = 0

        for article in articles:
            text = (article.get("headline", "") + " " + article.get("summary", "")).lower()
            b_score = sum(1 for w in bullish_keywords if w in text)
            s_score = sum(1 for w in bearish_keywords if w in text)
            if b_score > s_score:
                bullish_count += 1
            elif s_score > b_score:
                bearish_count += 1

        neutral_count = articles_in_week - bullish_count - bearish_count
        total = articles_in_week or 1  # avoid division by zero

        bullish_percent = round((bullish_count / total) * 100, 2)
        bearish_percent = round((bearish_count / total) * 100, 2)
        neutral_percent = round((neutral_count / total) * 100, 2)

        if bullish_percent > bearish_percent and bullish_percent > neutral_percent:
            label = "bullish"
        elif bearish_percent > bullish_percent and bearish_percent > neutral_percent:
            label = "bearish"
        else:
            label = "neutral"

        return {
            "symbol": symbol,
            "buzz": round(articles_in_week / 7, 2),        # avg articles/day as buzz proxy
            "articles_in_week": articles_in_week,
            "weekly_average": round(articles_in_week / 7, 2),
            "company_news_score": round(bullish_percent / 100, 4),  # 0–1 float to match frontend
            "sector_avg_bullish": 0,                         # not available on free plan
            "sector_avg_score": 0,
            "bearish_percent": bearish_percent,
            "bullish_percent": bullish_percent,
            "neutral_percent": neutral_percent,
            "sentiment_label": label,
        }

    except Exception as e:
        logger.error(f"fetch_finnhub_sentiment failed for {symbol}: {e}")
        return None