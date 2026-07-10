import { useEffect, useRef, useState } from 'react';
import {
  pairKey,
  subscribeVoicePeers,
  joinVoicePeers,
  leaveVoicePeers,
  writeSignal,
  listenSignal,
  clearSignal,
  addIceCandidate,
  listenIceCandidates
} from './voiceApi';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function VoiceChat({ code, uid, players }) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peerIds, setPeerIds] = useState([]);
  const [connectedIds, setConnectedIds] = useState([]);
  const [err, setErr] = useState('');

  const localStreamRef = useRef(null);
  const connectionsRef = useRef({}); // uid -> { pc, unsubs: [fn,...] }
  const audioRefs = useRef({}); // uid -> <audio> element

  useEffect(() => {
    if (!joined) return undefined;
    const unsub = subscribeVoicePeers(code, (ids) => setPeerIds(ids.filter((id) => id !== uid)));
    return unsub;
  }, [joined, code, uid]);

  useEffect(() => {
    if (!joined) return;
    for (const peerId of peerIds) {
      if (!connectionsRef.current[peerId]) {
        connectToPeer(peerId);
      }
    }
    // Отключаем связи с теми, кто вышел из голосового чата
    for (const existingId of Object.keys(connectionsRef.current)) {
      if (!peerIds.includes(existingId)) {
        teardownPeer(existingId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerIds, joined]);

  function teardownPeer(peerId) {
    const entry = connectionsRef.current[peerId];
    if (!entry) return;
    entry.unsubs.forEach((fn) => fn());
    try { entry.pc.close(); } catch (e) { /* noop */ }
    delete connectionsRef.current[peerId];
    delete audioRefs.current[peerId];
    setConnectedIds((ids) => ids.filter((id) => id !== peerId));
  }

  function connectToPeer(peerId) {
    const key = pairKey(uid, peerId);
    const amInitiator = uid < peerId;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      let el = audioRefs.current[peerId];
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        document.body.appendChild(el);
        audioRefs.current[peerId] = el;
      }
      el.srcObject = stream;
      setConnectedIds((ids) => (ids.includes(peerId) ? ids : [...ids, peerId]));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) addIceCandidate(code, key, uid, event.candidate.toJSON());
    };

    let offerApplied = false;
    let answerApplied = false;

    const unsubSignal = listenSignal(code, key, async (data) => {
      try {
        if (!amInitiator && data.offer && !offerApplied) {
          offerApplied = true;
          await pc.setRemoteDescription({ type: 'offer', sdp: data.offer });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await writeSignal(code, key, { answer: answer.sdp });
        } else if (amInitiator && data.answer && !answerApplied && pc.signalingState !== 'stable') {
          answerApplied = true;
          await pc.setRemoteDescription({ type: 'answer', sdp: data.answer });
        }
      } catch (e) {
        setErr('Ошибка голосового соединения: ' + e.message);
      }
    });

    const unsubCandidates = listenIceCandidates(code, key, uid, (candidate) => {
      pc.addIceCandidate(candidate).catch(() => {});
    });

    connectionsRef.current[peerId] = { pc, unsubs: [unsubSignal, unsubCandidates] };

    if (amInitiator) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await writeSignal(code, key, { offer: offer.sdp });
        } catch (e) {
          setErr('Не удалось начать голосовой звонок: ' + e.message);
        }
      })();
    }
  }

  async function handleJoin() {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      await joinVoicePeers(code, uid);
      setJoined(true);
    } catch (e) {
      setErr('Нет доступа к микрофону: ' + e.message);
    }
  }

  async function handleLeave() {
    const peerIdsToClean = Object.keys(connectionsRef.current);
    peerIdsToClean.forEach(teardownPeer);
    await Promise.all(peerIdsToClean.map((peerId) => clearSignal(code, pairKey(uid, peerId)).catch(() => {})));
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    await leaveVoicePeers(code, uid);
    setJoined(false);
    setConnectedIds([]);
    setPeerIds([]);
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const next = !muted;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  useEffect(() => {
    return () => {
      // при размонтировании компонента (выход из комнаты) — аккуратно всё закрыть
      if (joined) handleLeave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="voice-chat">
      {!joined ? (
        <button className="voice-btn" onClick={handleJoin} type="button">🎤 Войти в голосовой чат</button>
      ) : (
        <div className="voice-active">
          <button className={`voice-btn ${muted ? 'muted' : 'on'}`} onClick={toggleMute} type="button">
            {muted ? '🔇 Микрофон выкл.' : '🎤 Микрофон вкл.'}
          </button>
          <button className="secondary" onClick={handleLeave} type="button">Выйти из голоса</button>
          <div className="voice-participants">
            {connectedIds.length > 0
              ? `На связи: ${connectedIds.map((id) => players?.[id]?.name || '?').join(', ')}`
              : 'Ждём, пока подключатся остальные…'}
          </div>
        </div>
      )}
      {err && <div className="error voice-error">{err}</div>}
    </div>
  );
}
