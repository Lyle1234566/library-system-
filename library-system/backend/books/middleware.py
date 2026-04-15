from .automation import run_daily_borrow_automation_if_needed


class DailyBorrowAutomationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith('/static/') and not request.path.startswith('/media/'):
            run_daily_borrow_automation_if_needed()
        return self.get_response(request)
