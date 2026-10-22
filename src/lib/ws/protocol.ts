/**
 * Heartbeat contract shared by every WebSocket client (WS_API.md): echo
 * every 5 s so proxies/NAT do not drop an idle socket; no echo reply for
 * 45 s = the peer is gone, drop the socket ourselves.
 *
 * The timeout used to be 15 s, and a runner busy with a heavy step (loading a
 * model, a long GIL-bound stretch) or a tunnel that stalled for a moment was
 * declared dead — and the run, which was fine, lost its connection. A dead
 * peer is detected by the close event nearly always; this watchdog is for the
 * half-open socket, where being slow to notice costs seconds and being quick
 * costs the connection.
 *
 * Both constants live in one module so the two clients cannot drift: the
 * interval must stay strictly below the timeout, or an idle-but-healthy
 * connection is closed by its own watchdog.
 */
export const ECHO_INTERVAL_MS = 5000;
export const ECHO_TIMEOUT_MS = 45000;

/** How long a dial may stay in `connecting`. A tunnel or a blocked server can
 * accept the TCP connection and then never finish the upgrade; without a limit
 * the socket sits there for minutes (the browser's own timeout) and nothing
 * retries. */
export const HANDSHAKE_TIMEOUT_MS = 12000;

/** How long `stop` may go unconfirmed before the UI forces itself back to idle. */
export const STOP_WATCHDOG_MS = 5000;
