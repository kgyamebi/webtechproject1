import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import dgram from "node:dgram";
import http from "node:http";
import { config } from "dotenv";
import { WebSocketServer, type WebSocket } from "ws";
import {
  MAX_CALL_PEERS,
  MAX_COURSE_LISTENERS,
  MAX_COURSE_SPEAKERS,
  mediaHost,
  mediaPort,
  mediaSecret,
  mediaTurnPort,
  readTicket,
  turnPasswordFor,
  MEDIA_REALM,
} from "../src/lib/media-protocol";

config();

const secret = mediaSecret();
if (!secret) {
  console.error("MEDIA_SECRET must be at least 16 characters. The media server will not start.");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const Turn = require("node-turn") as new (options: Record<string, unknown>) => {
  start: () => void;
  stop: () => void;
  authentification: { credentials: Record<string, string | undefined> };
};

const host = mediaHost();
const turn = new Turn({
  listeningPort: mediaTurnPort(),
  listeningIps: [host],
  relayIps: [host],
  externalIps: host,
  minPort: 49152,
  maxPort: 49252,
  authMech: "long-term",
  realm: MEDIA_REALM,
  credentials: {},
  debugLevel: "ERROR",
  log: (line: unknown) => {
    console.error(`[media] ${String(line)}`);
  },
});
turn.authentification.credentials = new Proxy({} as Record<string, string | undefined>, {
  get(_target, property) {
    if (typeof property !== "string") {
      return undefined;
    }
    return turnPasswordFor(property, secret, Math.floor(Date.now() / 1000)) ?? undefined;
  },
});
turn.start();

let turnReady = false;

function probeTurn(): Promise<void> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const packet = Buffer.alloc(20);
    packet.writeUInt16BE(0x0001, 0);
    packet.writeUInt32BE(0x2112a442, 4);
    randomBytes(12).copy(packet, 8);
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      turnReady = ready;
      socket.close();
      resolve();
    };
    socket.on("error", () => finish(false));
    socket.on("message", (message) => finish(message.length >= 20 && message.readUInt16BE(0) === 0x0101));
    socket.send(packet, mediaTurnPort(), host, (error) => {
      if (error) {
        finish(false);
      }
    });
    setTimeout(() => finish(false), 800);
  });
}

type Member = { userId: string; name: string; socket: WebSocket; role: "speaker" | "listener"; signals: number; signalWindow: number };

const rooms = new Map<string, Map<string, Member>>();

function peersOf(room: Map<string, Member>, self: Member) {
  return [...room.values()]
    .filter((member) => member.userId !== self.userId)
    .filter((member) => self.role === "speaker" || member.role === "speaker")
    .map((member) => ({ userId: member.userId, name: member.name }));
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function leave(roomId: string, userId: string) {
  const room = rooms.get(roomId);
  const member = room?.get(userId);
  if (!room || !member) {
    return;
  }
  room.delete(userId);
  for (const other of room.values()) {
    send(other.socket, { type: "left", userId });
  }
  if (room.size === 0) {
    rooms.delete(roomId);
  }
}

function readDescription(value: unknown): { type: "offer" | "answer"; sdp: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const type = (value as { type?: unknown }).type;
  const sdp = (value as { sdp?: unknown }).sdp;
  if ((type !== "offer" && type !== "answer") || typeof sdp !== "string" || sdp.length < 8 || sdp.length > 20000) {
    return null;
  }
  return { type, sdp };
}

function readCandidate(value: unknown): { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = (value as { candidate?: unknown }).candidate;
  if (typeof candidate !== "string" || candidate.length < 4 || candidate.length > 2000) {
    return null;
  }
  const sdpMid = (value as { sdpMid?: unknown }).sdpMid;
  const line = (value as { sdpMLineIndex?: unknown }).sdpMLineIndex;
  return {
    candidate,
    sdpMid: typeof sdpMid === "string" ? sdpMid.slice(0, 32) : null,
    sdpMLineIndex: typeof line === "number" && line >= 0 && line < 16 ? line : null,
  };
}

function allowedOrigin(origin: string | undefined): boolean {
  const raw = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const origins = new Set<string>([url.origin]);
  const port = url.port ? `:${url.port}` : "";
  if (url.hostname === "localhost") {
    origins.add(`${url.protocol}//127.0.0.1${port}`);
  }
  if (url.hostname === "127.0.0.1") {
    origins.add(`${url.protocol}//localhost${port}`);
  }
  return Boolean(origin && origins.has(origin));
}

const httpServer = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, turn: turnReady, maxPeers: MAX_CALL_PEERS, courseSpeakers: MAX_COURSE_SPEAKERS, courseListeners: MAX_COURSE_LISTENERS }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const sockets = new WebSocketServer({ server: httpServer, maxPayload: 65536 });

sockets.on("connection", (socket, request) => {
  if (!allowedOrigin(request.headers.origin)) {
    socket.close(4003, "origin");
    return;
  }
  let joined: { roomId: string; userId: string } | null = null;

  socket.on("message", (data, isBinary) => {
    if (isBinary) {
      return;
    }
    let message: { type?: unknown; token?: unknown; role?: unknown; up?: unknown; to?: unknown; description?: unknown; candidate?: unknown };
    try {
      message = JSON.parse(data.toString()) as typeof message;
    } catch {
      return;
    }
    if (message.type === "join" && typeof message.token === "string") {
      if (joined) {
        return;
      }
      const ticket = readTicket(message.token, secret);
      if (!ticket) {
        send(socket, { type: "rejected" });
        socket.close(4001, "ticket");
        return;
      }
      const room = rooms.get(ticket.roomId) ?? new Map<string, Member>();
      rooms.set(ticket.roomId, room);
      const existing = room.get(ticket.userId);
      if (existing) {
        room.delete(ticket.userId);
        existing.socket.close(4000, "replaced");
      }
      const role = message.role === "listener" && ticket.scope === "course" ? "listener" : "speaker";
      const speakers = [...room.values()].filter((member) => member.role === "speaker").length;
      const listeners = [...room.values()].filter((member) => member.role === "listener").length;
      const speakerCap = ticket.scope === "course" ? MAX_COURSE_SPEAKERS : MAX_CALL_PEERS;
      const listenerCap = ticket.scope === "course" ? MAX_COURSE_LISTENERS : 0;
      if ((role === "speaker" && speakers >= speakerCap) || (role === "listener" && listeners >= listenerCap)) {
        send(socket, { type: "full", maxPeers: role === "listener" ? listenerCap : speakerCap });
        socket.close(4002, "full");
        return;
      }
      const member: Member = { userId: ticket.userId, name: ticket.name, role, socket, signals: 0, signalWindow: Date.now() };
      room.set(ticket.userId, member);
      joined = { roomId: ticket.roomId, userId: ticket.userId };
      send(socket, { type: "peers", peers: peersOf(room, member) });
      for (const other of room.values()) {
        if (other.userId === ticket.userId) {
          continue;
        }
        if (role === "listener" && other.role === "listener") {
          continue;
        }
        send(other.socket, { type: "joined", userId: ticket.userId, name: ticket.name });
      }
      return;
    }
    if (joined && message.type === "hand" && typeof message.up === "boolean") {
      const room = rooms.get(joined.roomId);
      const self = room?.get(joined.userId);
      if (!room || !self) {
        return;
      }
      for (const other of room.values()) {
        if (other.userId !== self.userId) {
          send(other.socket, { type: "hand", userId: self.userId, name: self.name, up: message.up });
        }
      }
      return;
    }
    if (!joined || message.type !== "signal" || typeof message.to !== "string") {
      return;
    }
    const room = rooms.get(joined.roomId);
    const self = room?.get(joined.userId);
    const target = room?.get(message.to);
    if (!room || !self || !target || target.userId === self.userId || (self.role === "listener" && target.role === "listener")) {
      return;
    }
    const now = Date.now();
    if (now - self.signalWindow > 10000) {
      self.signalWindow = now;
      self.signals = 0;
    }
    self.signals += 1;
    if (self.signals > 600) {
      socket.close(4008, "rate");
      return;
    }
    const description = readDescription(message.description);
    const candidate = description ? null : readCandidate(message.candidate);
    if (!description && !candidate) {
      return;
    }
    send(target.socket, { type: "signal", from: self.userId, description: description ?? undefined, candidate: candidate ?? undefined });
  });

  socket.on("close", () => {
    if (!joined) {
      return;
    }
    const current = rooms.get(joined.roomId)?.get(joined.userId);
    if (current?.socket === socket) {
      leave(joined.roomId, joined.userId);
    }
  });
});

void probeTurn().then(() => {
  httpServer.listen(mediaPort(), host, () => {
    const relay = turnReady ? "TURN is answering" : "TURN is not answering, so calls need a direct path";
    console.log(`Campus+ media server listening on http://${host}:${mediaPort()} (${relay}, Connect ${MAX_CALL_PEERS}, course ${MAX_COURSE_SPEAKERS} speakers and ${MAX_COURSE_LISTENERS} listeners).`);
  });
});

function shutdown() {
  sockets.close();
  turn.stop();
  httpServer.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
