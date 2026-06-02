from django.urls import path
from .views import ( StockPriceView,YahooStockAPI,FinhubAPI,FinnhubNewsAPI,StocksAPI,ChatView,StockAlertAPI,WatchlistView,
                    PortfolioView,ChartAPI,TradeHistoryView,TradeSummaryView,PlaceTradeView,HoldingsView,
                    ResetPaperBalanceView,DashboardView,MarketStatusView,IndicatorsView,AIRecommendationView,
                    StockSearchView,ClearChatHistoryView,ChatHistoryView,PortfolioDetailView,
                    WatchlistDetailView,AlertDetailView,MarketNewsAPI,NewsSentimentAPI,HoldingsDetailView,
                    NewsAlertDetailView,NewsDigestToggleView,NewsListView,NewsSendDigestView,NewsAlertListView
)

urlpatterns = [
    path("alphavantage_stock/<str:symbol>/", StockPriceView.as_view()),
    path("yahoo_stock/<str:symbol>/",YahooStockAPI.as_view()),
    path("finhub_stock/<str:symbol>/",FinhubAPI.as_view()),
    path("finhub_news/<str:symbol>/",FinnhubNewsAPI.as_view()),
    path("news/", MarketNewsAPI.as_view(), name="market-news"),
    path("stocks/<str:symbol>/", StocksAPI.as_view()),
    path("chat/", ChatView.as_view(), name="chat"),
    path("chat/history/", ChatHistoryView.as_view(),  name="chat-history"),
    path("chat/clear/",   ClearChatHistoryView.as_view(), name="chat-clear"),
    path("alert/", StockAlertAPI.as_view(), name="alert-list"),
    path("alert/<int:pk>/", AlertDetailView.as_view(), name="alert-detail"),
    path('watchlist/', WatchlistView.as_view(), name='watchlist'),
    path('watchlist/<int:pk>/', WatchlistDetailView.as_view(), name='portfolio-detail'),
    path('portfolio/', PortfolioView.as_view(), name='portfolio-list'),
    path('portfolio/<int:pk>/', PortfolioDetailView.as_view(), name='portfolio-detail'),
    path('chart/<str:symbol>/',ChartAPI.as_view(),name='chart'),
    path('holdings/',      HoldingsView.as_view()),
    path('holdings/<int:pk>/', HoldingsDetailView.as_view()),
    path("trades/",TradeHistoryView.as_view(),name="trades"),
    path("trades/place/",PlaceTradeView.as_view(),name="trade-place"),
    path("trades/holdings/",HoldingsView.as_view(),name="trade-holdings"),
    path("trades/summary/",TradeSummaryView.as_view(),name="trade-summary"),
    path("trades/reset/",ResetPaperBalanceView.as_view(),name="trade-reset"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path('status/',MarketStatusView.as_view(),name='market-status'),
    path("indicators/<str:symbol>/", IndicatorsView.as_view(), name="indicators"),
    path("ai/recommend/", AIRecommendationView.as_view(), name="ai-recommend"),
    path("search/", StockSearchView.as_view(), name="stock-search"),
    path("news/sentiment/", NewsSentimentAPI.as_view(), name="news-sentiment"),
    path("news/alerts/",          NewsAlertListView.as_view()),
    path("news/alerts/<int:pk>/", NewsAlertDetailView.as_view()),
    path("news/digest/toggle/",   NewsDigestToggleView.as_view()),
    path("news/send-digest/",     NewsSendDigestView.as_view()),
    

    
]