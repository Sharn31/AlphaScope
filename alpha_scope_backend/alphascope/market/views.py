from django.shortcuts import render
import requests
import logging
from rest_framework.response import Response
from rest_framework.views import APIView
from .services.alphavantage_service import fetch_alphavantage_stock
from .services.yahoo_service import fetch_yahoo_stock
from .services.finhub_service import fetch_finhub_stock,fetch_news, fetch_finnhub_sentiment
from .services.aggregator_service import get_stock_data
from rest_framework.status import HTTP_500_INTERNAL_SERVER_ERROR,HTTP_201_CREATED,HTTP_400_BAD_REQUEST,HTTP_200_OK,HTTP_503_SERVICE_UNAVAILABLE,HTTP_404_NOT_FOUND
from django.http import JsonResponse
from .services.kb_service import search_knowledge_base
import json
from market.services.aggregator_service import get_stock_data
from market.services.ai_service import ask_chatbot
from rest_framework.permissions import IsAuthenticated
from .models import StockAlert,Portfolio,Watchlist,News,ChatMessage,PaperTrade,PaperHolding
from .serializers import WatchlistSerializer,PortfolioSerializer,StockAlertSerializer,NewsSerializer,PaperHoldingSerializer,PaperTradeSerializer
from.services.histrocial_data_service import get_chart_data
from django.db import transaction
from decimal import Decimal
from django.utils import timezone
from datetime import datetime
import pytz
from market.services.histrocial_data_service import get_cached_history
from market.indicators.indicators import calculate_indicators
from market.ai.ai_agent import get_ai_recommendation
import yfinance as yf
from rest_framework import status
from datetime import date, datetime, timedelta
from django.conf import settings
from market.services.yahoo_service import search_stocks
from market.ai.strategy_signals import get_ml_signal, get_rl_signal, get_llm_signal
from django.core.cache import cache
from concurrent.futures import ThreadPoolExecutor, as_completed
# Create your views here.

class StockPriceView(APIView):
    def get(self,request,symbol):

        price, volume ,high,low= fetch_alphavantage_stock(symbol)

        return Response({
            "symbol": symbol,
            "price": price,
            "volume": volume,
            "high":high,
            "low":low
            
        })

class YahooStockAPI(APIView):
    def get(self, request, symbol):
        period    = request.GET.get("period", "1d")
        cache_key = f"yahoo_{symbol}_{period}"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached, status=HTTP_200_OK)

        price, high, low, volume = fetch_yahoo_stock(symbol, period)
        result = {
            "symbol": symbol, "period": period,
            "price": price, "high": high,
            "low": low, "volume": volume,
        }
        cache.set(cache_key, result, timeout=15)
        return Response(result, status=HTTP_200_OK)
    
class FinhubAPI(APIView):
    def get(self,request,symbol):
        price,high,low,volume=fetch_finhub_stock(symbol)
        return Response({
            "symbol":symbol,
            "price":price,
            "high":high,
            "low":low,
            "volume":volume
        })

class FinnhubNewsAPI(APIView):

    def get(self, request, symbol):

        news = fetch_news(symbol)

        return Response({
            "symbol": symbol,
            "news": news
        })       
class StocksAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        if not symbol:
            return Response({"error": "Symbol is required."}, status=HTTP_400_BAD_REQUEST)

        # ✅ Check cache first
        cache_key = f"stock_price_{symbol.upper()}"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached, status=HTTP_200_OK)

        try:
            data = get_stock_data(symbol.upper())
            if not data:
                return Response({"error": f"No data found for {symbol}"}, status=HTTP_404_NOT_FOUND)

            # ✅ Cache for 15 seconds
            cache.set(cache_key, data, timeout=15)
            return Response(data, status=HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=HTTP_500_INTERNAL_SERVER_ERROR)

"""
Add this class to your market/views.py
Also add to urls.py:  path("market/chat/widget/", ChatWidgetView.as_view()),
"""

class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message      = request.data.get("message", "").strip()
        page_context = request.data.get("page_context", "")
        pathname     = request.data.get("pathname", "")

        if not message:
            return Response({"error": "Message is required."}, status=HTTP_400_BAD_REQUEST)

        # ── Knowledge base — MUST filter by user to avoid cross-user leakage ──
        kb_answer = search_knowledge_base(message)
        if kb_answer:
            # Save against THIS user only
            ChatMessage.objects.create(
                user=request.user,
                message=message,
                reply=kb_answer,
            )
            return Response({"reply": kb_answer, "web_searched": False}, status=HTTP_200_OK)

        # ── Chat history — strictly filtered to this user only ────────────────
        history = (
            ChatMessage.objects
            .filter(user=request.user)          # ✅ always scope to current user
            .order_by("-created_at")[:4]
        )
        context = [f"U:{m.message} A:{m.reply}" for m in reversed(history)]

        # ── Username for personalised greeting ───────────────────────────────
        username = (
            request.user.get_full_name()        # use full name if set
            or request.user.username            # fallback to username
        )

        # ── Portfolio holdings ────────────────────────────────────────────────
        holdings = PaperHolding.objects.filter(user=request.user)
        portfolio = []
        for h in holdings:
            pnl_pct = (
                float((h.current_price - h.purchase_price) / h.purchase_price * 100)
                if h.purchase_price else 0
            )
            portfolio.append({
                "symbol":        h.symbol,
                "shares":        float(h.shares),
                "avg_cost":      float(h.purchase_price),
                "current_price": float(h.current_price),
                "pnl_pct":       round(pnl_pct, 2),
            })

        # ── Watchlist symbols ─────────────────────────────────────────────────
        watchlist_symbols = list(
            Watchlist.objects.filter(user=request.user)
            .values_list("symbol", flat=True)
        )

        # ── Live prices for holdings + watchlist ──────────────────────────────
        all_symbols = list({h.symbol for h in holdings} | set(watchlist_symbols))
        market_data = []
        for sym in all_symbols:
            try:
                cache_key = f"stock_price_{sym}"
                data = cache.get(cache_key) or get_stock_data(sym)
                if data and data.get("price"):
                    market_data.append({
                        "symbol":     sym,
                        "price":      data["price"],
                        "high":       data.get("high"),
                        "low":        data.get("low"),
                        "change_pct": data.get("change_pct"),
                    })
            except Exception:
                pass

        # ── Resolve any ticker symbol mentioned in the message ────────────────
        # Import here to avoid circular imports if needed
        import re
        from market.services.ai_service import KNOWN_TICKERS, COMPANY_TO_TICKER

        # First try natural language company names (e.g. "apple" → "AAPL")
        msg_lower = message.lower()
        for company, ticker in COMPANY_TO_TICKER.items():
            if company in msg_lower:
                if not any(m["symbol"] == ticker for m in market_data):
                    try:
                        data = get_stock_data(ticker)
                        if data and data.get("price"):
                            market_data.append({
                                "symbol":     ticker,
                                "price":      data["price"],
                                "high":       data.get("high"),
                                "low":        data.get("low"),
                                "change_pct": data.get("change_pct"),
                            })
                    except Exception:
                        pass

        # Then try explicit uppercase symbols — ONLY if in KNOWN_TICKERS
        # This prevents "TODAY", "APPLE", "SELL" etc. being passed to yfinance
        mentioned = re.findall(r'\b([A-Z]{2,5})\b', message.upper())
        for sym in mentioned:
            if sym in KNOWN_TICKERS and not any(m["symbol"] == sym for m in market_data):
                try:
                    data = get_stock_data(sym)
                    if data and data.get("price"):
                        market_data.append({
                            "symbol":     sym,
                            "price":      data["price"],
                            "high":       data.get("high"),
                            "low":        data.get("low"),
                            "change_pct": data.get("change_pct"),
                        })
                except Exception:
                    pass

        # ── Call AI service ───────────────────────────────────────────────────
        result = ask_chatbot(
            user_id=request.user.id,
            username=username,              # ✅ pass username for greeting
            user_message=message,
            context=context,
            portfolio=portfolio,
            market_data=market_data,
            watchlist=watchlist_symbols,
            page_context=page_context,
            pathname=pathname,
        )

        if isinstance(result, tuple):
            reply, web_searched = result
        else:
            reply, web_searched = result, False

        if not reply:
            return Response(
                {"error": "AI could not generate a response."},
                status=HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ── Save reply against THIS user only ─────────────────────────────────
        ChatMessage.objects.create(
            user=request.user,
            message=message,
            reply=reply,
        )
        return Response({"reply": reply, "web_searched": web_searched}, status=HTTP_200_OK)
class StockAlertAPI(APIView):
    permission_classes=[IsAuthenticated]
    def get(self,request):
        alerts=StockAlert.objects.filter(user=request.user)
        serializer=StockAlertSerializer(alerts,many=True)
        return Response(serializer.data)
    
    def post(self,request):
        serializer=StockAlertSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data,status=HTTP_201_CREATED)
class AlertDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            alert = StockAlert.objects.get(id=pk, user=request.user)
            alert.is_active = not alert.is_active
            alert.save(update_fields=["is_active"])
            return Response({
                "id":        alert.id,
                "symbol":    alert.symbol,
                "is_active": alert.is_active,
                "message":   f"Alert {'activated' if alert.is_active else 'deactivated'}."
            }, status=status.HTTP_200_OK)
        except StockAlert.DoesNotExist:
            return Response({"error": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        try:
            alert = StockAlert.objects.get(id=pk, user=request.user)
            alert.delete()
            return Response({"message": "Alert deleted."}, status=status.HTTP_200_OK)
        except StockAlert.DoesNotExist:
            return Response({"error": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)

#News View
class NewsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        holding_symbols = PaperHolding.objects.filter(
            user=user
        ).values_list("symbol", flat=True)

        watchlist_symbols = Watchlist.objects.filter(
            user=user
        ).values_list("symbol", flat=True)

        all_symbols = set(list(holding_symbols) + list(watchlist_symbols))

        if not all_symbols:
            return Response({
                "user":   user.email,
                "stocks": [],
                "news":   []
            }, status=HTTP_200_OK)

        news = News.objects.filter(
            symbol__in=all_symbols
        ).order_by("-created_at")

        # symbol filter
        symbol = request.query_params.get("symbol")
        if symbol:
            news = news.filter(symbol=symbol.upper())

        serializer = NewsSerializer(news, many=True)

        return Response({
            "user":   user.email,
            "stocks": list(all_symbols),
            "news":   serializer.data
        }, status=HTTP_200_OK)

class MarketNewsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user   = request.user
        symbol = request.query_params.get("symbol")

        # ✅ Cache per user
        cache_key = f"market_news_{user.id}"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)

        watchlist_stocks = list(Watchlist.objects.filter(user=user).values_list("symbol", flat=True))
        portfolio_stocks = list(Portfolio.objects.filter(user=user).values_list("symbol", flat=True))
        stocks  = list(set(watchlist_stocks + portfolio_stocks))
        target  = [symbol] if symbol else stocks

        if not target:
            return Response({"user": user.username, "stocks": [], "news": []})

        # ✅ Fetch all symbols in parallel
        all_news = []

        def fetch_news_for(s):
            try:
                url    = "https://finnhub.io/api/v1/company-news"
                params = {
                    "symbol": s,
                    "from":   (date.today() - timedelta(days=7)).isoformat(),
                    "to":     date.today().isoformat(),
                    "token":  settings.FINNHUB_API_KEY,
                }
                res      = requests.get(url, params=params, timeout=5)
                articles = res.json()[:5]
                return [{
                    "id":           a.get("id"),
                    "symbol":       s,
                    "headline":     a.get("headline"),
                    "url":          a.get("url"),
                    "published_at": datetime.utcfromtimestamp(a.get("datetime", 0)).isoformat(),
                } for a in articles]
            except Exception:
                return []

        with ThreadPoolExecutor(max_workers=min(len(target), 5)) as executor:
            futures = {executor.submit(fetch_news_for, s): s for s in target}
            for future in as_completed(futures, timeout=15):
                try:
                    all_news.extend(future.result())
                except Exception:
                    pass

        result = {"user": user.username, "stocks": stocks, "news": all_news}
        cache.set(cache_key, result, timeout=600)  # 10 minutes
        return Response(result)

#Watchlist 
class WatchlistView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self,request):
        watchlist=Watchlist.objects.filter(user=request.user)
        serializer=WatchlistSerializer(watchlist,many=True)
        return Response(serializer.data)
    
    def post(self,request):
        serializer=WatchlistSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data,status=HTTP_201_CREATED)
class WatchlistDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            holding = Watchlist.objects.get(id=pk, user=request.user)
            holding.delete()
            return Response({"message": "Deleted"}, status=HTTP_200_OK)
        except Watchlist.DoesNotExist:
            return Response({"error": "Not found"}, status=HTTP_404_NOT_FOUND)

class PortfolioView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self,request):
        portfolio=Portfolio.objects.filter(user=request.user)
        serializer=PortfolioSerializer(portfolio,many=True)
        return Response(serializer.data)
    
    def post(self,request):
        serializer=PortfolioSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data,status=HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=HTTP_400_BAD_REQUEST)
        
class PortfolioDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            holding = Portfolio.objects.get(id=pk, user=request.user)
            holding.delete()
            return Response({"message": "Deleted"}, status=HTTP_200_OK)
        except Portfolio.DoesNotExist:
            return Response({"error": "Not found"}, status=HTTP_404_NOT_FOUND)
        
        
class ChartAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        interval = request.query_params.get("interval", "1M")
        if interval not in ["1D", "1W", "1M", "3M", "1Y"]:
            return Response({"error": "Invalid interval"}, status=HTTP_400_BAD_REQUEST)

        sym       = symbol.upper()
        cache_key = f"chart_{sym}_{interval}"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached, status=HTTP_200_OK)

        data = get_chart_data(sym, interval)
        if not data["data"]:
            return Response({"error": f"No chart data for {symbol}"}, status=HTTP_404_NOT_FOUND)

        cache.set(cache_key, data, timeout=300)  # 5 minutes
        return Response(data, status=HTTP_200_OK)

class PlaceTradeView(APIView):
    permission_classes=[IsAuthenticated]
    @transaction.atomic
    def post(self,request):
        serializer=PaperTradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
            
        symbol=serializer.validated_data["symbol"].upper()
        trade_type=serializer.validated_data["trade_type"]
        shares=serializer.validated_data["shares"]

        stock_data=get_stock_data(symbol)
        if not stock_data or not stock_data.get("price"):
            return Response(
                {"error": f"Could not fetch price for {symbol}."},
                status=HTTP_400_BAD_REQUEST
            )
        price = Decimal(str(stock_data["price"]))
        total=price*shares
        user=request.user

        if trade_type==PaperTrade.BUY:
            if user.paper_balance<total:
                return Response(
                    {
                        "error": "Insufficient paper balance.",
                        "required":  float(total),
                        "available": float(user.paper_balance)
                    },
                    status=HTTP_400_BAD_REQUEST
                )
            
            user.paper_balance-=total
            user.save(update_fields=["paper_balance"])

            #update values
            holding,created=PaperHolding.objects.get_or_create(
                user=user,
                symbol=symbol,
                defaults={"shares":0,
                          "purchase_price": price,
                        "current_price": price}
            )
            if not created:
                # weighted average purchase price
                total_shares=holding.shares + shares
                holding.purchase_price = (
                    (holding.purchase_price * holding.shares) +
                    (price * shares)
                ) / total_shares
                holding.shares = total_shares
            else:
                holding.shares = shares

            holding.current_price = price
            holding.save()

        else:    #Sell
            try:
                holding = PaperHolding.objects.get(user=user, symbol=symbol)
            except PaperHolding.DoesNotExist:
                return Response(
                    {"error": f"You don't hold any shares of {symbol}."},
                    status=HTTP_400_BAD_REQUEST
                )

            if holding.shares < shares:
                return Response(
                    {
                        "error": "Insufficient shares.",
                        "available": float(holding.shares),
                        "requested": float(shares)
                    },
                    status=HTTP_400_BAD_REQUEST
                )
            # update holding
            holding.shares -= shares
            holding.current_price = price
            if holding.shares == 0:
                holding.delete()
            else:
                holding.save()

            # refund balance
            user.paper_balance += total
            user.save(update_fields=["paper_balance"])

        # save trade record
        trade = PaperTrade.objects.create(
            user=user, symbol=symbol,
            trade_type=trade_type,
            shares=shares, price=price, total=total
        )

        return Response({
            "message":       f"{trade_type} order placed successfully.",
            "symbol":        symbol,
            "shares":        float(shares),
            "price":         float(price),
            "total":         float(total),
            "paper_balance": float(user.paper_balance),
        }, status=HTTP_201_CREATED)
    

class TradeHistoryView(APIView):
    permission_classes   = [IsAuthenticated]
    def get(self, request):
        qs = PaperTrade.objects.filter(user=request.user)
        
        # filter by symbol if provided
        symbol = request.query_params.get("symbol")
        if symbol:
            qs = qs.filter(symbol=symbol.upper())

        serializer = PaperTradeSerializer(qs, many=True)
        return Response(serializer.data, status=HTTP_200_OK)

class HoldingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        holdings = PaperHolding.objects.filter(user=request.user)
        serializer = PaperHoldingSerializer(holdings, many=True)
        return Response(serializer.data, status=HTTP_200_OK)

    def post(self, request):
        symbol    = request.data.get("symbol", "").upper()
        quantity  = request.data.get("quantity")
        buy_price = request.data.get("buy_price")

        if not all([symbol, quantity, buy_price]):
            return Response(
                {"error": "symbol, quantity and buy_price are required."},
                status=HTTP_400_BAD_REQUEST
            )

        # Fetch live price to set current_price
        try:
            stock_data    = get_stock_data(symbol)
            current_price = Decimal(str(stock_data["price"])) if stock_data else Decimal(str(buy_price))
        except Exception:
            current_price = Decimal(str(buy_price))

        holding, created = PaperHolding.objects.get_or_create(
            user=request.user,
            symbol=symbol,
            defaults={
                "shares":         Decimal(str(quantity)),
                "purchase_price": Decimal(str(buy_price)),
                "current_price":  current_price,
            }
        )

        if not created:
            # weighted average if already exists
            total_shares = holding.shares + Decimal(str(quantity))
            holding.purchase_price = (
                (holding.purchase_price * holding.shares) +
                (Decimal(str(buy_price)) * Decimal(str(quantity)))
            ) / total_shares
            holding.shares = total_shares
            holding.current_price = current_price
            holding.save()

        serializer = PaperHoldingSerializer(holding)
        return Response(serializer.data, status=HTTP_201_CREATED)


class HoldingsDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            holding = PaperHolding.objects.get(id=pk, user=request.user)
            holding.delete()
            return Response({"message": "Deleted"}, status=HTTP_200_OK)
        except PaperHolding.DoesNotExist:
            return Response({"error": "Not found"}, status=HTTP_404_NOT_FOUND)
    
       
class TradeSummaryView(APIView):
    
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user     = request.user
        trades   = PaperTrade.objects.filter(user=user)
        holdings = PaperHolding.objects.filter(user=user)

        total_bought = sum(
            float(t.total) for t in trades if t.trade_type == "BUY"
        )
        total_sold = sum(
            float(t.total) for t in trades if t.trade_type == "SELL"
        )

        holdings_value = sum(
            float(h.current_price * h.shares) for h in holdings
        )
        total_pnl = sum(
            float((h.current_price - h.purchase_price) * h.shares)
            for h in holdings
        )

        return Response({
            "paper_balance":   float(user.paper_balance),
            "holdings_value":  round(holdings_value, 2),
            "total_value":     round(float(user.paper_balance) + holdings_value, 2),
            "total_pnl":       round(total_pnl, 2),
            "total_bought":    round(total_bought, 2),
            "total_sold":      round(total_sold, 2),
            "total_trades":    trades.count(),
            "buy_trades":      trades.filter(trade_type="BUY").count(),
            "sell_trades":     trades.filter(trade_type="SELL").count(),
        }, status=HTTP_200_OK)


class ResetPaperBalanceView(APIView):
    
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.paper_balance = Decimal("100000.00")
        user.save(update_fields=["paper_balance"])
        PaperHolding.objects.filter(user=user).delete()
        PaperTrade.objects.filter(user=user).delete()

        return Response({
            "message":       "Paper trading reset to $100,000.",
            "paper_balance": 100000.00
        }, status=HTTP_200_OK)



        

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user     = request.user

        # ── 1. DB queries — fast with no changes ─────────────────────────
        holdings      = list(PaperHolding.objects.filter(user=user))
        recent_trades = list(
            PaperTrade.objects.filter(user=user)
            .order_by("-executed_at")[:5]
        )
        active_alerts   = StockAlert.objects.filter(user=user, is_active=True).count()
        triggered_today = StockAlert.objects.filter(
            user=user,
            last_triggered_at__date=timezone.now().date()
        ).count()

        if not holdings:
            return Response({
                "portfolio_value":    0,
                "total_gain":         0,
                "total_gain_percent": 0,
                "paper_balance":      float(user.paper_balance),
                "active_alerts":      active_alerts,
                "triggered_today":    triggered_today,
                "top_holdings":       [],
                "recent_trades":      [],
            }, status=HTTP_200_OK)

        # ── 2. Fetch all prices in parallel ───────────────────────────────
        symbols = list({h.symbol for h in holdings})

        def fetch_price(symbol):
            # Check cache first — if WebSocket already updated it, instant
            cache_key = f"stock_price_{symbol}"
            cached    = cache.get(cache_key)
            if cached:
                return symbol, cached.get("price")

            # Cache miss — fetch from yfinance
            try:
                data  = get_stock_data(symbol)
                price = data.get("price") if data else None
                if price:
                    cache.set(cache_key, data, timeout=15)
                return symbol, price
            except Exception:
                return symbol, None

        # All symbols fetched simultaneously
        prices = {}
        with ThreadPoolExecutor(max_workers=min(len(symbols), 8)) as executor:
            futures = {executor.submit(fetch_price, s): s for s in symbols}
            for future in as_completed(futures, timeout=8):
                try:
                    sym, price = future.result()
                    if price:
                        prices[sym] = price
                except Exception:
                    pass

        # ── 3. Bulk update DB — one query instead of N saves ──────────────
        # Only update if price actually changed
        to_update = []
        for h in holdings:
            new_price = prices.get(h.symbol)
            if new_price and abs(float(h.current_price) - float(new_price)) > 0.001:
                h.current_price = Decimal(str(new_price))
                to_update.append(h)

        if to_update:
            PaperHolding.objects.bulk_update(to_update, ["current_price"])

        # ── 4. Calculate totals ───────────────────────────────────────────
        total_value = sum(float(h.current_price * h.shares) for h in holdings)
        total_cost  = sum(float(h.purchase_price * h.shares) for h in holdings)
        total_gain  = total_value - total_cost
        total_gain_percent = ((total_gain / total_cost) * 100) if total_cost else 0

        sorted_holdings = sorted(
            holdings,
            key=lambda h: float(h.current_price * h.shares),
            reverse=True
        )[:5]

        top_holdings = [{
            "symbol":         h.symbol,
            "shares":         float(h.shares),
            "current_price":  float(h.current_price),
            "purchase_price": float(h.purchase_price),
            "pnl":            round(float((h.current_price - h.purchase_price) * h.shares), 2),
        } for h in sorted_holdings]

        trades_data = [{
            "symbol":      t.symbol,
            "trade_type":  t.trade_type,
            "shares":      float(t.shares),
            "price":       float(t.price),
            "total":       float(t.total),
            "executed_at": t.executed_at.strftime("%Y-%m-%d %H:%M"),
        } for t in recent_trades]

        return Response({
            "portfolio_value":    round(total_value, 2),
            "total_gain":         round(total_gain, 2),
            "total_gain_percent": round(total_gain_percent, 2),
            "paper_balance":      float(user.paper_balance),
            "active_alerts":      active_alerts,
            "triggered_today":    triggered_today,
            "top_holdings":       top_holdings,
            "recent_trades":      trades_data,
        }, status=HTTP_200_OK)


class MarketStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # ✅ Cache for 30 seconds — status doesn't change every millisecond
        cache_key = "market_status"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached, status=HTTP_200_OK)

        ist_tz   = pytz.timezone("Asia/Kolkata")
        now_ist  = datetime.now(ist_tz)
        is_weekday      = now_ist.weekday() < 5
        market_open     = now_ist.replace(hour=9,  minute=15, second=0, microsecond=0)
        market_close    = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
        pre_market_start= now_ist.replace(hour=9,  minute=0,  second=0, microsecond=0)

        is_open       = is_weekday and market_open <= now_ist <= market_close
        is_pre_market = is_weekday and pre_market_start <= now_ist < market_open

        market_status = "Open" if is_open else "Pre-Market" if is_pre_market else "Closed"

        result = {
            "status":        market_status,
            "is_open":       is_open,
            "is_pre_market": is_pre_market,
            "current_time":  now_ist.strftime("%Y-%m-%d %H:%M %Z"),
            "opens_at":      "9:15 AM IST",
            "closes_at":     "3:30 PM IST",
            "timezone":      "Asia/Kolkata",
            "day":           now_ist.strftime("%A"),
            "exchange":      "NSE/BSE",
        }

        cache.set(cache_key, result, timeout=30)  # 30 seconds
        return Response(result, status=HTTP_200_OK)

class IndicatorsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        sym = symbol.upper()

        # ✅ Cache indicators result
        cache_key = f"indicators_{sym}"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached, status=HTTP_200_OK)

        df = get_cached_history(sym)
        if df is None:
            return Response(
                {"error": f"Could not fetch data for {symbol}"},
                status=HTTP_404_NOT_FOUND
            )

        indicators = calculate_indicators(df)
        if indicators["status"] == "no_data":
            return Response(
                {"error": "Insufficient data to calculate indicators"},
                status=HTTP_404_NOT_FOUND
            )

        result = {
            "symbol":      sym,
            "rsi":         indicators["rsi"],
            "rsi_signal":  indicators["rsi_signal"],
            "macd":        indicators["macd"],
            "macd_signal": indicators["macd_signal"],
            "ma20":        indicators["ma20"],
            "ma20_signal": indicators["ma20_signal"],
            "ma50":        indicators["ma50"],
            "ma50_signal": indicators["ma50_signal"],
        }

        cache.set(cache_key, result, timeout=300)  # 5 minutes
        return Response(result, status=HTTP_200_OK)

        
def process_symbol(symbol):
    sym_cache_key = f"ai_sym_{symbol}"
    cached = cache.get(sym_cache_key)
    if cached:
        return cached

    # ✅ Check price cache first
    stock_data = cache.get(f"stock_price_{symbol}")
    if not stock_data:
        stock_data = get_stock_data(symbol)
        if stock_data:
            cache.set(f"stock_price_{symbol}", stock_data, timeout=15)

    current_price = stock_data.get("price") if stock_data else None
    if not current_price:
        return None

    df = get_cached_history(symbol)
    if df is None:
        return None

    indicators = calculate_indicators(df)
    if indicators.get("status") != "ok":
        return None

    ai_decision = get_ai_recommendation(symbol, current_price, indicators)

    def get_ml():
        k = f"ml_{symbol}"
        c = cache.get(k)
        if c:
            print(f"[ML CACHE HIT] {symbol}")
            return c
        print(f"[ML CACHE MISS] {symbol}")   # ← add this
        r = get_ml_signal(symbol)
        cache.set(k, r, timeout=1800)
        return r

    def get_rl():
        k = f"rl_{symbol}"
        c = cache.get(k)
        if c: return c
        r = get_rl_signal(symbol)
        cache.set(k, r, timeout=1800)
        return r

    def get_llm():
        k = f"llm_{symbol}"
        c = cache.get(k)
        if c: return c
        r = get_llm_signal(symbol, indicators)
        cache.set(k, r, timeout=1800)
        return r

    # ML, RL, LLM run simultaneously
    with ThreadPoolExecutor(max_workers=3) as ex:
        f_ml  = ex.submit(get_ml)
        f_rl  = ex.submit(get_rl)
        f_llm = ex.submit(get_llm)
        ml    = f_ml.result()
        rl    = f_rl.result()
        llm   = f_llm.result()

    def is_valid(signal):
        return (
            signal.get("status") == "ok" and
            signal.get("reasoning") not in [
                "Insufficient data", "Insufficient return history", "Not enough clean rows",
            ] and not signal.get("reasoning", "").startswith("Error")
        )

    valid_signals      = [s for s in [ml, rl, llm] if is_valid(s)]
    overall_confidence = (
        round(sum(s["confidence"] for s in valid_signals) / len(valid_signals), 3)
        if valid_signals else 0.5
    )
    confidence_label = (
        "High"   if overall_confidence >= 0.80 else
        "Medium" if overall_confidence >= 0.60 else
        "Low"
    )

    votes = {"BUY": 0.0, "SELL": 0.0, "HOLD": 0.0}
    for s in [ml, rl, llm]:
        if is_valid(s): votes[s["action"]] += s["confidence"]
        else:           votes["HOLD"]      += 0.3

    result = {
        "symbol":             symbol,
        "price":              current_price,
        "rsi":                indicators["rsi"],
        "rsi_signal":         indicators["rsi_signal"],
        "macd_signal":        indicators["macd_signal"],
        "ma50_signal":        indicators["ma50_signal"],
        "recommendation":     ai_decision,
        "ml":  {"action": ml["action"],  "confidence": ml["confidence"],  "reasoning": ml["reasoning"],  "status": ml.get("status",  "error")},
        "rl":  {"action": rl["action"],  "confidence": rl["confidence"],  "reasoning": rl["reasoning"],  "status": rl.get("status",  "error")},
        "llm": {"action": llm["action"], "confidence": llm["confidence"], "reasoning": llm["reasoning"], "status": llm.get("status", "error")},
        "consensus":          max(votes, key=votes.get),
        "overall_confidence": overall_confidence,
        "confidence_label":   confidence_label,
        "vote_breakdown":     {k: round(v, 3) for k, v in votes.items()},
    }

    cache.set(sym_cache_key, result, timeout=1800)
    return result

logger = logging.getLogger(__name__)
MAX_SYMBOLS = getattr(settings, "AI_RECOMMEND_MAX_SYMBOLS", 5)



class AIRecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user      = request.user
        cache_key = f"ai_recommendations_{user.id}"

        cached = cache.get(cache_key)
        if cached:
            logger.info(f"[CACHE HIT] AI recommendations for user {user.id}")
            return Response(cached, status=HTTP_200_OK)

        holding_symbols   = list(PaperHolding.objects.filter(user=user).values_list("symbol", flat=True))
        watchlist_symbols = list(Watchlist.objects.filter(user=user).values_list("symbol", flat=True))
        all_symbols       = list(set(holding_symbols + watchlist_symbols))[:MAX_SYMBOLS]

        if not all_symbols:
            return Response({"error": "Add stocks to watchlist or portfolio first."}, status=HTTP_400_BAD_REQUEST)

        # ✅ Process ALL symbols in parallel
        recommendations = []
        with ThreadPoolExecutor(max_workers=min(len(all_symbols), 5)) as executor:
            futures = {executor.submit(process_symbol, s): s for s in all_symbols}
            for future in as_completed(futures, timeout=30):
                try:
                    result = future.result()
                    if result:
                        recommendations.append(result)
                except Exception as e:
                    logger.error(f"[AI RECOMMEND] {futures[future]}: {e}")

        if not recommendations:
            return Response({"error": "Could not generate recommendations."}, status=HTTP_503_SERVICE_UNAVAILABLE)

        cache.set(cache_key, recommendations, timeout=60 * 30)
        logger.info(f"[CACHE SET] AI recommendations for user {user.id}")
        return Response(recommendations, status=HTTP_200_OK)
   

class StockSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()

        if not query:
            return Response(
                {"error": "Search query is required."},
                status=HTTP_400_BAD_REQUEST
            )

        # ↓ no yf call here — service handles it
        data = search_stocks(query)
        return Response(data, status=HTTP_200_OK)

class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = ChatMessage.objects.filter(
            user=request.user
        ).order_by("created_at")[:50]

        data = [{
            "id":         str(msg.id),
            "message":    msg.message,
            "reply":      msg.reply,
            "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M"),
        } for msg in history]

        return Response(data, status=HTTP_200_OK)


class ClearChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        ChatMessage.objects.filter(user=request.user).delete()
        return Response(
            {"message": "Chat history cleared."},
            status=HTTP_200_OK
        )





class NewsSentimentAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # ✅ Cache entire response per user
        cache_key = f"news_sentiment_{user.id}"
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)

        watchlist_symbols = list(Watchlist.objects.filter(user=user).values_list("symbol", flat=True))
        portfolio_symbols = list(Portfolio.objects.filter(user=user).values_list("symbol", flat=True))
        symbols           = list(set(watchlist_symbols + portfolio_symbols))

        if not symbols:
            return Response({"sentiments": []})

        # ✅ Fetch all sentiments in parallel
        sentiments = []
        def fetch_one(s):
            return fetch_finnhub_sentiment(s)

        with ThreadPoolExecutor(max_workers=min(len(symbols), 5)) as executor:
            futures = {executor.submit(fetch_one, s): s for s in symbols}
            for future in as_completed(futures, timeout=15):
                try:
                    data = future.result()
                    if data:
                        sentiments.append(data)
                except Exception:
                    pass

        result = {"sentiments": sentiments}
        cache.set(cache_key, result, timeout=600)  # 10 minutes
        return Response(result)




class NewsDigestToggleView(APIView):
    """
    POST /market/news/digest/toggle/
    Toggle the user's daily email news digest on/off.
    """
    permission_classes = [IsAuthenticated]
 
    def post(self, request):
        from market.models import NewsAlertPreference
 
        prefs, _ = NewsAlertPreference.objects.get_or_create(user=request.user)
        prefs.email_digest = not prefs.email_digest
        prefs.save(update_fields=["email_digest"])
 
        return Response({
            "enabled": prefs.email_digest,
            "message": (
                "Daily email digest enabled! You'll receive news every morning."
                if prefs.email_digest
                else "Email digest disabled."
            )
        })



class NewsSendDigestView(APIView):
    """
    POST /market/news/send-digest/
    Manually trigger news digest email for this user.
    Requires Celery to be running.
    """
    permission_classes = [IsAuthenticated]
 
    def post(self, request):
        try:
            from market.tasks import stock_news_agent
            # Apply async — Celery will pick it up
            stock_news_agent.apply_async()
            return Response({"message": "News digest sent! Check your email shortly."})
        except Exception as e:
            logger.error(f"[NEWS DIGEST] Failed to trigger: {e}")
            return Response(
                {"error": "Could not trigger digest. Make sure Celery is running."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
 
 
# ── News Symbol Alerts List ───────────────────────────────────────────────────
class NewsAlertListView(APIView):
    """
    GET  /market/news/alerts/     — list user's news alerts
    POST /market/news/alerts/     — create a news alert
    """
    permission_classes = [IsAuthenticated]
 
    def get(self, request):
        from market.models import NewsSymbolAlert
        alerts = NewsSymbolAlert.objects.filter(user=request.user).order_by("-created_at")
        return Response([
            {
                "id":         a.id,
                "symbol":     a.symbol,
                "keyword":    a.keyword,
                "is_active":  a.is_active,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ])
 
    def post(self, request):
        from market.models import NewsSymbolAlert
        symbol  = str(request.data.get("symbol", "")).upper().strip()
        keyword = str(request.data.get("keyword", "")).strip()
 
        if not symbol:
            return Response({"error": "Symbol is required."}, status=status.HTTP_400_BAD_REQUEST)
 
        alert, created = NewsSymbolAlert.objects.get_or_create(
            user    = request.user,
            symbol  = symbol,
            keyword = keyword,
            defaults={"is_active": True}
        )
 
        if not created:
            return Response(
                {"error": f"News alert for {symbol} already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        return Response({
            "id":         alert.id,
            "symbol":     alert.symbol,
            "keyword":    alert.keyword,
            "is_active":  alert.is_active,
            "created_at": alert.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)
 
# ── REPLACE your existing NewsAlertDetailView in views.py with this ──────────
# The PATCH now accepts an optional is_active in the request body.
# If provided → set explicitly. If not provided → toggle (old behaviour).

class NewsAlertDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        from market.models import NewsSymbolAlert
        try:
            alert = NewsSymbolAlert.objects.get(id=pk, user=request.user)

            # If body has explicit is_active → use it (for "pause" use case)
            # If not provided → toggle (old behaviour)
            if "is_active" in request.data:
                alert.is_active = bool(request.data["is_active"])
            else:
                alert.is_active = not alert.is_active

            alert.save(update_fields=["is_active"])
            return Response({
                "id":        alert.id,
                "symbol":    alert.symbol,
                "is_active": alert.is_active,
                "message":   f"Alert {'activated' if alert.is_active else 'paused'}."
            }, status=HTTP_200_OK)
        except NewsSymbolAlert.DoesNotExist:
            return Response({"error": "Not found"}, status=HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        from market.models import NewsSymbolAlert
        try:
            NewsSymbolAlert.objects.get(id=pk, user=request.user).delete()
            return Response({"message": "Deleted"}, status=HTTP_200_OK)
        except NewsSymbolAlert.DoesNotExist:
            return Response({"error": "Not found"}, status=HTTP_404_NOT_FOUND)