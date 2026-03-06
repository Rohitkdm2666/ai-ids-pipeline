#!/bin/bash
# Packet Capture Service - tcpdump
# Captures ONLY victim app traffic (port 8000) for IDS analysis.
# Writes rotating PCAP files to data/pcap/
# Naming: capture_YYYYMMDD_HHMMSS.pcap
# Rotates every 10 seconds (-G 10)
#
# Filter: tcp port 8000 - captures traffic to/from victim app only.
# Override: set TCPDUMP_FILTER="" to capture all traffic.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PCAP_DIR="${PCAP_DIR:-$PROJECT_ROOT/data/pcap}"
INTERFACE="${NETWORK_INTERFACE:-any}"
# Default: capture only victim app traffic (port 8000). Set TCPDUMP_FILTER="" for all traffic.
TCPDUMP_FILTER="${TCPDUMP_FILTER:-tcp port 8000}"

mkdir -p "$PCAP_DIR"

# Log startup
echo "[PACKET_CAPTURE_STARTED] interface=$INTERFACE pcap_dir=$PCAP_DIR filter='$TCPDUMP_FILTER' rotation_sec=10"

# Start tcpdump in background; monitor for new PCAP files and log them
LAST_FILES=""
tcpdump -i "$INTERFACE" $TCPDUMP_FILTER -G 10 -w "$PCAP_DIR/capture_%Y%m%d_%H%M%S.pcap" 2>/dev/null &
TCPDUMP_PID=$!

while kill -0 $TCPDUMP_PID 2>/dev/null; do
  CURR_FILES=$(ls -1 "$PCAP_DIR"/capture_*.pcap 2>/dev/null | sort | tr '\n' ' ')
  if [ -n "$CURR_FILES" ] && [ "$CURR_FILES" != "$LAST_FILES" ]; then
    for f in $CURR_FILES; do
      if [[ " $LAST_FILES " != *" $f "* ]]; then
        echo "[PCAP_FILE_CREATED] $(basename "$f")"
      fi
    done
    LAST_FILES="$CURR_FILES"
  fi
  sleep 2
done
wait $TCPDUMP_PID 2>/dev/null || true
