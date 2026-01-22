#!/bin/bash

# Install script for user systemd services (no sudo required)

echo "Installing Aquarium Timelapse user systemd services..."

# Create user systemd directory
mkdir -p ~/.config/systemd/user

# Copy service files
cp timelapse.service ~/.config/systemd/user/
cp timelapse-viewer.service ~/.config/systemd/user/
cp timelapse-sync.service ~/.config/systemd/user/
cp timelapse-sync.timer ~/.config/systemd/user/
cp timelapse-cleanup.service ~/.config/systemd/user/
cp timelapse-cleanup.timer ~/.config/systemd/user/

echo "Service files copied to ~/.config/systemd/user/"

# Reload systemd user daemon
systemctl --user daemon-reload

# Enable lingering (allows services to run when not logged in)
echo "Enabling user lingering..."
loginctl enable-linger $USER

# Enable and start services
echo "Enabling services..."
systemctl --user enable timelapse.service
systemctl --user enable timelapse-viewer.service
systemctl --user enable timelapse-sync.timer
systemctl --user enable timelapse-cleanup.timer

echo ""
echo "Installation complete!"
echo ""
echo "To start the services, run:"
echo "  systemctl --user start timelapse.service"
echo "  systemctl --user start timelapse-viewer.service"
echo "  systemctl --user start timelapse-sync.timer"
echo "  systemctl --user start timelapse-cleanup.timer"
echo ""
echo "To check status:"
echo "  systemctl --user status timelapse.service"
echo "  systemctl --user status timelapse-viewer.service"
echo "  systemctl --user list-timers"
echo ""
echo "Web interface will be available at: http://your-pi-ip:5000"
echo ""
echo "Note: If you have old system services running, stop them with:"
echo "  sudo systemctl stop timelapse timelapse-sync.timer timelapse-cleanup.timer"
echo "  sudo systemctl disable timelapse timelapse-sync.timer timelapse-cleanup.timer"
