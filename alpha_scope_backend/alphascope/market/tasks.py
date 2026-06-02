"""
tasks.py — AlphaScope Celery Tasks (CORRECTED to match models.py)

Models confirmed from models.py:
  ✅ ChatMessage
  ✅ StockAlert          — price alerts
  ✅ Watchlist
  ✅ Portfolio           — manual portfolio (NOT PaperHolding)
  ✅ News
  ✅ PaperTrade
  ✅ PaperHolding        — paper trading holdings
  ✅ NewsAlertPreference — one row per user, email_digest BooleanField
  ✅ NewsSymbolAlert     — per-symbol news alert (is_active, keyword)

FIXES vs previous version:
  FIX 1 — Import NewsSymbolAlert + NewsAlertPreference (correct model names)
  FIX 2 — Portfolio used for manual portfolio (not PaperHolding)
  FIX 3 — NewsAlertPreference.email_digest=True check works correctly now
  FIX 4 — unique_together on NewsSymbolAlert is (user, symbol, keyword)
           so paused check must match on symbol only (not keyword)
  FIX 5 — stock_alert_agent imports percentage_change alert type correctly
"""

import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from market.services.aggregator_service import get_stock_data
from market.services.finhub_service import fetch_news
from market.services.histrocial_data_service import get_cached_history
from market.indicators.indicators import calculate_indicators
from market.ai.ai_agent import get_ai_recommendation
from datetime import timedelta
from django.utils import timezone

# ── FIX 1: Correct model names from models.py ────────────────────────────────
from .models import (
    Watchlist,
    Portfolio,           # manual portfolio
    PaperHolding,        # paper trading holdings
    StockAlert,
    News,
    NewsAlertPreference, # email_digest toggle per user
    NewsSymbolAlert,     # per-symbol news alert (is_active, keyword)
)

logger   = logging.getLogger(__name__)
User     = get_user_model()
BASE_URL = getattr(settings, "FRONTEND_URL", "http://localhost:5173")


def get_email_footer():
    return """
─────────────────────────────────────────
📊 AlphaScope — Smart Stock Intelligence
─────────────────────────────────────────
📧 Support  : alphascope.team@gmail.com

⚠️  Disclaimer:
This email is for informational purposes only.
AlphaScope does not provide financial advice.
Always do your own research before investing.

© 2026 AlphaScope. All rights reserved.
─────────────────────────────────────────
    """


# ══════════════════════════════════════════════════════════════════════════════
# TASK 1 — Price Alert Agent
# Schedule → crontab(minute="*/5")
# ══════════════════════════════════════════════════════════════════════════════
@shared_task
def stock_alert_agent():
    alerts = StockAlert.objects.filter(is_active=True).select_related("user")
    logger.info(f"[ALERT AGENT] Checking {alerts.count()} active alerts")

    for alert in alerts:
        try:
            # Race-condition guard
            alert.refresh_from_db(fields=["is_active"])
            if not alert.is_active:
                logger.debug(f"[SKIP] alert.id={alert.id}: toggled off mid-run")
                continue

            symbol     = alert.symbol
            user_email = alert.user.email
            username   = alert.user.username

            # Validate fields based on alert_type
            if alert.alert_type == "price" and alert.target_price is None:
                logger.warning(f"[SKIP] {symbol}: target_price is None")
                continue
            if alert.alert_type == "percentage" and alert.percentage_change is None:
                logger.warning(f"[SKIP] {symbol}: percentage_change is None")
                continue

            # Cooldown
            if alert.last_triggered_at:
                cooldown_end = alert.last_triggered_at + timedelta(minutes=alert.cooldown_minutes)
                if timezone.now() < cooldown_end:
                    logger.debug(f"[COOLDOWN] {symbol}: until {cooldown_end}")
                    continue

            # Fetch price
            data = get_stock_data(symbol)
            if not data or "price" not in data:
                logger.warning(f"[SKIP] {symbol}: no price data")
                continue

            current_price = float(data["price"])

            # Trigger check
            trigger = False
            if alert.alert_type == "price":
                threshold = float(alert.target_price)
                if alert.condition == "above" and current_price > threshold:
                    trigger = True
                elif alert.condition == "below" and current_price < threshold:
                    trigger = True

            elif alert.alert_type == "percentage":
                # FIX 5: percentage_change alert — target_price = baseline price
                pct = float(alert.percentage_change)
                if alert.target_price:
                    baseline   = float(alert.target_price)
                    actual_pct = ((current_price - baseline) / baseline) * 100
                    if alert.condition == "above" and actual_pct >= pct:
                        trigger = True
                    elif alert.condition == "below" and actual_pct <= -pct:
                        trigger = True

            if not trigger:
                continue

            # Indicators
            df = get_cached_history(symbol)
            indicators = {
                "status": "no_data", "rsi": "N/A", "rsi_signal": "N/A",
                "macd": "N/A", "macd_signal": "N/A",
                "ma20": "N/A", "ma20_signal": "N/A",
                "ma50": "N/A", "ma50_signal": "N/A",
            }
            if df is not None:
                indicators = calculate_indicators(df)

            condition_label = "risen above" if alert.condition == "above" else "fallen below"
            alert_value_str = (
                f"${alert.target_price:.2f}"
                if alert.alert_type == "price"
                else f"{alert.percentage_change}%"
            )

            # AI recommendation
            try:
                ai_decision = (
                    get_ai_recommendation(symbol, current_price, indicators)
                    if indicators.get("status") == "ok"
                    else "Insufficient historical data for AI analysis."
                )
            except Exception as e:
                logger.error(f"[AI ERROR] {symbol}: {e}")
                ai_decision = "AI recommendation unavailable."

            # Send email
            try:
                send_mail(
                    subject=f"🔔 AlphaScope Alert: {symbol} has {condition_label} {alert_value_str}",
                    message=f"""
Dear {username},

Your price alert for {symbol} has been triggered.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 PRICE ALERT — {symbol}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stock         : {symbol}
Alert Type    : {alert.alert_type.capitalize()}
Condition     : Price {condition_label} {alert_value_str}
Current Price : ${current_price:.2f}
Triggered At  : {timezone.now().strftime("%Y-%m-%d %H:%M UTC")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 TECHNICAL INDICATORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RSI (14)  : {indicators['rsi']}  {indicators['rsi_signal']}
MACD      : {indicators['macd']}  {indicators['macd_signal']}
MA (20)   : {indicators['ma20']}  {indicators['ma20_signal']}
MA (50)   : {indicators['ma50']}  {indicators['ma50_signal']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{ai_decision}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 QUICK ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View Chart    : {BASE_URL}/trading/{symbol}
Your Alerts   : {BASE_URL}/alerts
Your Portfolio: {BASE_URL}/portfolio

{get_email_footer()}
                    """,
                    from_email="AlphaScope <alphascope.team@gmail.com>",
                    recipient_list=[user_email],
                    fail_silently=False,
                )
                logger.info(f"[ALERT SENT] {symbol} → {user_email} (${current_price:.2f})")
                alert.last_triggered_at = timezone.now()
                alert.save(update_fields=["last_triggered_at"])

            except Exception as e:
                logger.error(f"[EMAIL ERROR] {symbol} → {user_email}: {e}")

        except Exception as e:
            logger.error(f"[ALERT AGENT ERROR] alert.id={alert.id}: {e}")
            continue


# ══════════════════════════════════════════════════════════════════════════════
# TASK 2 — Daily News Digest
# Schedule → crontab(hour=8, minute=0)
#
# Logic (matched to your models.py):
#
#   NewsAlertPreference.email_digest = True/False  → user opted in/out of digest
#   NewsSymbolAlert.is_active        = True/False  → symbol-level on/off toggle
#   NewsSymbolAlert.keyword          = ""/"earnings" → optional keyword filter
#
#   unique_together = ["user", "symbol", "keyword"]  ← important for FIX 4
#
# Symbol inclusion per user:
#   1. Watchlist symbols    → included UNLESS is_active=False in NewsSymbolAlert
#   2. Portfolio symbols    → included UNLESS is_active=False in NewsSymbolAlert
#   3. PaperHolding symbols → included UNLESS is_active=False in NewsSymbolAlert
#   4. Custom NewsSymbolAlert(is_active=True) → included (non-watchlist/portfolio)
#
# FIX 4: unique_together includes keyword, so same symbol can have multiple
#   records with different keywords. We check is_active=False per symbol
#   (ignoring keyword) for the "paused" check — if ANY record for that symbol
#   is_active=False, treat symbol as paused only if ALL records are paused.
#   Simplified: paused = symbol where user has at least one is_active=False
#   AND no is_active=True record (i.e. net inactive).
# ══════════════════════════════════════════════════════════════════════════════
@shared_task
def stock_news_agent():
    logger.info("[NEWS AGENT] Starting daily digest run...")

    # FIX 3: NewsAlertPreference correctly used — get opted-in user IDs
    opted_in_user_ids = set(
        NewsAlertPreference.objects
        .filter(email_digest=True)
        .values_list("user_id", flat=True)
    )

    # If no one has a preference row yet → send to all users (graceful default)
    if not opted_in_user_ids:
        logger.info("[NEWS AGENT] No NewsAlertPreference rows found — sending to all users")
        users = User.objects.all()
    else:
        users = User.objects.filter(id__in=opted_in_user_ids)
        logger.info(f"[NEWS AGENT] {len(opted_in_user_ids)} users opted in to digest")

    for user in users.iterator():
        try:
            # ── Collect symbols from all sources ──────────────────────────────
            watchlist_syms = set(
                Watchlist.objects.filter(user=user)
                .values_list("symbol", flat=True)
            )
            # FIX 2: Portfolio = manual portfolio in your models.py
            portfolio_syms = set(
                Portfolio.objects.filter(user=user)
                .values_list("symbol", flat=True)
            )
            # Also include paper trading holdings
            paper_syms = set(
                PaperHolding.objects.filter(user=user)
                .values_list("symbol", flat=True)
            )
            auto_syms = watchlist_syms | portfolio_syms | paper_syms

            # ── Read NewsSymbolAlert records ──────────────────────────────────
            # FIX 4: unique_together = (user, symbol, keyword)
            # A symbol may have multiple rows (different keywords).
            # Build per-symbol active/paused state:
            #   - paused   = has at least one row AND all rows are is_active=False
            #   - active   = has at least one is_active=True row
            #   - custom   = active rows for symbols NOT in auto_syms

            sym_active_map: dict[str, bool] = {}   # symbol → net active state
            keyword_map:    dict[str, list[str]] = {}  # symbol → [keywords]

            for na in NewsSymbolAlert.objects.filter(user=user):
                sym = na.symbol
                # Net active: if ANY row is active → symbol is active
                current = sym_active_map.get(sym, False)
                sym_active_map[sym] = current or na.is_active

                if na.is_active and na.keyword:
                    keyword_map.setdefault(sym, []).append(na.keyword.strip().lower())

            # Separate paused from active
            paused_symbols = {s for s, active in sym_active_map.items() if not active}
            custom_active  = {s for s, active in sym_active_map.items()
                              if active and s not in auto_syms}

            # Final symbol set
            all_symbols = (auto_syms | custom_active) - paused_symbols

            if not all_symbols:
                logger.debug(
                    f"[SKIP] {user.email}: no symbols "
                    f"(auto={len(auto_syms)} custom={len(custom_active)} "
                    f"paused={sorted(paused_symbols) or 'none'})"
                )
                continue

            logger.info(
                f"[NEWS] {user.email}: {sorted(all_symbols)} "
                f"| paused={sorted(paused_symbols) or 'none'}"
            )

            # ── Source tag helper ─────────────────────────────────────────────
            def source_tag(sym: str) -> str:
                tags = []
                if sym in watchlist_syms: tags.append("Watchlist")
                if sym in portfolio_syms: tags.append("Portfolio")
                if sym in paper_syms:     tags.append("Paper")
                if sym in custom_active:  tags.append("Alert")
                return " · ".join(tags) if tags else "Alert"

            # ── Fetch news per symbol ─────────────────────────────────────────
            news_sections: list[str] = []
            news_to_create: list     = []

            for symbol in sorted(all_symbols):
                news_list = fetch_news(symbol)
                if not news_list:
                    continue

                # Apply keyword filters (if any for this symbol)
                keywords = keyword_map.get(symbol, [])
                if keywords:
                    news_list = [
                        n for n in news_list
                        if any(kw in n.get("headline", "").lower() for kw in keywords)
                    ]
                    if not news_list:
                        logger.debug(f"[NEWS] {symbol}: no articles match keywords {keywords}")
                        continue

                tag     = source_tag(symbol)
                section = (
                    f"\n{'━'*40}\n"
                    f"📰 {symbol}  [{tag}]\n"
                    f"{'━'*40}\n"
                )
                has_items = False

                for i, item in enumerate(news_list[:3], 1):
                    headline = item.get("headline", "").strip()
                    url      = item.get("url", "").strip()
                    source   = item.get("source", "Unknown")
                    if not headline or not url:
                        continue
                    news_to_create.append(
                        News(symbol=symbol, headline=headline, url=url)
                    )
                    section  += f"{i}. {headline}\n"
                    section  += f"   Source : {source}\n"
                    section  += f"   Link   : {url}\n\n"
                    has_items = True

                if has_items:
                    news_sections.append(section)

            # Bulk save
            if news_to_create:
                News.objects.bulk_create(news_to_create, ignore_conflicts=True)

            if not news_sections:
                logger.debug(f"[SKIP] {user.email}: no articles found")
                continue

            # ── Summary line ──────────────────────────────────────────────────
            parts = []
            eff_wl   = watchlist_syms  - paused_symbols
            eff_port = portfolio_syms  - paused_symbols
            eff_pap  = paper_syms      - paused_symbols - watchlist_syms - portfolio_syms
            eff_cust = custom_active   - paused_symbols
            if eff_wl:   parts.append(f"{len(eff_wl)} watchlist")
            if eff_port: parts.append(f"{len(eff_port)} portfolio")
            if eff_pap:  parts.append(f"{len(eff_pap)} paper holdings")
            if eff_cust: parts.append(f"{len(eff_cust)} custom alerts")
            if paused_symbols: parts.append(f"{len(paused_symbols)} paused")
            summary = ", ".join(parts)

            # ── Send digest email ─────────────────────────────────────────────
            try:
                send_mail(
                    subject=(
                        f"📰 AlphaScope Morning Brief — "
                        f"{timezone.now().strftime('%B %d, %Y')}"
                    ),
                    message=f"""
Dear {user.username},

Good morning! Here is your personalised stock news digest.
Tracking: {summary}.

{"".join(news_sections)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 QUICK ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

View Full News  : {BASE_URL}/news
Your Watchlist  : {BASE_URL}/watchlist
Your Portfolio  : {BASE_URL}/portfolio
Manage Alerts   : {BASE_URL}/alerts

{get_email_footer()}
                    """,
                    from_email="AlphaScope <alphascope.team@gmail.com>",
                    recipient_list=[user.email],
                    fail_silently=False,
                )
                logger.info(
                    f"[NEWS SENT] {user.email} — "
                    f"{len(news_sections)} symbols — {summary}"
                )

            except Exception as e:
                logger.error(f"[EMAIL ERROR] digest → {user.email}: {e}")

        except Exception as e:
            logger.error(f"[NEWS AGENT ERROR] user={user.email}: {e}")
            continue

    logger.info("[NEWS AGENT] Digest run complete.")