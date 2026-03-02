# Print Proxy

MITM MQTT proxy that sits between Bambu Studio and your printer. Intercepts
print commands for approval before forwarding them to the real printer, and
relays telemetry back to Studio.

## Prerequisites

### 1. Generate TLS Certs

From the repo root:

```
npm run rotate-certs
```

Certs are written to `services/print-proxy/certs/` (gitignored). Rotate
anytime — the proxy hot-reloads certs without restarting.

### 2. Environment Variables

Shared vars (`PRINTER_IP`, `PRINTER_SERIAL`, `PRINTER_ACCESS_CODE`) come from
the root `.env`. Copy `.env.example` to `.env` if you haven't already.

Optional service-specific override in `services/print-proxy/.env`:

```
PROXY_PORT=8883   # default 8883
```

### 3. Network Redirect (Windows)

Bambu Studio discovers printers via SSDP and connects to their real LAN IP.
It doesn't support manually entering a proxy address. To route Studio's traffic
through the proxy, use Windows port forwarding.

**Open an admin terminal** and run:

```powershell
# Redirect printer IP:8883 → localhost:8883 (where the proxy listens)
netsh interface portproxy add v4tov4 listenaddress=<PRINTER_IP> listenport=8883 connectaddress=127.0.0.1 connectport=8883

# Add the printer IP as a local alias so Windows accepts connections to it
netsh interface ipv4 add address "Ethernet" <PRINTER_IP> 255.255.255.0
```

Replace `<PRINTER_IP>` with your printer's actual IP (e.g., `192.168.20.69`).
Replace `"Ethernet"` with your network adapter name if different (run
`Get-NetAdapter` in PowerShell to check).

**To remove** when done:

```powershell
netsh interface portproxy delete v4tov4 listenaddress=<PRINTER_IP> listenport=8883
netsh interface ipv4 delete address "Ethernet" <PRINTER_IP>
```

**To verify** the redirect is active:

```powershell
netsh interface portproxy show all
```

### 4. Windows Firewall

If Studio still can't connect, allow inbound traffic on port 8883:

```powershell
netsh advfirewall firewall add rule name="Print Proxy MQTTS" dir=in action=allow protocol=TCP localport=8883
```

To remove later:

```powershell
netsh advfirewall firewall delete rule name="Print Proxy MQTTS"
```

## Usage

From the repo root:

```
npm run start:print-proxy
```

When Studio sends a print command, the proxy prompts for approval in the
terminal:

```
[proxy] PRINT JOB DETECTED: "my-model.3mf"
Approve print job "my-model.3mf"? [y/N]
```

Type `y` to forward to the printer, or anything else to block.

## How It Works

```
Bambu Studio ──MQTTS──▸ Print Proxy ──MQTTS──▸ Printer
                           │                      │
                           ◂──────── reports ──────┘
                           │
                       [approve/block]
```

- Studio connects to proxy (thinks it's the printer)
- Proxy relays Studio commands to the real printer after inspection
- Printer telemetry flows back through proxy to Studio
- Print-start commands (`project_file`, `gcode_file`, `print_3mf`) trigger
  an interactive approval prompt
