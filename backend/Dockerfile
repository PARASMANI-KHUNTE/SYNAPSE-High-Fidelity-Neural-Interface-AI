FROM node:20

# Install Python, PIP, and FFmpeg for audio processing
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create and activate virtual environment for Python dependencies
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python packages for Neural TTS and Transcription
RUN pip3 install --no-cache-dir edge-tts faster-whisper

COPY package*.json ./
RUN npm install

COPY . .

# Ensure uploads directory exists and is writable
RUN mkdir -p uploads && chmod 777 uploads

EXPOSE 3000

# Use a production-ready start script if available, fallback to dev
CMD ["npm", "run", "dev"]
