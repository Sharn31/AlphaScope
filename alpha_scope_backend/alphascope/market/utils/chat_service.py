from rest_framework.decorators import api_view
from rest_framework.response import Response
from market.services.aggregator_service import get_stock_data
from market.services.finhub_service import fetch_news
from market.services.kb_service import search_knowledge_base
from google import genai
import os
import re
from market.services.ai_service import ask_gemini_ai

user_sessions = {}

def get_user_session(user_id) -> dict:
    if user_id not in user_sessions:
        user_sessions[user_id] = {
            "context": [],
            "last_stock": None
        }
    return user_sessions[user_id]

def extract_symbols(message: str) -> list[str]:
    STOPWORDS = {
        "A", "I", "MY", "THE", "FOR", "BUY", "HIGH", "LOW", "AND", "OR",
        "IS", "IN", "AT", "BE", "TO", "DO", "GO", "IT", "NO", "SO", "UP",
        "WHAT", "WHEN", "WHERE", "WHICH", "WHO", "WHY", "HOW",
        "THIS", "THAT", "THEN", "THAN", "WITH", "FROM", "HAVE", "WILL",
        "STOCK", "STOCKS", "PRICE", "MARKET", "TRADE", "TRADING", "TELL",
        "ME", "ABOUT", "GIVE", "SHOW", "CAN", "YOU", "ARE", "WAS", "HAS"
    }
    found = re.findall(r"\b[A-Z]{2,5}\b", message.upper())
    return [s for s in found if s not in STOPWORDS]

def generate_stock_summary(symbols: list[str]) -> list[dict]:
    stocks = []
    for symbol in symbols:
        try:
            data = get_stock_data(symbol)
            if data and data.get("price"):
                stocks.append({
                    "symbol": symbol,
                    "price": data.get("price"),
                    "high": data.get("high"),
                    "low": data.get("low"),
                    "volume": data.get("volume"),
                })
        except Exception as e:
            print(f"[WARN] Could not fetch data for {symbol}: {e}")
    return stocks

def format_reply(text: str) -> str:
    if not text:
        return text

    # Remove ** bold markers
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)

    # Convert nested bullets to arrow
    text = re.sub(r"^\s{4,}[\*\-]\s+", "  -> ", text, flags=re.MULTILINE)

    # Convert * or - bullets to •
    text = re.sub(r"^\s*[\*\-]\s+", "• ", text, flags=re.MULTILINE)

    # Remove # header markers
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)

    # Remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

def ask_chatbot(user_id: int, user_message: str, context: list = None) -> str:
    if context is None:
        context = []

    session = get_user_session(user_id)
    session["context"] = context

    message_clean = user_message.strip()

    if not message_clean:
        return "Please enter a message."

    # 1. Knowledge base check
    kb_answer = search_knowledge_base(message_clean)
    if kb_answer:
        return kb_answer

    # 2. Extract stock symbols and fetch live data
    symbols = extract_symbols(message_clean)
    stock_data = generate_stock_summary(symbols)
    stock_response = ""
    if stock_data:
        lines = []
        for s in stock_data:
            lines.append(f"Symbol  : {s['symbol']}")
            lines.append(f"Price   : ${s['price']}")
            lines.append(f"High    : ${s['high']}")
            lines.append(f"Low     : ${s['low']}")
            lines.append(f"Volume  : {s['volume']}")
            lines.append("-" * 30)
        stock_response = "\n".join(lines)
        session["last_stock"] = symbols[-1]

    # 3. AI response when no stock data or investment advice needed
    ai_response = ""
    needs_ai = not stock_response or any(
        word in message_clean.lower()
        for word in ["invest", "recommend", "advice", "should i", "what do you think", "analysis"]
    )
    if needs_ai:
        ai_response = ask_gemini_ai(message_clean, session["context"]) or ""
        if not ai_response:
            ai_response = "AI service is currently unavailable. Please try again later."

    # 4. Combine and return
    parts = [p for p in [stock_response, ai_response] if p]
    final = "\n\n".join(parts) if parts else "Sorry, I could not understand that. Try asking about a stock symbol or investment advice."
    return format_reply(final)


