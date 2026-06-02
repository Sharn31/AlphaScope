from django.shortcuts import render
from rest_framework.views import APIView
from .serializers import SignupSerializer
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.status import HTTP_200_OK,HTTP_204_NO_CONTENT,HTTP_404_NOT_FOUND
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
User = get_user_model()
# Create your views here.
class LoginView(APIView):
    def post(self, request):
        email = request.data.get("username")
        password = request.data.get("password")
        
        try:
            user_obj = User.objects.get(email=email)
            user = authenticate(username=user_obj.username, password=password)
        except User.DoesNotExist:
            return Response({"message": "Invalid Credentials"})
        
        if user is not None:
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "Login Successful",
                "user_id": user.id,
                "username": user.username,
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh)
            })
        else:
            return Response({"message": "Invalid Credentials"})


class SignupView(APIView):
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "User Created Successfully"})
        return Response(serializer.errors)

class ProfileView(APIView):
    permission_classes=[IsAuthenticated]
    def get(self,request):
        user=request.user
        return Response({
            "user_id":user.id,
            "username":user.username,
            "email":user.email,
            "role":user.role,
            "phone_number":user.phone_number,
        })
    
class LogoutView(APIView):
    permission_classes=[IsAuthenticated]
    def post(self,request):
        try:
            refresh_token=request.data["refresh"]
            token=RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out successfully"}, status=status.HTTP_205_RESET_CONTENT)

        except Exception:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
        
class ChangePasswordView(APIView):
    
    permission_classes = [IsAuthenticated]
 
    def post(self, request):
        user = request.user
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
 
        if not current_password or not new_password:
            return Response(
                {"detail": "Both current_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        # Verify current password is correct
        if not user.check_password(current_password):
            return Response(
                {"current_password": ["Current password is incorrect."]},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        if len(new_password) < 8:
            return Response(
                {"new_password": ["Password must be at least 8 characters."]},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        user.set_password(new_password)
        user.save()
 
        # Re-issue tokens so the user stays logged in after password change
        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "Password changed successfully.",
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
        }, status=status.HTTP_200_OK)
 
 
class PasswordResetRequestView(APIView):
    
    def post(self, request):
        email = request.data.get("email", "").strip().lower()
 
        if not email:
            return Response(
                {"email": ["Email is required."]},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        # Always return 200 even if email not found — prevents user enumeration
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response(
                {"detail": "If this email exists, a reset link has been sent."},
                status=status.HTTP_200_OK
            )
 
        # Build reset token
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
 
        # Build the reset URL — update FRONTEND_URL in your settings
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        reset_url = f"{frontend_url}/reset-password/{uid}/{token}/"
 
        # Send email
        try:
            send_mail(
                subject="AlphaScope — Reset your password",
                message=(
                    f"Hi {user.username},\n\n"
                    f"Click the link below to reset your password:\n\n"
                    f"{reset_url}\n\n"
                    f"This link expires in 24 hours.\n\n"
                    f"If you didn't request this, you can safely ignore this email.\n\n"
                    f"— AlphaScope Team"
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@alphascope.com"),
                recipient_list=[user.email],
                fail_silently=False,
            )
        except Exception as e:
            return Response(
                {"detail": "Failed to send email. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
 
        return Response(
            {"detail": "If this email exists, a reset link has been sent."},
            status=status.HTTP_200_OK
        )
 
 
class PasswordResetConfirmView(APIView):
    
    def post(self, request):
        uid = request.data.get("uid", "")
        token = request.data.get("token", "")
        new_password = request.data.get("new_password", "")
 
        if not uid or not token or not new_password:
            return Response(
                {"detail": "uid, token and new_password are all required."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        # Decode uid → user
        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response(
                {"detail": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        # Validate token
        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired reset link."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        if len(new_password) < 8:
            return Response(
                {"new_password": ["Password must be at least 8 characters."]},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        user.set_password(new_password)
        user.save()
 
        return Response(
            {"message": "Password reset successfully. You can now log in."},
            status=status.HTTP_200_OK
        )
 
 
class UpdateEmailView(APIView):
    
    permission_classes = [IsAuthenticated]
 
    def post(self, request):
        new_email = request.data.get("email", "").strip().lower()
 
        if not new_email:
            return Response(
                {"email": ["Email is required."]},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        # Check email not already taken by another user
        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response(
                {"email": ["This email is already in use."]},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        request.user.email = new_email
        request.user.save()
 
        return Response(
            {"message": "Email updated successfully.", "email": new_email},
            status=status.HTTP_200_OK
        )
 
 
class DeleteAccountView(APIView):
    
    permission_classes = [IsAuthenticated]
 
    def delete(self, request):
        password = request.data.get("password", "")
 
        if not password:
            return Response(
                {"detail": "Password is required to delete your account."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        if not request.user.check_password(password):
            return Response(
                {"detail": "Incorrect password."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
        request.user.delete()
        return Response(
            {"message": "Account deleted successfully."},
            status=status.HTTP_204_NO_CONTENT
        )



