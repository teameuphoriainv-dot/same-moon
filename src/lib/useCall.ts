"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { calls } from "./live";
import { serverNow } from "./pulse";
import { startRing } from "./ringtone";
import { IDLE_CALL, type CallPhase, type CallState, type SignalRow } from "./types";

/** How long a call rings before it gives up. */
const RING_MS = 45_000;
/** How long a ring is given to reach the server before it is called off. */
const PLACE_MS = 8000;
/**
 * A ring older than this is not a ring, it is a phone that was closed without
 * hanging up. It is cleared rather than shown.
 */
const STALE_RING_MS = 90_000;

/**
 * Where the two phones find each other.
 *
 * STUN only tells a phone what its own public address looks like; the audio and
 * video then flow directly between the two devices and never touch a server.
 * That is free and private, and it works on most home and mobile networks. It
 * does not work behind a symmetric NAT, which needs a relay, so the TURN slot
 * below reads from the environment: fill those three vars in and strict
 * networks start working without any code change.
 */
function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ];
  const url = process.env.NEXT_PUBLIC_TURN_URL;
  const username = process.env.NEXT_PUBLIC_TURN_USER;
  const credential = process.env.NEXT_PUBLIC_TURN_PASS;
  if (url && username && credential) {
    servers.push({ urls: url, username, credential });
  }
  return servers;
}

type Facing = "user" | "environment";

/** A call that has just finished, for the "mark tonight" prompt. */
export interface Finished {
  /** How long the two of them were actually connected. */
  ms: number;
  /** Unique per call, so the same one is never offered twice. */
  id: number;
}

export function useCall(who: string | null) {
  const [call, setCall] = useState<CallState>(IDLE_CALL);
  const [connection, setConnection] = useState<"new" | "connecting" | "live" | "failed">("new");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<Facing>("user");
  const [canFlip, setCanFlip] = useState(false);
  const [liveSince, setLiveSince] = useState<number | null>(null);
  const [unanswered, setUnanswered] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [, tick] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const rowsRef = useRef<SignalRow[]>([]);
  const seenRef = useRef<Set<number>>(new Set());
  const iceQueue = useRef<RTCIceCandidateInit[]>([]);
  const pumping = useRef(false);
  const building = useRef(false);
  const sinceRef = useRef<number | null>(null);
  /**
   * Whether this device is part of the call, as opposed to merely able to see
   * that one is happening. Only a device that rang or picked up is. Without
   * this, a laptop left open in another room would switch its camera on and
   * answer as well the moment the phone picked up.
   */
  const engaged = useRef(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => calls.watch(setCall), []);

  // --- media ----------------------------------------------------------------

  /**
   * Ask for the camera once and hold onto it. Called at the moment of tapping
   * so the permission prompt lands on a deliberate action rather than on page
   * load, which is both less alarming and more likely to be granted.
   */
  const getMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (localRef.current) return localRef.current;
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("This browser will not give out the camera here.");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localRef.current = stream;
      setLocalStream(stream);
      setMicOn(true);
      setCamOn(true);
      setFacing("user");
      // Cameras only show up in this list once permission has been given.
      void navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setCanFlip(all.filter((d) => d.kind === "videoinput").length > 1))
        .catch(() => setCanFlip(false));
      return stream;
    } catch (err) {
      console.warn("[same-moon] camera or microphone refused", err);
      setError("Camera and microphone are blocked. Allow them and try again.");
      return null;
    }
  }, []);

  const engage = useCallback(() => {
    engaged.current = true;
    setJoined(true);
  }, []);

  const teardown = useCallback(() => {
    building.current = false;
    engaged.current = false;
    setJoined(false);
    pcRef.current?.close();
    pcRef.current = null;
    for (const track of localRef.current?.getTracks() ?? []) track.stop();
    localRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setConnection("new");
    seenRef.current.clear();
    iceQueue.current = [];

    // If they were connected, say for how long, once.
    if (sinceRef.current !== null) {
      const ms = Date.now() - sinceRef.current;
      sinceRef.current = null;
      setLiveSince(null);
      setFinished({ ms, id: Date.now() });
    }
  }, []);

  // --- handshake ------------------------------------------------------------

  /**
   * Work through whatever is in the mailbox.
   *
   * Rows are only marked seen once they have actually been applied, so anything
   * that lands before the peer connection exists stays queued and is picked up
   * the moment it does. The guard stops two overlapping runs from applying the
   * same offer twice.
   */
  const pump = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !who || pumping.current) return;
    pumping.current = true;
    try {
      for (const row of rowsRef.current) {
        if (seenRef.current.has(row.id)) continue;
        try {
          if (row.kind === "offer") {
            await pc.setRemoteDescription(JSON.parse(row.payload) as RTCSessionDescriptionInit);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            void calls.signal(who, "answer", JSON.stringify(answer));
          } else if (row.kind === "answer") {
            // Ignore a duplicate answer; applying one twice throws.
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(
                JSON.parse(row.payload) as RTCSessionDescriptionInit,
              );
            }
          } else if (row.kind === "ice") {
            const candidate = JSON.parse(row.payload) as RTCIceCandidateInit;
            // A candidate before the remote description is an error, so hold
            // it until there is something to attach it to.
            if (pc.remoteDescription) await pc.addIceCandidate(candidate);
            else iceQueue.current.push(candidate);
          }
          seenRef.current.add(row.id);
        } catch (err) {
          console.warn("[same-moon] could not apply a signal", row.kind, err);
          seenRef.current.add(row.id); // a bad row must not wedge the queue
        }
      }

      if (pc.remoteDescription && iceQueue.current.length > 0) {
        const queued = iceQueue.current;
        iceQueue.current = [];
        for (const candidate of queued) {
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            console.warn("[same-moon] stale candidate dropped", err);
          }
        }
      }
    } finally {
      pumping.current = false;
    }
  }, [who]);

  useEffect(() => {
    if (!who) return;
    return calls.watchSignals(who, (rows) => {
      rowsRef.current = rows;
      void pump();
    });
  }, [who, pump]);

  // --- the call itself ------------------------------------------------------

  // Let go of everything when a call ends. Only on the way into idle: being
  // idle already is not an ending, and tearing down then would cancel a call
  // in the moment between tapping the button and the ring landing.
  const before = useRef(call.status);
  useEffect(() => {
    const was = before.current;
    before.current = call.status;
    if (call.status === "idle" && was !== "idle") teardown();
  }, [call.status, teardown]);

  useEffect(() => {
    if (call.status !== "live" || !who) return;
    // Somebody is on a call, but not from this device.
    if (!engaged.current) return;
    // The guard has to be taken before the first await. `pcRef` alone is still
    // null while the camera is warming up, so two runs could both get past it
    // and build two peer connections for one call.
    if (pcRef.current || building.current) return;
    building.current = true;

    let cancelled = false;
    void (async () => {
      const stream = await getMedia();
      if (!stream || cancelled) {
        building.current = false;
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      pcRef.current = pc;
      setConnection("connecting");
      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      pc.ontrack = (event) => {
        if (event.streams[0]) setRemoteStream(event.streams[0]);
      };
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void calls.signal(who, "ice", JSON.stringify(event.candidate.toJSON()));
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setConnection("live");
          // Counted from the first moment they could actually see each other,
          // and not restarted if the line drops and comes back.
          if (sinceRef.current === null) {
            sinceRef.current = Date.now();
            setLiveSince(sinceRef.current);
          }
        } else if (pc.connectionState === "failed") setConnection("failed");
        else if (pc.connectionState === "disconnected") setConnection("connecting");
      };

      // Exactly one side offers, and it is always whoever rang. Fixing the
      // role this way is what keeps the two phones from offering at once.
      if (call.caller === who) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          void calls.signal(who, "offer", JSON.stringify(offer));
        } catch (err) {
          console.warn("[same-moon] could not make an offer", err);
          setConnection("failed");
        }
      }

      building.current = false;
      // Anything that arrived while the camera was warming up is waiting.
      void pump();
    })();

    return () => {
      cancelled = true;
    };
  }, [call.status, call.caller, who, joined, getMedia, teardown, pump]);

  useEffect(() => teardown, [teardown]);

  // --- ringing ---------------------------------------------------------------

  // `joined` keeps this to the device that actually made the call.
  const mine = call.status === "ringing" && call.caller === who && joined;
  const theirs = call.status === "ringing" && call.caller !== who && Boolean(who);
  // Measured against the server's clock, because the ring was stamped by it.
  const stale = theirs && call.at > 0 && serverNow() - call.at > STALE_RING_MS;

  // Ring out: nobody picked up, so stop asking.
  useEffect(() => {
    if (!mine) return;
    const timer = setTimeout(() => {
      setUnanswered(true);
      void calls.hangUp();
    }, RING_MS);
    return () => clearTimeout(timer);
  }, [mine]);

  // A ring can go stale while it is on screen, so look again when it would.
  useEffect(() => {
    if (!theirs || stale || call.at <= 0) return;
    const left = STALE_RING_MS - (serverNow() - call.at);
    const timer = setTimeout(() => tick((n) => n + 1), Math.max(500, left + 250));
    return () => clearTimeout(timer);
  }, [theirs, stale, call.at]);

  // Whoever left it ringing is not coming back to cancel it.
  useEffect(() => {
    if (stale) void calls.hangUp();
  }, [stale]);

  useEffect(() => {
    if (mine) return startRing("outgoing");
    if (theirs && !stale) return startRing("incoming");
  }, [mine, theirs, stale]);

  // --- controls -------------------------------------------------------------

  const start = useCallback(async () => {
    if (!who) return;
    setError(null);
    setUnanswered(false);
    setFinished(null);
    if (!(await getMedia())) return;
    // A call this device is not part of is either on another device or was
    // never hung up. Either way it is in the way of this one, so it goes.
    if (call.status === "live" && !engaged.current) await calls.hangUp();
    engage();
    await calls.ring(who);
    // If the ring never lands there is no call to end, so nothing would ever
    // switch the camera back off. Give it a moment, then give up out loud.
    setTimeout(() => {
      if (engaged.current && before.current === "idle") {
        teardown();
        setError("The call could not be placed. Check your connection and try again.");
      }
    }, PLACE_MS);
  }, [who, getMedia, engage, teardown, call.status]);

  const accept = useCallback(async () => {
    if (!who) return;
    setError(null);
    setFinished(null);
    if (!(await getMedia())) return;
    engage();
    await calls.accept(who);
  }, [who, getMedia, engage]);

  const hangUp = useCallback(async () => {
    await calls.hangUp();
    teardown();
  }, [teardown]);

  /** Close the "no answer" screen, or an error that came up before any call. */
  const dismiss = useCallback(() => {
    setUnanswered(false);
    setError(null);
    teardown();
  }, [teardown]);

  const clearFinished = useCallback(() => setFinished(null), []);

  const toggleMic = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    const next = !tracks.every((t) => t.enabled);
    for (const t of tracks) t.enabled = next;
    setMicOn(next);
  }, []);

  const toggleCam = useCallback(() => {
    const tracks = localRef.current?.getVideoTracks() ?? [];
    const next = !tracks.every((t) => t.enabled);
    for (const t of tracks) t.enabled = next;
    setCamOn(next);
  }, []);

  /**
   * Swap between the front and back camera without dropping the call.
   *
   * A phone will only run one camera at a time, so the old one has to be let
   * go before the new one is asked for. If the new one will not open, the old
   * one is asked for again, so a failed flip never leaves them with no picture.
   */
  const flip = useCallback(async () => {
    const stream = localRef.current;
    if (!stream) return;
    const next: Facing = facing === "user" ? "environment" : "user";
    const open = (which: Facing) =>
      navigator.mediaDevices.getUserMedia({ video: { facingMode: which }, audio: false });

    const old = stream.getVideoTracks()[0];
    const wasOn = old ? old.enabled : true;
    old?.stop();

    let fresh: MediaStream;
    let landed = next;
    try {
      fresh = await open(next);
    } catch {
      try {
        fresh = await open(facing);
        landed = facing;
      } catch (err) {
        console.warn("[same-moon] could not reopen the camera", err);
        setError("The camera would not switch. Hang up and call again.");
        return;
      }
    }

    const track = fresh.getVideoTracks()[0];
    if (!track) return;
    track.enabled = wasOn;
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video" || s.track === old);
    if (sender) await sender.replaceTrack(track).catch(() => {});

    const merged = new MediaStream([...stream.getAudioTracks(), track]);
    localRef.current = merged;
    setLocalStream(merged);
    setFacing(landed);
  }, [facing]);

  // --- what the panel shows -------------------------------------------------

  let phase: CallPhase = "idle";
  if (mine) phase = "ringing";
  else if (theirs) phase = stale ? "idle" : "incoming";
  else if (call.status === "live") {
    // A call on some other device is none of this one's business.
    if (joined) {
      phase = connection === "live" ? "live" : connection === "failed" ? "failed" : "connecting";
    }
  } else if (unanswered) phase = "unanswered";

  return {
    available: calls.available,
    phase,
    caller: call.caller,
    localStream,
    remoteStream,
    micOn,
    camOn,
    /** True when the picture is from the front camera, which is shown mirrored. */
    mirrored: facing === "user",
    canFlip,
    liveSince,
    finished,
    error,
    start,
    accept,
    hangUp,
    dismiss,
    clearFinished,
    toggleMic,
    toggleCam,
    flip,
  };
}
