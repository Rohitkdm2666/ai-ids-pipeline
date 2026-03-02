#!/usr/bin/env python3
"""
Patched cicflowmeter that works on Windows WITHOUT tcpdump/WinDump.

Fixes:
1. Offline filter: When reading from file, pass filter=None so Scapy uses
   PcapReader directly instead of tcpdump (which is not on Windows).
2. on_packet_received: cicflowmeter uses prn=None so FlowSession.process() never
   calls on_packet_received. We patch process() to call it so flows get built.
3. Final garbage_collect: AsyncSniffer never calls session.toPacketList(), so
   remaining flows are never written. We register the session and call
   garbage_collect(None) when the sniffer finishes.
4. EDecimal/Decimal: Scapy packet.time is EDecimal when reading pcap;
   datetime.fromtimestamp() and numpy reject it. We patch PacketTime and
   get_statistics to convert to float.
5. CSV flush: Store the output file handle and flush/close it at the end.
"""
import sys
import os

# Sessions register here when created; we call garbage_collect when sniffer exits
_active_flow_sessions = []


def main():
    # 1. Monkey-patch AsyncSniffer: no tcpdump when reading from file
    import scapy.sendrecv
    _original_run = scapy.sendrecv.AsyncSniffer._run

    def _patched_run(self, count=0, store=True, offline=None, quiet=False,
                     prn=None, lfilter=None, L2socket=None, timeout=None,
                     opened_socket=None, stop_filter=None, iface=None,
                     started_callback=None, session=None, chainCC=False, **karg):
        if offline is not None and karg.get("filter"):
            karg = dict(karg)
            karg["filter"] = None
        return _original_run(
            self, count=count, store=store, offline=offline, quiet=quiet,
            prn=prn, lfilter=lfilter, L2socket=L2socket, timeout=timeout,
            opened_socket=opened_socket, stop_filter=stop_filter, iface=iface,
            started_callback=started_callback, session=session, chainCC=chainCC,
            **karg
        )

    scapy.sendrecv.AsyncSniffer._run = _patched_run

    # 1b. Fix EDecimal/Decimal: Scapy uses EDecimal for packet.time when reading
    #     pcap; numpy and datetime don't handle it. Convert to float everywhere.
    try:
        import cicflowmeter.features.packet_time as pt
        def _fixed_get_time_stamp(self):
            time = self.flow.packets[0][0].time
            return __import__("datetime").datetime.fromtimestamp(
                float(time)
            ).strftime("%Y-%m-%d %H:%M:%S")
        pt.PacketTime.get_time_stamp = _fixed_get_time_stamp
    except Exception:
        pass

    try:
        import cicflowmeter.utils as utils
        _orig_get_statistics = utils.get_statistics
        def _fixed_get_statistics(alist):
            alist = [float(x) for x in alist]
            return _orig_get_statistics(alist)
        utils.get_statistics = _fixed_get_statistics
    except Exception:
        pass

    # 2. Monkey-patch FlowSession: process() must call on_packet_received
    import cicflowmeter.flow_session as fs

    _original_init = fs.FlowSession.__init__
    _original_process = getattr(fs.FlowSession, "process", None)

    def _patched_init(self, *args, **kwargs):
        _active_flow_sessions.append(self)
        # Replace the open block so we store the file handle for explicit flush
        self.flows = {}
        self.csv_line = 0
        if getattr(self, "output_mode", None) == "flow":
            self._csv_file = open(self.output_file, "w", buffering=1)
            self.csv_writer = __import__("csv").writer(self._csv_file)
        else:
            self._csv_file = None
        self.packets_count = 0
        self.clumped_flows_per_label = __import__("collections").defaultdict(list)
        fs.FlowSession.__bases__[0].__init__(self, *args, **kwargs)

    def _patched_process(self, packet):
        if packet and hasattr(self, "on_packet_received"):
            try:
                self.on_packet_received(packet)
            except Exception:
                pass
        if _original_process:
            return _original_process(self, packet)
        return packet

    fs.FlowSession.__init__ = _patched_init
    fs.FlowSession.process = _patched_process

    # Run cicflowmeter and flush remaining flows when done
    from cicflowmeter.sniffer import main as cic_main
    try:
        cic_main()
    finally:
        for sess in _active_flow_sessions:
            try:
                if hasattr(sess, "garbage_collect"):
                    sess.garbage_collect(None)
                if getattr(sess, "_csv_file", None) is not None:
                    try:
                        sess._csv_file.flush()
                        sess._csv_file.close()
                    except Exception:
                        pass
            except Exception:
                pass
        _active_flow_sessions.clear()


if __name__ == "__main__":
    main()
