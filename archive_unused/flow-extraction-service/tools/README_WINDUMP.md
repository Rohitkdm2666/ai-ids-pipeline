# WinDump Setup (Windows) — OPTIONAL

**Update:** A patched cicflowmeter (`scripts/cicflowmeter_patched.py`) is now used on Windows. It reads pcap files directly **without** needing tcpdump/WinDump. You typically do NOT need WinDump.

## Quick Setup (only if not using the patch)

### Option 1: Download Manually

1. Download WinDump.exe from: https://www.winpcap.org/windump/install/bin/windump_3_9_5/WinDump.exe
2. Rename it to `windump.exe` and place it in this folder: `flow-extraction-service/tools/`
3. Restart the flow-extraction-service

### Option 2: Using PowerShell

Run from the project root:

```powershell
$url = "https://www.winpcap.org/windump/install/bin/windump_3_9_5/WinDump.exe"
$out = "d:\D Drive Backup\sem 4\EDI\ML model - Copy\flow-extraction-service\tools\windump.exe"
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
```

### Option 3: Use System-Wide WinDump

1. Download WinDump.exe (see Option 1)
2. Rename to `windump.exe` and add its folder to your system PATH
3. Or set `WINDUMP_PATH` in flow-extraction-service `.env`:
   ```
   WINDUMP_PATH=C:\path\to\windump.exe
   ```

## Requirements

- **Npcap** (or WinPcap) - You likely have this if dumpcap works for packet capture.
- Npcap is installed with Wireshark: https://npcap.com/

## Verify

After setup, run flow-extraction-service. You should see `[CICFLOWMETER_CSV_CREATED]` instead of `[CICFLOWMETER_ERROR] tcpdump is not available`.
