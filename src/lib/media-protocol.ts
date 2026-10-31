import { createHmac, timingSafeEqual } from "node:crypto";

export const MEDIA_REALM = "campusplus";
export const MAX_CALL_PEERS = 4;
export const MAX_COURSE_SPEAKERS = 4;
export const MAX_COURSE_LISTENERS = 24;

export function maxCallPeers(scope: CallScope): number {
  return scope === "course" ? MAX_COURSE_SPEAKERS + MAX_COURSE_LISTENERS : MAX_CALL_PEERS;
}
export const CALL_TICKET_MS = 2 * 60 * 1000;
export const TURN_CREDENTIAL_SECONDS = 4 * 60 * 60;

export type CallScope = "connect" | "course";

export type CallTicket = {
  v: 1;
  scope: CallScope;
  roomId: string;
  userId: string;
  name: string;
  exp: number;
};

const ROOM_ID = /^(connect|course):([a-z0-9_-]{8,64})$/i;

export function mediaSecret(): string | null {
  const secret = process.env.MEDIA_SECRET?.trim() ?? "";
  return secret.length >= 16 ? secret : null;
}

export function mediaHost(): string {
  const host = process.env.MEDIA_PUBLIC_HOST?.trim() || "127.0.0.1";
  return /^[a-z0-9.-]+$/i.test(host) ? host : "127.0.0.1";
}

export function mediaPort(): number {
  return portFromEnv("MEDIA_PORT", 3001);
}

export function mediaTurnPort(): number {
  return portFromEnv("MEDIA_TURN_PORT", 3478);
}

export function mediaHealthUrl(): string {
  return `http://${mediaHost()}:${mediaPort()}/health`;
}

export function mediaSocketUrl(): string {
  return `ws://${mediaHost()}:${mediaPort()}`;
}

export function callRoomId(scope: CallScope, id: string): string | null {
  const roomId = `${scope}:${id}`;
  const match = ROOM_ID.exec(roomId);
  if (!match || match[1] !== scope) {
    return null;
  }
  return roomId;
}

export function callDisplayName(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80);
  return cleaned || "Guest";
}

export function connectCallDecision(input: {
  band: "adult" | "minor" | null;
  open: boolean;
  blocked: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.open) {
    return { ok: false, error: "This conversation is closed." };
  }
  if (input.blocked) {
    return { ok: false, error: "This conversation cannot start a call." };
  }
  if (input.band !== "adult") {
    return { ok: false, error: "Voice and video stay closed for under-18 accounts." };
  }
  return { ok: true };
}

export function signTicket(ticket: CallTicket, secret: string): string {
  const body = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function readTicket(token: string, secret: string, now = Date.now()): CallTicket | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) {
    return null;
  }
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<CallTicket>;
    const scope = parsed.scope;
    if (parsed.v !== 1 || (scope !== "connect" && scope !== "course")) {
      return null;
    }
    if (typeof parsed.roomId !== "string" || typeof parsed.userId !== "string" || typeof parsed.name !== "string") {
      return null;
    }
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp <= now) {
      return null;
    }
    const room = ROOM_ID.exec(parsed.roomId);
    if (!room || room[1] !== scope || !/^[a-z0-9_-]{4,80}$/i.test(parsed.userId)) {
      return null;
    }
    return {
      v: 1,
      scope,
      roomId: parsed.roomId,
      userId: parsed.userId,
      name: callDisplayName(parsed.name),
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function turnUsername(userId: string, expiryUnix: number): string {
  return `${expiryUnix}:${userId}`;
}

export function turnPassword(username: string, secret: string): string {
  return createHmac("sha1", secret).update(username).digest("base64");
}

export function turnPasswordFor(username: string, secret: string, nowUnix: number): string | null {
  const split = username.indexOf(":");
  if (split <= 0) {
    return null;
  }
  const expiry = Number(username.slice(0, split));
  const userId = username.slice(split + 1);
  if (!Number.isInteger(expiry) || expiry < nowUnix || !/^[a-z0-9_-]{4,80}$/i.test(userId)) {
    return null;
  }
  return turnPassword(username, secret);
}

export function iceServersFor(secret: string, userId: string, now = Date.now()): RTCIceServer[] {
  const host = mediaHost();
  const port = mediaTurnPort();
  const username = turnUsername(userId, Math.floor(now / 1000) + TURN_CREDENTIAL_SECONDS);
  return [
    { urls: `stun:${host}:${port}` },
    {
      urls: `turn:${host}:${port}?transport=udp`,
      username,
      credential: turnPassword(username, secret),
    },
  ];
}

function portFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return fallback;
  }
  return value;
}
