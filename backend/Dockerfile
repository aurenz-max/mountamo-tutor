# Use Python 3.11 slim image for smaller size
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies needed for some Python packages
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port 8080 (Cloud Run default)
EXPOSE 8080


# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Run the application with uvicorn
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
