"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { startCall, type CallControls, type CallPeer } from "@/components/call/engine";

export function CallRoom({
  scope,
  id,
  relay,
  appearance,
}: {
  scope: "connect" | "course";
  id: string;
  relay: boolean;
  appearance: "phone" | "desk";
}) {
  const [phase, setPhase] = useState<"idle" | "live">("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(false);
  const [listening, setListening] = useState(false);
  const [hand, setHand] = useState(false);
  const [hands, setHands] = useState<string[]>([]);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<CallPeer[]>([]);
  const [roster, setRoster] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const controls = useRef<CallControls | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    setReady(true);
    return () => controls.current?.stop();
  }, []);

  function begin(video: boolean, listen = false) {
    const mine = ++generation.current;
    controls.current?.stop();
    setPhase("live");
    setMuted(false);
    setCamera(video);
    setListening(listen);
    setHand(false);
    setHands([]);
    setError("");
    const current = () => mine === generation.current;
    controls.current = startCall({
      scope,
      id,
      video,
      listen,
      onStatus: (next) => {
        if (current()) {
          setStatus(next);
        }
      },
      onPeers: (next) => {
        if (current()) {
          setPeers(next);
        }
      },
      onHands: (next) => {
        if (current()) {
          setHands(next);
        }
      },
      onRoster: (next) => {
        if (current()) {
          setRoster(next);
        }
      },
      onLocal: (stream) => {
        if (current()) {
          setLocal(stream);
        }
      },
      onError: (next, ended) => {
        if (!current()) {
          return;
        }
        setError(next);
        if (ended) {
          setPhase("idle");
          setLocal(null);
          setPeers([]);
          setRoster([]);
          setCamera(false);
          setListening(false);
          setHand(false);
          setHands([]);
        }
      },
    });
  }

  function leave() {
    generation.current += 1;
    controls.current?.stop();
    controls.current = null;
    setPhase("idle");
    setStatus("");
    setError("");
    setLocal(null);
    setPeers([]);
    setRoster([]);
    setCamera(false);
    setListening(false);
    setHand(false);
    setHands([]);
  }

  const soft = appearance === "phone" ? "text-[var(--screen-soft)]" : "text-ink-soft";
  const rule = appearance === "phone" ? "border-[var(--hairline)]" : "border-line";

  return (
    <section aria-label="Call" data-ready={ready ? "true" : "false"} className={appearance === "desk" ? "mt-6 max-w-xl border-t border-line pt-4" : `border-b ${rule} px-3 py-2`}>
      <p className={`text-[11px] leading-5 ${soft}`}>
        {scope === "course"
          ? "Four people can speak. Twenty-four others can listen. Nothing is recorded. Each speaker’s browser carries the listeners, so this is a seminar, not a large voice network."
          : "Up to 4 people. Nothing is recorded."}
        {relay
          ? " The media server relays the call when a direct path is blocked."
          : " The relay is not answering, so a call works only on a direct path."}
      </p>
      {phase === "idle" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => begin(false)}>
            Start voice
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => begin(true)}>
            Start video
          </Button>
          {scope === "course" ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => begin(false, true)}>
              Listen
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            {camera && local ? <StreamVideo stream={local} muted label="Your camera" /> : null}
            {peers.filter((peer) => peer.video).map((peer) => (
              <StreamVideo key={peer.userId} stream={peer.stream} label={peer.name} />
            ))}
          </div>
          {peers.filter((peer) => !peer.video).map((peer) => (
            <p key={peer.userId} className={`text-xs ${soft}`}>
              {peer.name} is in the call.
              <StreamAudio stream={peer.stream} />
            </p>
          ))}
          {roster.filter((name) => !peers.some((peer) => peer.name === name)).map((name) => (
            <p key={name} className={`text-xs ${soft}`}>{name} is in the room.</p>
          ))}
          {listening ? <p className={`text-xs ${soft}`}>You are listening. Your microphone is off.</p> : !camera ? <p className={`text-xs ${soft}`}>Your microphone is on.</p> : null}
          {hands.length > 0 ? <p className={`text-xs ${soft}`}>{hands.join(", ")} raised a hand.</p> : null}
          <div className="flex flex-wrap gap-2">
            {listening ? null : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                controls.current?.setMuted(next);
              }}
            >
              {muted ? "Unmute" : "Mute"}
            </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const next = !hand;
                setHand(next);
                controls.current?.setHand(next);
              }}
            >
              {hand ? "Lower hand" : "Raise hand"}
            </Button>
            <Button type="button" size="sm" variant="danger" onClick={leave}>
              Leave call
            </Button>
          </div>
        </div>
      )}
      {status ? (
        <p className={`mt-2 text-xs ${soft}`} role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-coral" role="status">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function StreamVideo({ stream, muted, label }: { stream: MediaStream; muted?: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.srcObject = stream;
    void element.play().catch(() => undefined);
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} aria-label={label} className="aspect-video w-full bg-black object-cover" />;
}

function StreamAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.srcObject = stream;
    void element.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [stream]);
  return (
    <>
      <audio ref={ref} autoPlay />
      {blocked ? (
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => {
            void ref.current?.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
          }}
        >
          Hear
        </button>
      ) : null}
    </>
  );
}
