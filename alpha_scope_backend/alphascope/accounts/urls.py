from django.contrib import admin
from django.urls import path,include
from .views import SignupView, LoginView,ProfileView,LogoutView,ChangePasswordView,PasswordResetConfirmView,PasswordResetRequestView,UpdateEmailView,DeleteAccountView,ChangePasswordView

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('profile/',ProfileView.as_view(),name='profile'),
    path('logout/',LogoutView.as_view(),name='logout'),
    path("change_password/",       ChangePasswordView.as_view(),       name="change_password"),
    path("password/reset/",        PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("password/reset/confirm/",PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("update_email/",          UpdateEmailView.as_view(),          name="update_email"),
    path("delete_account/",        DeleteAccountView.as_view(),        name="delete_account"),
]
