from django.db import models
from django.conf import settings

# Create your models here.
class ChatMessage(models.Model):
    user= models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_messages")
    message=models.TextField()
    reply=models.TextField()
    created_at=models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "-created_at"]),  # latest first
        ]
        ordering = ["created_at"]

    
class StockAlert(models.Model): 
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    symbol=models.CharField(max_length=10)
    alert_type=models.CharField(
        max_length=10,
        choices=[('price','Price'),
                 ('percentage','Percatange')],
                 default='price'
                                )
    condition=models.CharField(
        max_length=10,
        choices=[
            ('above', 'Above'),
            ('below', 'Below')
        ]
    )
    target_price=models.FloatField(blank=True,null=True)
    percentage_change=models.FloatField(blank=True,null=True)
    is_active=models.BooleanField(default=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    cooldown_minutes = models.IntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes = [
            models.Index(fields=["user", "is_active"]),        # filter active alerts
            models.Index(fields=["user", "symbol"]),           # per-symbol alerts
            models.Index(fields=["symbol", "is_active"]),      # alert checker scans
            models.Index(fields=["user", "last_triggered_at"]),# triggered today query
        ]

    def __str__(self):
        return f"{self.user.username} - {self.symbol} ({self.condition})"
    
    
class Watchlist(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    symbol=models.CharField(max_length=10)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ("user", "symbol")
        indexes = [
            models.Index(fields=["user"]),           # filter by user
            models.Index(fields=["user", "symbol"]), # exists check
        ]

    def __str__(self):
        return f"{self.user.username} - {self.symbol}"
    
#Portfolio model :User inverstment track
class Portfolio(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    symbol=models.CharField(max_length=10)
    quantity=models.FloatField(null=True,blank=True)
    buy_price=models.FloatField(null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)


    class Meta:
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["user", "symbol"]),
        ]
    def __str__(self):
        return f"{self.user.username} - {self.symbol}"

class News(models.Model):
    
    symbol=models.CharField(max_length=10)
    headline = models.TextField()
    url = models.URLField()
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["symbol"]),
            models.Index(fields=["-published_at"]),  # latest news first
            models.Index(fields=["symbol", "-published_at"]),
        ]
class PaperTrade(models.Model):
    BUY  = "BUY"
    SELL = "SELL"
    TRADE_TYPES = [(BUY, "Buy"), (SELL, "Sell")]

    
    user=models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    symbol=models.CharField(max_length=10)
    trade_type=models.CharField(max_length=4,choices=TRADE_TYPES)
    shares=models.DecimalField(max_digits=15, decimal_places=4)
    price=models.DecimalField(max_digits=15, decimal_places=2)
    total=models.DecimalField(max_digits=15, decimal_places=2)
    executed_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = "paper_trades"
        ordering = ["-executed_at"]
        indexes = [
            models.Index(fields=["user", "-executed_at"]),  # trade history
            models.Index(fields=["user", "symbol"]),        # per-symbol trades
            models.Index(fields=["user", "trade_type"]),    # buy/sell count
        ]

    def __str__(self):
        return f"{self.user} {self.trade_type} {self.shares} {self.symbol} @ {self.price}"
    
class PaperHolding(models.Model):
    user=models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    symbol=models.CharField(max_length=10)
    shares=models.DecimalField(max_digits=15, decimal_places=4)
    purchase_price=models.DecimalField(max_digits=15, decimal_places=2)
    current_price=models.DecimalField(max_digits=15, decimal_places=2,default=0)
    update_at=models.DateTimeField(auto_now_add=True)
    

    class Meta:
        db_table      = "paper_holdings"
        unique_together = ("user", "symbol")
        indexes = [
            models.Index(fields=["user"]),           # all holdings for user
            models.Index(fields=["user", "symbol"]), # specific holding lookup
        ]

    def __str__(self):
        return f"{self.user} — {self.symbol} x{self.shares}"



#news
class NewsAlertPreference(models.Model):
    """
    One row per user.
    Stores whether the user has daily email digest enabled.
    """
    user         = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="news_prefs",
    )
    email_digest = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
 
    def __str__(self):
        return f"{self.user.username} — digest={self.email_digest}"
 
 
class NewsSymbolAlert(models.Model):
    """
    Per-symbol news alert.
    User gets email when news is published for this stock.
    Optional keyword filter — e.g. only fire when 'earnings' in headline.
    """
    user       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="news_alerts",
    )
    symbol     = models.CharField(max_length=10)
    keyword    = models.CharField(max_length=100, blank=True, default="")
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        unique_together = ["user", "symbol", "keyword"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["user", "symbol"]),
        ]
 
    def __str__(self):
        return f"{self.user.username} — {self.symbol} ({self.keyword})"
 























































