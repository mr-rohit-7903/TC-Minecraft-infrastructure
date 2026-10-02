#!/bin/bash
set -e

MC_DIR="/home/YOUR_USER/minecraft-server"
BACKUP_DIR="/home/YOUR_USER/minecraft-backups"

mkdir -p "$BACKUP_DIR"

# IMPORTANT:
# Replace YOUR_RCON_PASSWORD locally before using this script.
RCON_PASSWORD="YOUR_RCON_PASSWORD"

/usr/local/bin/mcrcon \
    -H 127.0.0.1 \
    -P 25575 \
    -p "$RCON_PASSWORD" \
    "save-all flush"

sleep 3

BACKUP="$BACKUP_DIR/minecraft-$(date +%Y-%m-%d_%H-%M-%S).tar.gz"

tar -czf "$BACKUP" \
    -C "$MC_DIR" \
    world \
    server.properties \
    whitelist.json \
    ops.json \
    banned-players.json \
    banned-ips.json

ls -1t "$BACKUP_DIR"/minecraft-*.tar.gz 2>/dev/null | \
    tail -n +8 | xargs -r rm --

echo "Backup created: $BACKUP"
