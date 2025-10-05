"""
Get Firebase auth token for content pipeline testing

Usage:
    python get_auth_token.py

This will authenticate with your test user and output a fresh token.
Add the token to your .env file as AUTH_TOKEN.
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

# Get credentials from .env
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")
TEST_USER_EMAIL = os.getenv("TEST_USER_EMAIL")
TEST_USER_PASSWORD = os.getenv("TEST_USER_PASSWORD")

def get_auth_token(email: str, password: str, api_key: str) -> dict:
    """Get Firebase ID token for a user"""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"

    payload = {
        "email": email,
        "password": password,
        "returnSecureToken": True
    }

    response = requests.post(url, json=payload)
    response.raise_for_status()

    return response.json()

if __name__ == "__main__":
    if not all([FIREBASE_API_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD]):
        print("❌ Error: Missing environment variables!")
        print("\nPlease add to your .env file:")
        print("FIREBASE_API_KEY=your_web_api_key")
        print("TEST_USER_EMAIL=your-test-user@example.com")
        print("TEST_USER_PASSWORD=your-test-password")
        exit(1)

    try:
        print("🔐 Authenticating with Firebase...")
        data = get_auth_token(TEST_USER_EMAIL, TEST_USER_PASSWORD, FIREBASE_API_KEY)

        token = data["idToken"]
        expires_in = data.get("expiresIn", "3600")

        print(f"\n✅ Auth token retrieved successfully!")
        print(f"   Expires in: {int(expires_in) / 60} minutes\n")
        print(f"Add this to your .env file:\n")
        print(f"AUTH_TOKEN={token}\n")

        # Optionally update .env file automatically
        update = input("Update .env file automatically? (y/n): ").lower()
        if update == 'y':
            env_path = os.path.join(os.path.dirname(__file__), '.env')
            with open(env_path, 'r') as f:
                lines = f.readlines()

            # Remove old AUTH_TOKEN if exists
            lines = [line for line in lines if not line.startswith('AUTH_TOKEN=')]

            # Add new token
            lines.append(f'\nAUTH_TOKEN={token}\n')

            with open(env_path, 'w') as f:
                f.writelines(lines)

            print("✅ .env file updated!")

    except requests.exceptions.HTTPError as e:
        print(f"❌ Authentication failed: {e}")
        print(f"   Response: {e.response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
