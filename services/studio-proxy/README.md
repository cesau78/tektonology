# Studio Proxy

MITM MQTT proxy that intercepts Bambu Studio's cloud MQTT traffic
(`us.mqtt.bambulab.com`). Logs all messages and optionally blocks print
commands before relaying them to the real cloud server.

## Prerequisites

### 1. TLS Certs

Reuses certs from `services/print-proxy/certs/`. Generate them if needed:

```
npm run rotate-certs
```

### 2. Environment Variables

Shared vars (`MONGODB_URI`) come from the root `.env`.

Optional service-specific override in `services/studio-proxy/.env`:

```
STUDIO_PROXY_PORT=28883   # default 28883
```

### 3. Network Redirect (Windows)

Studio connects to the Bambu cloud MQTT server by IP (`34.208.11.28:8883`).
To intercept this traffic, add the cloud IP as a local alias and redirect
it to the proxy.

**Open an admin terminal** and run:

```powershell
# Add Bambu cloud IP as a local alias
netsh interface ipv4 add address "Ethernet" 34.208.11.28 255.255.255.0

# Redirect cloud:8883 → localhost:28883 (where studio-proxy listens)
netsh interface portproxy add v4tov4 listenaddress=34.208.11.28 listenport=8883 connectaddress=127.0.0.1 connectport=28883
```

Replace `"Ethernet"` with your network adapter name if different (run
`Get-NetAdapter` in PowerShell to check).

**To remove** when done:

```powershell
netsh interface portproxy delete v4tov4 listenaddress=34.208.11.28 listenport=8883
netsh interface ipv4 delete address "Ethernet" 34.208.11.28
```

**To verify** the redirect is active:

```powershell
netsh interface portproxy show all
```

## Usage

From the repo root:

```
npm run start:studio-proxy
```

When Studio sends a print command through the cloud, the proxy prompts for
approval in the terminal:

```
[studio-proxy] PRINT JOB DETECTED: "my-model.3mf"
Approve print job "my-model.3mf"? [y/N]
```

Type `y` to forward to the cloud, or anything else to block.

## How It Works

```
Bambu Studio ──MQTTS──▸ Studio Proxy:28883 ──MQTTS──▸ us.mqtt.bambulab.com:8883
                             │                              │
                             ◂────────── responses ─────────┘
                             │
                         [approve/block]
```

- Studio thinks it's connecting to the cloud (IP alias + port forward)
- Proxy accepts Studio's credentials and uses them to connect upstream
- All MQTT messages are logged to MongoDB (`studio_mqtt_log` collection)
- Print-start commands (`project_file`, `gcode_file`, `print_3mf`) trigger
  an interactive approval prompt
