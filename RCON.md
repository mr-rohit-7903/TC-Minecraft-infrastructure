# Minecraft RCON Usage Guide

Remote Console (RCON) allows administrators and automation tools to send commands to the Minecraft server without joining the game.

This infrastructure uses RCON primarily for:

- Sending administrative Minecraft commands
- Safely flushing world data before backups
- Running the automated backup script

---

## 1. RCON Configuration

RCON is configured in `server/server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=YOUR_RCON_PASSWORD
```

### Configuration

| Setting | Value | Purpose |
|---|---:|---|
| RCON enabled | `true` | Enables RCON |
| RCON port | `25575` | TCP port used by RCON |
| RCON password | `YOUR_RCON_PASSWORD` | Authentication password |

The repository contains only the placeholder password.

**Never commit the real RCON password to GitHub.**

---

## 2. RCON Security

RCON should normally be accessible only from the local machine.

The backup script connects using:

```text
127.0.0.1:25575
```

This means the backup process communicates with RCON locally rather than exposing RCON to the Internet.

**Do not expose port `25575` through Playit or router port forwarding.**

The public Minecraft ports and RCON port serve different purposes:

```text
Internet
   │
   ├── Playit → Minecraft / ViaProxy
   │
   └── RCON ✕
              │
              └── localhost only
```

---

## 3. Installing `mcrcon`

This infrastructure uses `mcrcon` as the RCON client.

Verify that it is installed:

```bash
which mcrcon
```

Expected:

```text
/usr/local/bin/mcrcon
```

Check that it works:

```bash
mcrcon -h
```

---

## 4. Connecting Manually

The basic connection format is:

```bash
mcrcon -H 127.0.0.1 -P 25575 -p 'YOUR_RCON_PASSWORD'
```

After connecting, you can enter Minecraft server commands.

For example:

```text
list
```

or:

```text
time set day
```

or:

```text
weather clear
```

---

## 5. Executing a Single Command

You can also execute a command directly:

```bash
mcrcon \
    -H 127.0.0.1 \
    -P 25575 \
    -p 'YOUR_RCON_PASSWORD' \
    "list"
```

Another example:

```bash
mcrcon \
    -H 127.0.0.1 \
    -P 25575 \
    -p 'YOUR_RCON_PASSWORD' \
    "save-all flush"
```

---

## 6. Testing RCON

Check that Minecraft is running:

```bash
sudo systemctl status minecraft.service
```

Then test RCON:

```bash
mcrcon \
    -H 127.0.0.1 \
    -P 25575 \
    -p 'YOUR_RCON_PASSWORD' \
    "list"
```

If successful, Minecraft should return the current player list.

If authentication fails, verify that the password in the live:

```text
~/minecraft-server/server.properties
```

matches the password being supplied to `mcrcon`.

---

## 7. RCON and Automated Backups

The automated backup system uses RCON before creating the archive.

The backup script executes:

```text
save-all flush
```

This asks Minecraft to save pending world data before the filesystem backup begins.

The sequence is:

```text
Backup timer
     │
     ▼
minecraft-backup.service
     │
     ▼
minecraft-backup.sh
     │
     ▼
mcrcon
     │
     ▼
save-all flush
     │
     ▼
Wait 3 seconds
     │
     ▼
Create .tar.gz backup
     │
     ▼
Keep newest 7 backups
```

The repository version of:

```text
scripts/minecraft-backup.sh
```

contains:

```bash
RCON_PASSWORD="YOUR_RCON_PASSWORD"
```

The real password must be configured locally in:

```text
/usr/local/bin/minecraft-backup.sh
```

Do not commit the locally modified script containing the real password.

---

## 8. Manual Backup Through RCON

You can manually flush the world before performing maintenance:

```bash
mcrcon \
    -H 127.0.0.1 \
    -P 25575 \
    -p 'YOUR_RCON_PASSWORD' \
    "save-all flush"
```

Then verify that the server responds normally.

For a complete backup using the configured backup system:

```bash
sudo systemctl start minecraft-backup.service
```

Check the backup service:

```bash
sudo systemctl status minecraft-backup.service
```

View its logs:

```bash
journalctl -u minecraft-backup.service
```

---

## 9. Common RCON Problems

### `Connection refused`

Check whether Minecraft is running:

```bash
sudo systemctl status minecraft.service
```

Check whether port `25575` is listening:

```bash
ss -lntp | grep 25575
```

Also verify:

```properties
enable-rcon=true
rcon.port=25575
```

---

### Authentication failure

Verify the password in the live server configuration:

```bash
grep '^rcon.password=' ~/minecraft-server/server.properties
```

Do not share the output publicly because it contains the password.

If you change the RCON password, update both:

```text
~/minecraft-server/server.properties
```

and:

```text
/usr/local/bin/minecraft-backup.sh
```

Then restart Minecraft:

```bash
sudo systemctl restart minecraft.service
```

---

### `mcrcon: command not found`

Check:

```bash
which mcrcon
```

If nothing is returned, `mcrcon` is not available in your `PATH`.

The backup service specifically expects:

```text
/usr/local/bin/mcrcon
```

---

## 10. Useful RCON Commands

Some useful Minecraft commands that can be executed through RCON:

```text
list
```

Show connected players.

```text
save-all flush
```

Immediately save world data.

```text
time set day
```

Set the world time to day.

```text
weather clear
```

Clear the weather.

```text
say Server maintenance starting soon
```

Send a message to players.

```text
whitelist list
```

Show the whitelist.

```text
op <player>
```

Grant operator privileges.

```text
deop <player>
```

Remove operator privileges.

Use administrative commands carefully, especially commands that modify or stop the server.

---

## 11. RCON Port Reference

| Service | Address | Port | Exposure |
|---|---|---:|---|
| Minecraft | `0.0.0.0` | `25565/TCP` | Game connections |
| ViaProxy | `0.0.0.0` | `25568/TCP` | Proxy connections |
| Geyser | `0.0.0.0` | `19132/UDP` | Bedrock connections |
| RCON | `127.0.0.1` | `25575/TCP` | Local administration |

RCON should remain local unless there is a specific administrative requirement to expose it through a properly secured network.

---

## 12. Security Rules

1. **Never commit the real RCON password.**
2. **Never put the RCON password in the README.**
3. **Do not expose RCON through Playit.**
4. **Do not expose RCON through router port forwarding.**
5. Keep the repository version of the backup script sanitized.
6. Rotate the RCON password if it is accidentally exposed.
7. Treat RCON access as equivalent to administrative access to the Minecraft server.

---

## Quick Reference

### Test connection

```bash
mcrcon -H 127.0.0.1 -P 25575 -p 'YOUR_RCON_PASSWORD'
```

### Run one command

```bash
mcrcon -H 127.0.0.1 -P 25575 -p 'YOUR_RCON_PASSWORD' "list"
```

### Flush world

```bash
mcrcon -H 127.0.0.1 -P 25575 -p 'YOUR_RCON_PASSWORD' "save-all flush"
```

### Run complete backup

```bash
sudo systemctl start minecraft-backup.service
```

### View backup logs

```bash
journalctl -u minecraft-backup.service -f
```

### Check RCON port

```bash
ss -lntp | grep 25575
```