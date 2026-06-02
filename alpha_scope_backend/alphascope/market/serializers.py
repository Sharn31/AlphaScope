from rest_framework import serializers
from .models import Watchlist,Portfolio,StockAlert,News,ChatMessage,PaperHolding,PaperTrade

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model=ChatMessage
        fields = ["id", "message", "reply", "created_at"]
        read_only_fields = ["id", "reply", "created_at"]

class StockAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model=StockAlert
        fields='__all__'
        read_only_fields = ['user']

class WatchlistSerializer(serializers.ModelSerializer):
    class Meta:
        model=Watchlist
        fields='__all__'
        read_only_fields=['user']

class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model=Portfolio
        fields='__all__'
        read_only_fields=['user']

class NewsSerializer(serializers.ModelSerializer):
    class Meta:
        model=News
        fields=['id', 'symbol', 'headline', 'url', 'published_at']

class PaperTradeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PaperTrade
        fields = [
            "id", "symbol", "trade_type",
            "shares", "price", "total", "executed_at"
        ]
        read_only_fields = ["id", "price", "total", "executed_at"]

    def validate_shares(self, value):
        if value <= 0:
            raise serializers.ValidationError("Shares must be greater than 0.")
        return value

    def validate_symbol(self, value):
        return value.upper().strip()


class PaperHoldingSerializer(serializers.ModelSerializer):
    pnl         = serializers.SerializerMethodField()
    pnl_percent = serializers.SerializerMethodField()
    value       = serializers.SerializerMethodField()

    class Meta:
        model  = PaperHolding
        fields = [
            "id", "symbol", "shares",
            "purchase_price", "current_price",
            "pnl", "pnl_percent", "value", "update_at"
        ]
        read_only_fields = ["id", "update_at"]

    def get_pnl(self, obj) -> float:
        return round(float(
            (obj.current_price - obj.purchase_price) * obj.shares
        ), 2)

    def get_pnl_percent(self, obj) -> float:
        if obj.purchase_price == 0:
            return 0
        return round(float(
            (obj.current_price - obj.purchase_price) / obj.purchase_price * 100
        ), 2)

    def get_value(self, obj) -> float:
        return round(float(obj.current_price * obj.shares), 2)