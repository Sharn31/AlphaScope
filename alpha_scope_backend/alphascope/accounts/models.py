from django.db import models
from django.contrib.auth.models import User,AbstractUser

# Create your models here.
class User(AbstractUser):
    ROLE_CHOICES = (
        ('trader', 'Trader'),
        ('analyst', 'Analyst'),
        ('admin', 'Admin'),
    )
    
    
    role=models.CharField(max_length=30,choices=ROLE_CHOICES)
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    created_at=models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    paper_balance = models.DecimalField(
    max_digits=15, decimal_places=2, default=100000.00
)
    class Meta:
        indexes = [
            models.Index(fields=["email"]),       # login lookup
            models.Index(fields=["username"]),    # already indexed by Django but explicit
            models.Index(fields=["role"]),        # filter by role
        ]
    def __str__(self):
        return self.username


