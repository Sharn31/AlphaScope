"""
market/ai/strategy_signals.py
Production-ready: ML (LightGBM) + RL proxy + LLM + Ensemble
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from django.core.cache import cache

# External services
from market.services.histrocial_data_service import get_cached_history as service_history
from market.indicators.indicators import calculate_indicators



# CONFIG

MODEL_PATH = "models/lgbm_model.pkl"
FEATURES = [
    "lag1", "lag2", "lag3",
    "mom5", "mom10",
    "vol5", "vol10",
    "ma_ratio", "rsi", "vol_ratio"
]



# DATA FETCH (SAFE WRAPPER)

def fetch_history(symbol: str):
    """
    Wraps service_history with a MultiIndex fix.
    NOTE: The period must be set to '2y' in histrocial_data_service.py
    so that enough rows are available for ML training (need 60+).
    """
    df = service_history(symbol)
    if df is None or df.empty:
        return None

    # Flatten MultiIndex columns yfinance sometimes returns
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    print(f"[ML DEBUG] {symbol}: {len(df)} rows fetched")
    return df


# FEATURE ENGINEERING

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["return"] = df["Close"].pct_change()

    df["lag1"] = df["return"].shift(1)
    df["lag2"] = df["return"].shift(2)
    df["lag3"] = df["return"].shift(3)

    df["mom5"]  = df["Close"].pct_change(5)
    df["mom10"] = df["Close"].pct_change(10)

    df["vol5"]  = df["return"].rolling(5).std()
    df["vol10"] = df["return"].rolling(10).std()

    df["ma5"]      = df["Close"].rolling(5).mean()
    df["ma20"]     = df["Close"].rolling(20).mean()
    df["ma_ratio"] = df["ma5"] / df["ma20"]

    delta = df["Close"].diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / (loss + 1e-9)
    df["rsi"] = 100 - (100 / (1 + rs))

    if "Volume" in df.columns:
        df["vol_ratio"] = df["Volume"] / df["Volume"].rolling(10).mean()
    else:
        df["vol_ratio"] = 1.0

    df["target"] = (df["return"].shift(-1) > 0).astype(int)

    df = df.dropna(subset=FEATURES + ["target"])
    return df



# MODEL LOADING / TRAINING

def get_or_train_model(df: pd.DataFrame, symbol: str = ""):
    """
    Load a saved model if available, otherwise train fresh on the
    provided dataframe and persist it.
    Each symbol gets its own model file so models don't overwrite each other.
    """
    import lightgbm as lgb

    model_path = f"models/lgbm_{symbol}.pkl" if symbol else MODEL_PATH

    if os.path.exists(model_path):
        return joblib.load(model_path)

    split = int(len(df) * 0.8)
    train = df[:split]

    model = lgb.LGBMClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        random_state=42,
        class_weight="balanced",
        verbose=-1,
    )
    model.fit(train[FEATURES], train["target"])

    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    joblib.dump(model, model_path)

    return model



# ML SIGNAL (LightGBM)

def get_ml_signal(symbol: str) -> dict:
    try:
        df = fetch_history(symbol)

        if df is None or len(df) < 60:
            return _default_signal("ML", "HOLD", 0.5, "Insufficient data")

        df = build_features(df)

        if len(df) < 40:
            return _default_signal("ML", "HOLD", 0.5, "Not enough clean rows")

        # ✅ Pass symbol so each stock gets its own saved model
        model = get_or_train_model(df, symbol=symbol)

        latest_row = df[FEATURES].iloc[[-1]]
        prob_up    = model.predict_proba(latest_row)[0][1]
        prob_down  = 1 - prob_up

        # Confidence = how far prob is from the 0.5 baseline
        confidence = round(float(abs(prob_up - 0.5) * 2), 3)

        if prob_up > 0.55:
            action = "BUY"
        elif prob_down > 0.55:
            action = "SELL"
        else:
            action = "HOLD"

        importance = dict(zip(FEATURES, model.feature_importances_))

        return {
            "strategy":           "ML (LightGBM)",
            "action":             action,
            "confidence":         confidence,
            "signal_value":       round(float(prob_up), 4),
            "feature_importance": importance,
            "reasoning":          f"P(up)={prob_up:.1%}, P(down)={prob_down:.1%}",
            "status":             "ok",
        }

    except Exception as e:
        return _default_signal("ML", "HOLD", 0.5, f"Error: {str(e)[:80]}")



# RL SIGNAL (PROXY)

def get_rl_signal(symbol: str) -> dict:
    try:
        df = fetch_history(symbol)

        if df is None or len(df) < 30:
            return _default_signal("RL", "HOLD", 0.5, "Insufficient data")

        returns    = df["Close"].pct_change().dropna()
        momentum   = float(returns.iloc[-5:].mean())
        volatility = float(returns.iloc[-20:].std())
        sharpe     = momentum / (volatility + 1e-8)

        if sharpe > 0.15:
            action    = "BUY"
            reasoning = f"Positive momentum/volatility ratio: {sharpe:.3f}"
        elif sharpe < -0.15:
            action    = "SELL"
            reasoning = f"Negative momentum/volatility ratio: {sharpe:.3f}"
        else:
            action    = "HOLD"
            reasoning = f"Neutral signal: {sharpe:.3f}"

        confidence = min(0.92, 0.55 + abs(sharpe) * 0.5) if action != "HOLD" else 0.5

        return {
            "strategy":     "RL (PPO proxy)",
            "action":       action,
            "confidence":   round(confidence, 3),
            "signal_value": round(float(sharpe), 6),
            "reasoning":    reasoning,
            "status":       "ok",
        }

    except Exception as e:
        return _default_signal("RL", "HOLD", 0.5, f"Error: {str(e)[:80]}")



# LLM SIGNAL

def get_llm_signal(symbol: str, indicators: dict) -> dict:
    try:
        from groq import Groq
        from django.conf import settings

        api_key = getattr(settings, "GROQ_API_KEY", None)
        if not api_key:
            return _default_signal("LLM", "HOLD", 0.5, "No Groq API key configured")

        rsi = indicators.get("rsi", 50)
        try:
            rsi = float(rsi)
        except (TypeError, ValueError):
            rsi = 50.0

        macd_sig = indicators.get("macd_signal", "neutral") or "neutral"
        ma50_sig = indicators.get("ma50_signal", "neutral") or "neutral"

        client = Groq(api_key=api_key)

        prompt = (
            f"You are a trading agent for stock {symbol}.\n"
            f"RSI: {rsi:.1f}, MACD: {macd_sig}, MA50: {ma50_sig}\n"
            f"RSI below 35 means oversold. RSI above 65 means overbought.\n"
            "Reply with ONLY this JSON and nothing else:\n"
            '{"action": "BUY", "confidence": 0.75, "reasoning": "your reason here"}\n'
            "action must be BUY or SELL or HOLD."
        )

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.1,
        )

        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()
        start   = content.find("{")
        end     = content.rfind("}") + 1
        if start != -1 and end > start:
            content = content[start:end]

        result     = json.loads(content)
        action     = result.get("action", "HOLD").upper()
        confidence = float(result.get("confidence", 0.5))
        reasoning  = result.get("reasoning", "LLM signal")

        if action not in ["BUY", "SELL", "HOLD"]:
            action = "HOLD"

        return {
            "strategy":     "LLM (LLaMA3)",
            "action":       action,
            "confidence":   round(confidence, 3),
            "signal_value": 1.0 if action == "BUY" else (-1.0 if action == "SELL" else 0.0),
            "reasoning":    reasoning,
            "status":       "ok",
        }

    except json.JSONDecodeError as e:
        return _default_signal("LLM", "HOLD", 0.5, f"JSON parse error: {str(e)[:60]}")
    except Exception as e:
        return _default_signal("LLM", "HOLD", 0.5, f"Error: {str(e)[:80]}")


# ─────────────────────────────────────────────────────────────
# ENSEMBLE
# ─────────────────────────────────────────────────────────────
def combine_signals(ml: dict, rl: dict, llm: dict) -> dict:
    mapping = {"BUY": 1, "SELL": -1, "HOLD": 0}

    score = (
        mapping[ml["action"]]  * ml["confidence"]  +
        mapping[rl["action"]]  * rl["confidence"]  +
        mapping[llm["action"]] * llm["confidence"]
    )

    if score > 0.5:
        final = "BUY"
    elif score < -0.5:
        final = "SELL"
    else:
        final = "HOLD"

    return {
        "strategy":     "ENSEMBLE",
        "action":       final,
        "confidence":   round(abs(score) / 3, 3),
        "signal_value": round(float(score), 4),
        "reasoning":    "Combined ML + RL + LLM",
        "status":       "ok",
    }


# ─────────────────────────────────────────────────────────────
# DEFAULT
# ─────────────────────────────────────────────────────────────
def _default_signal(strategy, action, confidence, reason):
    return {
        "strategy":     strategy,
        "action":       action,
        "confidence":   confidence,
        "signal_value": 0.0,
        "reasoning":    reason,
        "status":       "error",
    }