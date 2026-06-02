from .alphavantage_service import fetch_alphavantage_stock
from .finhub_service import fetch_finhub_stock
from .yahoo_service import fetch_yahoo_stock, fetch_company_info


def get_stock_data(symbol):

    price_data = None

    for fetch_fn in [fetch_finhub_stock, fetch_alphavantage_stock, fetch_yahoo_stock]:
        try:
            price_data = fetch_fn(symbol)
            if price_data and price_data[0]:  # ensures price isn't None/0
                break
        except Exception:
            continue
    
    if not price_data:
        raise Exception(f"All stock APIs failed for {symbol}")

    company = fetch_company_info(symbol)  # already cached inside fetch_company_info

    return {
        "symbol":       symbol.upper(),
        "price":        price_data[0],
        "high":         price_data[1],
        "low":          price_data[2],
        "volume":       price_data[3],
        "company_info": company,
    }