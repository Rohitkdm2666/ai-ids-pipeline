#!/usr/bin/env python3
"""
Windows wrapper for cicflowmeter.
Scapy requires tcpdump to read pcap files. On Windows, use WinDump instead.
Set WINDUMP_PATH to the full path of windump.exe, or place windump.exe
in flow-extraction-service/tools/ folder.

Download WinDump: https://www.winpcap.org/windump/install/
Requires Npcap (from Wireshark) - you likely have it if dumpcap works.
"""
import os
import sys

# Resolve WinDump path - MUST run before any scapy/cicflowmeter import
def _find_windump():
    """Find windump.exe - used as tcpdump replacement on Windows."""
    # 1. Explicit env
    env_path = os.environ.get("WINDUMP_PATH")
    if env_path and os.path.isfile(env_path):
        return os.path.abspath(env_path)
    # 2. tools/ folder next to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tools_dir = os.path.join(script_dir, "..", "tools")
    local_windump = os.path.normpath(os.path.join(tools_dir, "windump.exe"))
    if os.path.isfile(local_windump):
        return local_windump
    # 3. Check PATH (windump or tcpdump)
    import shutil
    for name in ("windump", "tcpdump"):
        p = shutil.which(name)
        if p:
            return p
    return None


# --- Patch Scapy BEFORE importing cicflowmeter ---
if sys.platform == "win32":
    windump = _find_windump()
    if windump:
        # Import scapy and patch tcpdump path BEFORE cicflowmeter loads
        import scapy.config
        scapy.config.conf.prog.tcpdump = windump
        if os.environ.get("DEBUG_CIC"):
            print("[CIC_WRAPPER] patched conf.prog.tcpdump =", windump, file=sys.stderr)
    else:
        print(
            "[CICFLOWMETER_WINDOWS] tcpdump/WinDump not found. CICFlowMeter requires it to read pcap on Windows.\n"
            "Options:\n"
            "  1. Download WinDump from https://www.winpcap.org/windump/install/\n"
            "  2. Place windump.exe in flow-extraction-service/tools/\n"
            "  3. Or set WINDUMP_PATH to full path of windump.exe\n"
            "  4. Or add windump/tcpdump to your system PATH",
            file=sys.stderr
        )
        sys.exit(1)


def main():
    from cicflowmeter.sniffer import main as cic_main
    cic_main()


if __name__ == "__main__":
    main()
