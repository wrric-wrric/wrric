#!/usr/bin/env bash
set -euo pipefail

# 1) Update and install prerequisites
sudo apt-get update
sudo apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release

# 2) Add Docker’s GPG key
sudo mkdir -p /usr/share/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 3) Add Docker’s apt repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4) Install Docker Engine, CLI, and containerd
sudo apt-get update
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io

# 5) (Optional) Install Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# 6) Add your user to the docker group (so you can run without sudo)
if ! groups "$USER" | grep -qw docker; then
  sudo usermod -aG docker "$USER"
  echo "Added $USER to docker group. You must log out and back in (or run 'newgrp docker') for it to take effect."
else
  echo "$USER is already in the docker group."
fi

# 7) Display version info
echo
echo "🎉 Docker installation complete!"
docker version
echo
if command -v docker compose &> /dev/null; then
  echo "Docker Compose plugin:"
  docker compose version
else
  echo "Docker Compose not installed as a plugin; you can still use 'docker-compose' if needed."
fi
