export type CallPeer = {
  userId: string;
  name: string;
  stream: MediaStream;
  video: boolean;
};

type Ticket = {
  wsUrl: string;
  token: string;
  userId: string;
  relay: boolean;
  iceServers: RTCIceServer[];
};

type PeerLink = {
  userId: string;
  name: string;
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  remoteSet: boolean;
  pending: RTCIceCandidateInit[];
  restarted: boolean;
};

export type CallControls = {
  stop: () => void;
  setMuted: (muted: boolean) => void;
  setHand: (up: boolean) => void;
  shareWindow: () => Promise<void>;
  stopShare: () => void;
};

export function startCall(options: {
  scope: "connect" | "course";
  id: string;
  video: boolean;
  listen?: boolean;
  onStatus: (status: string) => void;
  onPeers: (peers: CallPeer[]) => void;
  onRoster?: (names: string[]) => void;
  onHands?: (names: string[]) => void;
  onLocal: (stream: MediaStream | null) => void;
  onScreen?: (stream: MediaStream | null) => void;
  onError: (error: string, ended?: boolean) => void;
}): CallControls {
  let stopped = false;
  let local: MediaStream | null = null;
  let screen: MediaStream | null = null;
  let socket: WebSocket | null = null;
  let userId = "";
  let relay = false;
  const links = new Map<string, PeerLink>();
  const hands = new Map<string, string>();

  const controls: CallControls = {
    stop() {
      stopped = true;
      cleanup();
    },
    setMuted(muted: boolean) {
      local?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    },
    setHand(up: boolean) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify({ type: "hand", up }));
    },
    async shareWindow() {
      if (options.scope !== "course" || options.listen || stopped) {
        return;
      }
      try {
        const next = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screen?.getTracks().forEach((track) => track.stop());
        screen = next;
        const track = next.getVideoTracks()[0];
        if (!track) {
          return;
        }
        track.onended = () => controls.stopShare();
        for (const link of links.values()) {
          link.pc.addTrack(track, next);
        }
        options.onScreen?.(next);
      } catch {
        options.onError("The window was not shared. The call is still open.");
      }
    },
    stopShare() {
      for (const link of links.values()) {
        for (const sender of [...link.pc.getSenders()]) {
          if (sender.track && screen?.getTracks().includes(sender.track)) {
            link.pc.removeTrack(sender);
          }
        }
      }
      screen?.getTracks().forEach((track) => track.stop());
      screen = null;
      options.onScreen?.(null);
    },
  };

  void run();
  return controls;

  async function run() {
    options.onError("");
    if (options.listen) {
      options.onStatus("Joining to listen.");
    } else {
      options.onStatus(options.video ? "Asking the browser for the camera and microphone." : "Asking the browser for the microphone.");
      try {
        local = await navigator.mediaDevices.getUserMedia({ audio: true, video: options.video });
      } catch (error) {
        options.onError(deviceMessage(error, options.video), true);
        options.onStatus("");
        return;
      }
    }
    if (stopped) {
      cleanup();
      return;
    }
    options.onLocal(local);
    options.onStatus("Joining the call.");

    let ticket: Ticket;
    try {
      const response = await fetch("/api/call/ticket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: options.scope, id: options.id }),
      });
      const body = (await response.json()) as Ticket & { error?: string };
      if (!response.ok) {
        options.onError(body.error || "The call could not start.", true);
        options.onStatus("");
        cleanup();
        return;
      }
      ticket = body;
    } catch {
      options.onError("The call could not reach Campus+.", true);
      options.onStatus("");
      cleanup();
      return;
    }
    if (stopped) {
      cleanup();
      return;
    }

    userId = ticket.userId;
    relay = ticket.relay;
    socket = new WebSocket(ticket.wsUrl);
    let inbound = Promise.resolve();
    socket.addEventListener("open", () => {
      socket?.send(JSON.stringify({ type: "join", token: ticket.token, role: options.listen ? "listener" : "speaker" }));
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") {
        return;
      }
      const raw = event.data;
      inbound = inbound.then(() => onServerMessage(raw, ticket.iceServers)).catch(() => undefined);
    });
    socket.addEventListener("close", () => {
      if (!stopped) {
        options.onError("The media server disconnected.", true);
        options.onStatus("");
        stopped = true;
        cleanup();
      }
    });
    socket.addEventListener("error", () => {
      if (!stopped) {
        options.onError("The media server could not be reached.");
      }
    });
  }

  async function onServerMessage(raw: string, iceServers: RTCIceServer[]) {
    let message: {
      type?: string;
      peers?: { userId?: string; name?: string }[];
      userId?: string;
      name?: string;
      from?: string;
      up?: boolean;
      maxPeers?: number;
      description?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };
    try {
      message = JSON.parse(raw) as typeof message;
    } catch {
      return;
    }
    if (message.type === "rejected") {
      options.onError("This call was refused.", true);
      controls.stop();
      return;
    }
    if (message.type === "full") {
      options.onError(`This call already has ${message.maxPeers ?? 4} people.`, true);
      controls.stop();
      return;
    }
    if (message.type === "peers" && Array.isArray(message.peers)) {
      for (const peer of message.peers) {
        if (typeof peer.userId === "string" && typeof peer.name === "string") {
          ensurePeer(peer.userId, peer.name, iceServers);
        }
      }
      publishStatus();
      return;
    }
    if (message.type === "joined" && typeof message.userId === "string" && typeof message.name === "string") {
      ensurePeer(message.userId, message.name, iceServers);
      publishStatus();
      return;
    }
    if (message.type === "left" && typeof message.userId === "string") {
      hands.delete(message.userId);
      options.onHands?.([...hands.values()]);
      dropPeer(message.userId);
      publishStatus();
      return;
    }
    if (message.type === "hand" && typeof message.userId === "string" && typeof message.name === "string") {
      if (message.up) {
        hands.set(message.userId, message.name);
      } else {
        hands.delete(message.userId);
      }
      options.onHands?.([...hands.values()]);
      return;
    }
    if (message.type === "signal" && typeof message.from === "string") {
      const link = links.get(message.from) ?? ensurePeer(message.from, "Guest", iceServers);
      await acceptSignal(link, message.description, message.candidate);
    }
  }

  function ensurePeer(remoteId: string, name: string, iceServers: RTCIceServer[]) {
    const existing = links.get(remoteId);
    if (existing) {
      existing.name = name;
      publishPeers();
      return existing;
    }
    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle" });
    const link: PeerLink = {
      userId: remoteId,
      name,
      pc,
      makingOffer: false,
      ignoreOffer: false,
      remoteSet: false,
      pending: [],
      restarted: false,
    };
    links.set(remoteId, link);
    pc.onnegotiationneeded = () => {
      void negotiate(link);
    };
    if (local && local.getTracks().length > 0) {
      local.getTracks().forEach((track) => pc.addTrack(track, local as MediaStream));
    } else {
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });
    }
    if (userId > remoteId) {
      void negotiate(link);
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(remoteId, { candidate: event.candidate.toJSON() });
      }
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const current = links.get(remoteId);
      if (!current) {
        return;
      }
      current.name = name;
      publishPeers(stream, remoteId);
    };
    const noteState = () => {
      if ((pc.iceConnectionState === "failed" || pc.connectionState === "failed") && !link.restarted && userId > remoteId) {
        link.restarted = true;
        pc.restartIce();
        return;
      }
      publishStatus();
    };
    pc.oniceconnectionstatechange = noteState;
    pc.onconnectionstatechange = noteState;
    publishPeers();
    return link;
  }

  async function negotiate(link: PeerLink) {
    if (userId <= link.userId || link.makingOffer || link.pc.signalingState !== "stable") {
      return;
    }
    link.makingOffer = true;
    try {
      const offer = await link.pc.createOffer();
      if (link.pc.signalingState !== "stable") {
        return;
      }
      await link.pc.setLocalDescription(offer);
      sendSignal(link.userId, { description: link.pc.localDescription });
    } catch {
      options.onError("The call could not be negotiated.");
    } finally {
      link.makingOffer = false;
    }
  }

  async function acceptSignal(link: PeerLink, description?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit) {
    try {
      if (description && (description.type === "offer" || description.type === "answer") && typeof description.sdp === "string") {
        if (description.type === "offer" && userId > link.userId) {
          return;
        }
        await link.pc.setRemoteDescription(description);
        link.remoteSet = true;
        const queued = link.pending.splice(0);
        for (const item of queued) {
          await link.pc.addIceCandidate(item);
        }
        if (description.type === "offer") {
          const answer = await link.pc.createAnswer();
          await link.pc.setLocalDescription(answer);
          sendSignal(link.userId, { description: link.pc.localDescription });
        }
        publishStatus();
        return;
      }
      if (candidate && typeof candidate.candidate === "string") {
        if (!link.remoteSet) {
          link.pending.push(candidate);
          return;
        }
        await link.pc.addIceCandidate(candidate);
      }
    } catch {
      if (!link.ignoreOffer) {
        options.onError("The call could not be negotiated.");
      }
    }
  }

  function sendSignal(to: string, payload: { description?: RTCSessionDescription | null; candidate?: RTCIceCandidateInit }) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const description = payload.description
      ? { type: payload.description.type, sdp: payload.description.sdp }
      : undefined;
    socket.send(JSON.stringify({ type: "signal", to, description, candidate: payload.candidate }));
  }

  function dropPeer(remoteId: string) {
    const link = links.get(remoteId);
    if (!link) {
      return;
    }
    link.pc.close();
    links.delete(remoteId);
    publishPeers();
  }

  function publishPeers(stream?: MediaStream, remoteId?: string) {
    const peers: CallPeer[] = [];
    for (const link of links.values()) {
      const media = stream && link.userId === remoteId ? stream : findStream(link.pc);
      if (!media) {
        continue;
      }
      peers.push({
        userId: link.userId,
        name: link.name,
        stream: media,
        video: media.getVideoTracks().length > 0,
      });
    }
    options.onPeers(peers);
    options.onRoster?.([...links.values()].map((link) => link.name));
  }

  function publishStatus() {
    if (links.size === 0) {
      const waiting = options.listen ? "Waiting for someone to speak." : "Waiting for the other person.";
      options.onStatus(relay ? `${waiting} The media server can relay this call.` : `${waiting} The relay is not answering, so this call needs a direct path.`);
      return;
    }
    const states = [...links.values()].map((link) => link.pc.connectionState || link.pc.iceConnectionState);
    if (states.every((state) => state === "connected")) {
      options.onStatus(relay ? "Connected. The media server can relay this call." : "Connected on a direct path. The relay is not answering.");
      return;
    }
    if (states.some((state) => state === "failed")) {
      options.onStatus("The call could not connect.");
      return;
    }
    options.onStatus("Connecting.");
  }

  function cleanup() {
    socket?.close();
    socket = null;
    for (const link of links.values()) {
      link.pc.close();
    }
    links.clear();
    hands.clear();
    options.onHands?.([]);
    local?.getTracks().forEach((track) => track.stop());
    local = null;
    screen?.getTracks().forEach((track) => track.stop());
    screen = null;
    options.onLocal(null);
    options.onScreen?.(null);
    options.onPeers([]);
  }
}

function findStream(pc: RTCPeerConnection): MediaStream | null {
  const receiver = pc.getReceivers().find((item) => item.track);
  if (!receiver?.track) {
    return null;
  }
  return new MediaStream(pc.getReceivers().map((item) => item.track).filter(Boolean));
}

function deviceMessage(error: unknown, video: boolean): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return video ? "The browser did not share the camera or microphone." : "The browser did not share the microphone.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return video ? "This browser has no camera or microphone." : "This browser has no microphone.";
  }
  return video ? "The camera or microphone could not be opened." : "The microphone could not be opened.";
}
