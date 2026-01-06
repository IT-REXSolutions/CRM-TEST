#!/bin/bash
# IT REX RMM Agent - Quick Installer for Linux
# Run with sudo

echo "╔════════════════════════════════════════════════╗"
echo "║      IT REX RMM Agent - Linux Installer        ║"
echo "╚════════════════════════════════════════════════╝"
echo

read -p "Enter Enrollment Token: " TOKEN
read -p "Enter API URL (e.g., https://servicedesk.example.com/api): " URL

echo
echo "Starting installation..."
echo

# Download and run the agent script
curl -sSL "${URL}/../agent/itrex-rmm-agent.sh" -o /tmp/itrex-rmm-agent.sh
chmod +x /tmp/itrex-rmm-agent.sh
sudo /tmp/itrex-rmm-agent.sh -t "$TOKEN" -u "$URL"

echo
echo "Installation completed!"
