import time

class LatencyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start    = time.perf_counter()
        response = self.get_response(request)
        ms       = round((time.perf_counter() - start) * 1000, 1)

        if ms < 100:
            tag = "⚡"
        elif ms < 500:
            tag = "✅"
        elif ms < 1000:
            tag = "🟡"
        else:
            tag = "🔴"

        print(f"{tag} {ms}ms — {request.method} {request.path}")
        return response
