FROM ubuntu:22.04

WORKDIR /app

# Install Node.js 22.14.0 (latest stable LTS as of February 2025)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm@latest && \
    node --version && \
    npm --version && \
    rm -rf /var/lib/apt/lists/*

# Install the Anthropic Claude SDK globally as root
RUN npm install -g @anthropic-ai/claude-code

# Create a non-root user
RUN groupadd -r claude && useradd -r -g claude -m -d /home/claude claude

# Create a simple entry point
COPY . .

# Change ownership of the application files
RUN chown -R claude:claude /app

# Switch to non-root user
USER claude

CMD ["claude"]
