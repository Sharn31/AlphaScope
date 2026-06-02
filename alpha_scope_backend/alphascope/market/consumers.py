import json
import asyncio
import yfinance as yf
from channels.generic.websocket import AsyncWebsocketConsumer


class PriceConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        # Parse ?symbols=AAPL,TSLA from URL
        query_string = self.scope["query_string"].decode()
        params = dict(
            p.split("=") for p in query_string.split("&") if "=" in p
        )
        symbols_raw  = params.get("symbols", "")
        self.symbols = [
            s.strip().upper()
            for s in symbols_raw.split(",")
            if s.strip()
        ]

        if not self.symbols:
            await self.close()
            return

        await self.accept()
        self.running = True

        # ✅ Use create_task instead of ensure_future (no warning)
        self._task = asyncio.get_event_loop().create_task(self.push_prices())

    async def disconnect(self, close_code):
        self.running = False
        # ✅ Cancel the background task cleanly when client disconnects
        if hasattr(self, "_task"):
            self._task.cancel()

    async def push_prices(self):
        """Fetch and push live prices every 15 seconds."""
        while self.running:
            try:
                for symbol in self.symbols:
                    ticker = yf.Ticker(symbol)
                    price  = ticker.fast_info.last_price

                    if price is not None:
                        await self.send(text_data=json.dumps({
                            "symbol": symbol,
                            "price":  round(float(price), 4),
                        }))
            except Exception:
                pass  # Don't crash loop on bad ticker

            await asyncio.sleep(15)  # push every 15 seconds

    async def receive(self, text_data=None, bytes_data=None):
        """
        Client can send { "symbols": ["AAPL", "TSLA"] }
        to update subscriptions without reconnecting.
        """
        if text_data:
            try:
                data = json.loads(text_data)
                if "symbols" in data:
                    self.symbols = [
                        s.strip().upper()
                        for s in data["symbols"]
                        if s.strip()
                    ]
            except Exception:
                pass