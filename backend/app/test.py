# gemini_test.py
import asyncio
from google import genai
from core.config import settings # ADJUST THIS IMPORT IF NEEDED

async def main():
    client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options={'api_version': 'v1alpha'})
    model_name = "gemini-2.0-flash-exp"

    connection = client.aio.live.connect(model=model_name)

    async with connection as session:
        print(f"Session object created: {session}")
        test_message = "Hello from minimal test"
        try:
            await session.send(test_message)
            print("Message sent successfully (hopefully)")
        except Exception as e:
            print(f"Error during session.send(): {e}")

        async for response in session:
            print(f"Response received: {response}")
            break

if __name__ == "__main__":
    asyncio.run(main())