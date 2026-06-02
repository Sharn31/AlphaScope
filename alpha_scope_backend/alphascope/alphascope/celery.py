import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'alphascope.settings')

app = Celery('alphascope')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Fix for Windows
import platform
if platform.system() == 'Windows':
    app.conf.worker_pool = 'solo'