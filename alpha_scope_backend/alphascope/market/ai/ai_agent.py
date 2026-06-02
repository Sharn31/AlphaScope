def get_ai_recommendation(symbol, price, indicators):
    
    # ✅ Case 1: No historical data
    if indicators.get("status") == "no_data":
        return (
            f"Limited data available for {symbol}. "
            f"Current price is {price}. "
            "Recommendation is based only on price movement. "
            "Consider waiting for more historical data before making decisions."
        )

    # ✅ Case 2: Indicators available
    rsi = indicators.get("rsi")
    ma = indicators.get("moving_average")

    if rsi == "N/A" or ma == "N/A":
        return (
            f"Indicators incomplete for {symbol}. "
            "Market signal is unclear. Proceed cautiously."
        )

    # ✅ Normal logic
    if rsi < 30:
        return "Stock is oversold. Possible BUY opportunity."
    elif rsi > 70:
        return "Stock is overbought. Possible SELL signal."
    else:
        return "Stock is in neutral zone. HOLD."