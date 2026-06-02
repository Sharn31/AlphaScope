from rest_framework import serializers
from .models import User

class SignupSerializer(serializers.ModelSerializer):
    class Meta:
        model=User
        fields = ['username','email','password',]
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user