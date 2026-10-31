import { describe, expect, it } from "vitest";
import {
  callRoomId,
  connectCallDecision,
  readTicket,
  signTicket,
  turnPassword,
  turnPasswordFor,
  turnUsername,
  type CallTicket,
} from "@/lib/media-protocol";

const secret = "campus-media-test-secret";

function ticket(exp: number): CallTicket {
  return {
    v: 1,
    scope: "connect",
    roomId: "connect:cmvtnmyyv000568vbz3l0l8kw",
    userId: "ada-user",
    name: "Maple",
    exp,
  };
}

describe("call tickets", () => {
  it("accepts a ticket signed with the media secret", () => {
    const now = 1_700_000_000_000;
    const token = signTicket(ticket(now + 60_000), secret);
    expect(readTicket(token, secret, now)?.name).toBe("Maple");
  });

  it("rejects a ticket that was altered or signed with another secret", () => {
    const now = 1_700_000_000_000;
    const token = signTicket(ticket(now + 60_000), secret);
    const altered = `${token.slice(0, -2)}aa`;
    expect(readTicket(altered, secret, now)).toBeNull();
    expect(readTicket(token, "another-media-secret-value", now)).toBeNull();
  });

  it("rejects an expired ticket and a room id that does not match", () => {
    const now = 1_700_000_000_000;
    expect(readTicket(signTicket(ticket(now - 1), secret), secret, now)).toBeNull();
    expect(callRoomId("course", "short")).toBeNull();
    expect(callRoomId("connect", "cmvtnmyyv000568vbz3l0l8kw")).toBe("connect:cmvtnmyyv000568vbz3l0l8kw");
  });

  it("keeps under-18 accounts and closed or blocked conversations out of Connect calls", () => {
    expect(connectCallDecision({ band: "minor", open: true, blocked: false }).ok).toBe(false);
    expect(connectCallDecision({ band: "adult", open: false, blocked: false }).ok).toBe(false);
    expect(connectCallDecision({ band: "adult", open: true, blocked: true }).ok).toBe(false);
    expect(connectCallDecision({ band: "adult", open: true, blocked: false }).ok).toBe(true);
  });

  it("issues a TURN password that expires with the username", () => {
    const username = turnUsername("ada-user", 1_800_000_000);
    const password = turnPassword(username, secret);
    expect(turnPasswordFor(username, secret, 1_800_000_000)).toBe(password);
    expect(turnPasswordFor(username, secret, 1_800_000_001)).toBeNull();
  });
});
