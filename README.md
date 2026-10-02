# Minecraft Infrastructure & Operations Guide

A complete infrastructure blueprint and operational guide for hosting a Minecraft Java server paired with a Bedrock cross-play proxy (**ViaProxy + Geyser**), Playit tunnel integration, an automated **Mineflayer bot**, and daily **systemd automated backups** with 7-day rotation.

---

## 🏗 System Architecture

```text
                         INTERNET
                            │
                            ▼
                    ┌───────────────┐
                    │     Playit    │
                    │ Public Tunnel │
                    └───────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
          Java connection       Bedrock connection
                 │                     │
                 │               ViaProxy + Geyser
                 │                     │
                 └──────────┬──────────┘
                            ▼
                   Minecraft :25565
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       Mineflayer Bot                 RCON :25575
                                            │
                                            ▼
                                     Backup System
```

---

## 🔑 Placeholders & Configuration Reference

Before deploying this infrastructure, customize the placeholder values across the configuration templates:

| Placeholder | File(s) | Description |
|---|---|---|
| `YOUR_USER` | `systemd/*.service`, `scripts/minecraft-backup.sh` | Linux system user running the server & backup processes |
| `YOUR_RCON_PASSWORD` | `server/server.properties`, `scripts/minecraft-backup.sh` | Password used for RCON access and backup world flushes |
| `YOUR_SERVER_MOTD` | `server/server.properties` | Server message of the day displayed in client server list |
| `YOUR_LEVEL_SEED` | `server/server.properties` | Seed used for Minecraft world generation |
| `YOUR_MANAGEMENT_SECRET` | `server/server.properties` | Secret token for Minecraft server management interface |
| `YOUR_BOT_NAME` | `bot/index.js` | In-game bot display name |
| `YOUR_USERNAME` | `bot/index.js` | Primary player username for the bot to target/follow |

---

## 📁 Repository Directory Structure

```
.
├── README.md                          # Comprehensive setup & operations guide
├── .gitignore                         # Excludes worlds, JARs, logs, secrets, and node_modules
├── server/
│   └── server.properties              # Sanitized Minecraft server configuration template
├── bot/
│   ├── index.js                       # Mineflayer bot with pathfinder & auto-eat logic
│   ├── package.json                   # Node.js dependencies
│   └── package-lock.json              # Fixed dependency lockfile
├── viaproxy/
│   └── config/                        # ViaProxy & protocol translator config templates
│       ├── viaproxy.yml               # Main proxy configuration (bind port, target port)
│       ├── viabedrock.yml             # Geyser Bedrock protocol configuration
│       ├── viaversion.yml             # Protocol support configuration
│       ├── viabackwards.yml           # Backward compatibility configuration
│       ├── viarewind.yml              # Rewind compatibility configuration
│       ├── vialegacy.yml              # Legacy protocol translation configuration
│       └── viaaprilfools.yml          # April Fools protocol version handling
├── systemd/
│   ├── minecraft.service              # Systemd unit for Minecraft Java server
│   ├── viaproxy.service               # Systemd unit for ViaProxy + Geyser bridge
│   ├── playit.service                 # Systemd unit for Playit tunnel agent
│   ├── minecraft-backup.service       # Systemd oneshot unit for backup execution
│   └── minecraft-backup.timer        # Systemd timer unit for daily backup schedule
└── scripts/
    └── minecraft-backup.sh            # Safe RCON save-all flush & rotated tar.gz backup script
```

---

## 🔌 Port Mapping & Network Reference

| Component | Default Port | Protocol | Purpose |
|---|---|---|---|
| Minecraft Server | `25565` | TCP | Standard Java Edition client connections |
| RCON Server | `25575` | TCP | Remote command control for safe backups |
| ViaProxy Bridge | `25568` | TCP | Cross-version Java proxy listener |
| Geyser Bedrock | `19132` | UDP | Bedrock Edition client connections |
| Mineflayer Bot | `25568` | TCP | Bot connection to ViaProxy (or `25565` for direct server connection) |

---

## 🛠 Prerequisites & Dependencies

### 1. Required System Software
- **Operating System:** Linux (Ubuntu 22.04+ / Debian 12+ recommended)
- **Java Runtime:** OpenJDK 25 or newer (`sudo apt install openjdk-25-jre-headless`)
- **Node.js:** v24.x or newer & `npm`
- **Utility Tools:** `mcrcon`, `tar`, `systemd`, `bash`

### 2. External Binaries (Not tracked in Git)
Download the following binaries into their respective working paths before running:
- **Minecraft Server JAR (`server.jar`):** Minecraft 26.3 server executable placed in `~/minecraft-server/server.jar`
- **ViaProxy JAR (`ViaProxy-3.4.14.jar`):** Main proxy executable placed in `~/viaproxy/ViaProxy-3.4.14.jar`
- **Geyser Plugin JAR (`Geyser-ViaProxy.jar`):** Placed in `~/viaproxy/plugins/Geyser-ViaProxy.jar`

---

## 🌐 Playit Networking

Playit is used to expose the locally hosted Minecraft services to the Internet without requiring traditional router port forwarding.

The Playit agent runs as:
`playit.service`

The systemd unit is included in:
`systemd/playit.service`

The Playit authentication/secret configuration is intentionally not stored in this repository.
The local Playit agent stores its secret at:
`/etc/playit/playit.toml`

**Do not commit this file.**

### Setup
1. Install the Playit agent on the host.
2. Claim/authenticate the agent with the Playit account.
3. Configure the required tunnels through Playit.
4. Point the tunnels to the appropriate local Minecraft/ViaProxy ports.
5. Enable the Playit service:
   ```bash
   sudo systemctl enable --now playit.service
   ```
6. Check its status:
   ```bash
   sudo systemctl status playit.service
   ```

---

## 🚀 Installation & Setup Guide

### Step 1: Create System Directories
Create the runtime directories for the server, proxy, plugins, and backups:
```bash
mkdir -p ~/minecraft-server ~/viaproxy/config ~/viaproxy/plugins ~/minecraft-backups
```

### Step 2: Minecraft Java Server Deployment
1. Copy `server/server.properties` into `~/minecraft-server/server.properties`.
2. Edit `~/minecraft-server/server.properties` to set your actual settings (`rcon.password=YOUR_RCON_PASSWORD`, `motd=YOUR_SERVER_MOTD`, etc.).
3. Accept the Minecraft EULA:
   ```bash
   echo "eula=true" > ~/minecraft-server/eula.txt
   ```
4. Download the Minecraft Server JAR into `~/minecraft-server/server.jar`.

### Step 3: Configure RCON

Set the RCON password in the local Minecraft configuration (`server.properties`):
```properties
rcon.password=YOUR_RCON_PASSWORD
```

The backup script requires the same password locally.
**Important:** Never commit the real RCON password to GitHub. The repository version of `scripts/minecraft-backup.sh` must contain only a placeholder (`YOUR_RCON_PASSWORD`). Configure the real password manually in `/usr/local/bin/minecraft-backup.sh` on the server.

### Step 4: Backup Script Installation
Install the repository backup script to `/usr/local/bin/` and configure your system username (`YOUR_USER`) and RCON password:
```bash
sudo cp scripts/minecraft-backup.sh /usr/local/bin/minecraft-backup.sh
sudo chmod +x /usr/local/bin/minecraft-backup.sh
```

### Step 5: ViaProxy & Geyser Setup
1. Copy configuration templates from `viaproxy/config/` to `~/viaproxy/`:
   ```bash
   cp viaproxy/config/*.yml ~/viaproxy/
   ```
2. Place `ViaProxy-3.4.14.jar` in `~/viaproxy/`.
3. Place `Geyser-ViaProxy.jar` in `~/viaproxy/plugins/`.

### Step 6: Systemd Services Installation
Copy the repository systemd service and timer files to `/etc/systemd/system/` (Playit is package-managed at `/usr/lib/systemd/system/playit.service` and should not be overwritten):
```bash
sudo cp systemd/minecraft.service /etc/systemd/system/
sudo cp systemd/viaproxy.service /etc/systemd/system/
sudo cp systemd/minecraft-backup.service /etc/systemd/system/
sudo cp systemd/minecraft-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload

# Enable automatic boot startup
sudo systemctl enable minecraft.service
sudo systemctl enable viaproxy.service
sudo systemctl enable playit.service
sudo systemctl enable minecraft-backup.timer

# Start main server and proxy services
sudo systemctl start minecraft.service
sudo systemctl start viaproxy.service
sudo systemctl start playit.service
sudo systemctl start minecraft-backup.timer
```

### Step 7: Mineflayer Bot Installation & Usage
1. Navigate to the `bot/` directory and install Node.js dependencies:
   ```bash
   cd bot
   npm install
   ```
2. Configure your bot connection parameters (target host, port, username) directly in `bot/index.js`.
3. Start the bot:
   ```bash
   npm start
   ```

---

## 🔄 Management & Operational Commands

### Checking Service Status & Logs
```bash
# Check status of server, proxy, playit, and backup timer
sudo systemctl status minecraft.service
sudo systemctl status viaproxy.service
sudo systemctl status playit.service
sudo systemctl status minecraft-backup.timer

# Stream real-time logs
journalctl -u minecraft.service -f
journalctl -u viaproxy.service -f
journalctl -u playit.service -f
journalctl -u minecraft-backup.service -f
```

### Executing a Manual Backup
To trigger an immediate backup outside the daily timer schedule:
```bash
sudo systemctl start minecraft-backup.service
```

### Restoring from Backup
To restore the world state from a `.tar.gz` archive:
1. Stop the Minecraft server:
   ```bash
   sudo systemctl stop minecraft.service
   ```
2. Extract the desired backup archive into `~/minecraft-server`:
   ```bash
   tar -xzf ~/minecraft-backups/minecraft-YYYY-MM-DD_HH-MM-SS.tar.gz -C ~/minecraft-server/
   ```
3. Ensure user ownership permissions are correctly maintained for the service:
   ```bash
   chown -R YOUR_USER:YOUR_USER ~/minecraft-server/world
   ```
4. Restart the server:
   ```bash
   sudo systemctl start minecraft.service
   ```

---

## 🛡 Security & Best Practices

1. **Credentials:** Never commit Playit secrets (`/etc/playit/playit.toml`) or real passwords. Always populate placeholders (`YOUR_RCON_PASSWORD`, `YOUR_MANAGEMENT_SECRET`) in `server.properties` and template files before committing.
2. **Local Script Password Security:** The repository version of `scripts/minecraft-backup.sh` contains placeholder `YOUR_RCON_PASSWORD`. Set the real password directly in `/usr/local/bin/minecraft-backup.sh` on the host machine.
3. **Backup Retention:** The backup script automatically retains the **7 newest backups** in `~/minecraft-backups/` using timestamped rotation, automatically removing older archives to save disk space.
