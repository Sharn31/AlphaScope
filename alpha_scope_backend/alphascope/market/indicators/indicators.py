import pandas as pd
import pandas_ta as ta


def calculate_indicators(df) -> dict:
    if df is None or df.empty:
        return _empty_indicators()

    if "Close" not in df.columns:
        return _empty_indicators()

    if len(df) < 20:
        return _empty_indicators()

    try:
        df_copy = df.copy()

        # RSI
        df_copy["RSI"] = ta.rsi(df_copy["Close"], length=14)

        # Moving Averages
        df_copy["MA20"] = ta.sma(df_copy["Close"], length=20)
        df_copy["MA50"] = ta.sma(df_copy["Close"], length=50) if len(df) >= 50 else None

        # MACD
        macd = ta.macd(df_copy["Close"], fast=12, slow=26, signal=9)
        if macd is not None:
            df_copy["MACD"] = macd["MACD_12_26_9"]
            df_copy["MACD_SIGNAL"] = macd["MACDs_12_26_9"]

        latest = df_copy.iloc[-1]
        current_price = round(float(latest["Close"]), 2)

        # RSI signal
        rsi_val = round(latest["RSI"], 2) if pd.notna(latest["RSI"]) else None
        if rsi_val:
            if rsi_val > 70:
                rsi_signal = "Overbought ⚠️"
            elif rsi_val < 30:
                rsi_signal = "Oversold 💡"
            else:
                rsi_signal = "Neutral ✅"
        else:
            rsi_signal = "N/A"

        # MACD signal
        macd_val = round(float(latest["MACD"]), 2) if "MACD" in df_copy.columns and pd.notna(latest["MACD"]) else None
        macd_signal_val = round(float(latest["MACD_SIGNAL"]), 2) if "MACD_SIGNAL" in df_copy.columns and pd.notna(latest["MACD_SIGNAL"]) else None
        if macd_val and macd_signal_val:
            macd_signal = "Bullish 📈" if macd_val > macd_signal_val else "Bearish 📉"
        else:
            macd_signal = "N/A"

        # MA signal
        ma20_val = round(float(latest["MA20"]), 2) if pd.notna(latest["MA20"]) else None
        ma50_val = round(float(latest["MA50"]), 2) if "MA50" in df_copy.columns and pd.notna(latest["MA50"]) else None
        ma20_signal = "Above ✅" if ma20_val and current_price > ma20_val else "Below ⚠️"
        ma50_signal = "Above ✅" if ma50_val and current_price > ma50_val else "Below ⚠️"

        return {
            "status": "ok",
            "price": current_price,
            "rsi": rsi_val or "N/A",
            "rsi_signal": rsi_signal,
            "moving_average": ma20_val or "N/A",
            "ma20": ma20_val or "N/A",
            "ma20_signal": ma20_signal,
            "ma50": ma50_val or "N/A",
            "ma50_signal": ma50_signal,
            "macd": macd_val or "N/A",
            "macd_signal": macd_signal,
        }

    except Exception as e:
        print(f"[DEBUG] Indicator calculation failed: {e}")
        return _empty_indicators()


def _empty_indicators() -> dict:
    return {
        "status": "no_data",
        "price": "N/A",
        "rsi": "N/A",
        "rsi_signal": "N/A",
        "moving_average": "N/A",
        "ma20": "N/A",
        "ma20_signal": "N/A",
        "ma50": "N/A",
        "ma50_signal": "N/A",
        "macd": "N/A",
        "macd_signal": "N/A",
    }