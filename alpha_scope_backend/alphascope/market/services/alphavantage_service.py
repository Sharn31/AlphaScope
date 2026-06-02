import requests
from django.conf import settings

def fetch_alphavantage_stock(symbol):
    api_key = settings.ALPHA_VANTAGE_API_KEY
    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={api_key}"
    response = requests.get(url)
    data = response.json()

    price = data["Global Quote"]["05. price"]
    volume = data["Global Quote"]["06. volume"]
    high = data["Global Quote"]["03. high"]
    low = data["Global Quote"]["04. low"]
    return price,volume,high,low