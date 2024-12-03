#!/bin/bash

# Update package lists
apt-get update

# Install necessary dependencies for Puppeteer
apt-get install -y \
  fonts-liberation \
  libappindicator3-1 \
  libatk-bridge2.0-0 \
  libcups2 \
  libxcomposite1 \
  libxrandr2 \
  libasound2 \
  libgbm1 \
  libnss3 \
  libnspr4 \
  xdg-utils

# Optional: Install Chromium if needed
apt-get install -y chromium-browser

echo "Render build setup complete."
