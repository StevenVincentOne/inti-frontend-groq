"use client";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMicrophoneAccess } from "./useMicrophoneAccess";
import { base64DecodeToUint8, base64EncodeBytes } from "./audioUtil";
import { useAudioProcessor as useAudioProcessor } from "./useAudioProcessor";
import useKeyboardShortcuts from "./useKeyboardShortcuts";
import { prettyPrintJson } from "pretty-print-json";
import PositionedAudioVisualizer from "./PositionedAudioVisualizer";
import {
  DEFAULT_UNMUTE_CONFIG,
  UnmuteConfig,
} from "./UnmuteConfigurator";
import CouldNotConnect, { HealthStatus } from "./CouldNotConnect";
import UnmuteHeader from "./UnmuteHeader";
import Subtitles from "./Subtitles";
import { ChatMessage, compressChatHistory } from "./chatHistory";
import useWakeLock from "./useWakeLock";
import ErrorMessages, { ErrorItem, makeErrorItem } from "./ErrorMessages";
import { useRecordingCanvas } from "./useRecordingCanvas";
import { useGoogleAnalytics } from "./useGoogleAnalytics";
import clsx from "clsx";
import { useBackendServerUrl } from "./useBackendServerUrl";
import { useRealtimeWebSocketUrl } from "./useRealtimeWebSocketUrl";
import { IntiFloatingLogo } from "./IntiFloatingLogo";
import { IntiTextChatSecure as IntiTextChat } from "./components/IntiTextChatSecure";
import { useAuth } from "./components/IntiCommunicationProvider";
import { useUCOMessageFormatter } from "./hooks/useUCOMessageFormatter";
import { useUCO } from "./hooks/useUCO";

const PCM_BYTES_PER_SAMPLE = 2;
const PCM_SAMPLE_RATE = 24000;
const isLikelyOgg = (bytes: Uint8Array) =>
  bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;

const uint8PcmToFloat32 = (pcmBytes: Uint8Array) => {
  const sampleCount = Math.floor(pcmBytes.byteLength / PCM_BYTES_PER_SAMPLE);
  const float32 = new Float32Array(sampleCount);
  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount * PCM_BYTES_PER_SAMPLE);
  for (let i = 0; i < sampleCount; i += 1) {
    const int16 = view.getInt16(i * PCM_BYTES_PER_SAMPLE, true);
    float32[i] = int16 / 32768;
  }
  return float32;
};

const Unmute = () => {
  const { user } = useAuth();
  const { isDevMode, showSubtitles, toggleSubtitles } = useKeyboardShortcuts();
  const { formatMessageWithUCO, reset: resetUCO, getUCOStatus } = useUCOMessageFormatter();
  const [debugDict, setDebugDict] = useState<object | null>(null);
  const [unmuteConfig, setUnmuteConfig] = useState<UnmuteConfig>(
    DEFAULT_UNMUTE_CONFIG
  );
  const [rawChatHistory, setRawChatHistory] = useState<ChatMessage[]>([]);
  const chatHistory = compressChatHistory(rawChatHistory);

  const { microphoneAccess, askMicrophoneAccess } = useMicrophoneAccess();

  const [shouldConnect, setShouldConnect] = useState(false);
  const backendServerUrl = useBackendServerUrl();
  const webSocketUrl = useRealtimeWebSocketUrl();
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [showIntiViz, setShowIntiViz] = useState(true);
  const [showUserViz, setShowUserViz] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const sessionReadyRef = useRef(false);
  const sessionInitializedRef = useRef<boolean>(false);
  // const [showLiveText, setShowLiveText] = useState(false);

  useWakeLock(shouldConnect);
  const { analyticsOnDownloadRecording } = useGoogleAnalytics({
    shouldConnect,
    unmuteConfig,
  });

  // Check if the backend server is healthy. If we setHealthStatus to null,
  // a "server is down" screen will be shown.
  useEffect(() => {
    if (!backendServerUrl) return;

    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${backendServerUrl}/health`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (!response.ok) {
          setHealthStatus({
            connected: "yes_request_fail",
            ok: false,
          });
          return;
        }
        const data = await response.json();
        data["connected"] = "yes_request_ok";

        if (data.ok && !data.voice_cloning_up) {
          console.debug("Voice cloning not available, hiding upload button.");
        }
        setHealthStatus(data);
      } catch {
        setHealthStatus({
          connected: "no",
          ok: false,
        });
      }
    };

    checkHealth();
  }, [backendServerUrl]);

  // Always negotiate the required Realtime subprotocol in production to avoid
  // handshake failures caused by local overrides.
  const realtimeProtocols = (() => {
    const isProd = typeof window !== 'undefined' && /(^|\.)intellipedia\.ai$/i.test(window.location.hostname);
    if (isProd) {
      return ['realtime'];
    }
    // In non-prod, allow an explicit override via localStorage for debugging
    try {
      if (typeof window !== 'undefined') {
        const override = localStorage.getItem('INTI_WS_SUBPROTOCOL');
        if (override !== null) {
          const val = override.trim();
          if (val.length === 0 || val.toLowerCase() === 'none') return undefined;
          return [val];
        }
      }
    } catch {}
    const envVal = (process.env.NEXT_PUBLIC_REALTIME_SUBPROTOCOL || 'realtime').trim();
    if (envVal.length === 0 || envVal.toLowerCase() === 'none') return undefined;
    return [envVal];
  })();

  // Only connect if we have both shouldConnect AND a valid WebSocket URL
  const socketUrl = (shouldConnect && webSocketUrl) ? webSocketUrl : null;

  // Additional safety: Ensure URL is production URL
  // Debug logging for WebSocket URL
  useEffect(() => {
    console.log('[VoiceWS] Debug - shouldConnect:', shouldConnect, 'webSocketUrl:', webSocketUrl, 'socketUrl:', socketUrl);
  }, [shouldConnect, webSocketUrl, socketUrl]);
  
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    socketUrl,
    {
      protocols: realtimeProtocols,
      onOpen: () => {
        console.log('[VoiceWS] onOpen: connection established');
      },
      onClose: (event) => {
        console.log('[VoiceWS] onClose:', event.code, event.reason || '(no reason)');
      },
      // IMPORTANT: Don't attempt connection if URL is null
      shouldReconnect: () => socketUrl !== null,
      reconnectAttempts: socketUrl ? 10 : 0,
      reconnectInterval: socketUrl ? 3000 : 0,
    }
  );

  // Keep latest deps in refs to avoid effect re-runs on identity changes
  const resetUCORef = useRef(resetUCO);
  useEffect(() => { resetUCORef.current = resetUCO; }, [resetUCO]);
  const formatMessageWithUCORef = useRef(formatMessageWithUCO);
  useEffect(() => { formatMessageWithUCORef.current = formatMessageWithUCO; }, [formatMessageWithUCO]);
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  const sendJsonMessage = useCallback((payload: Record<string, any>) => {
    try {
      const json = JSON.stringify(payload);
      sendMessageRef.current(json);
    } catch (err) {
      console.error('[VoiceWS] Failed to send payload', payload, err);
    }
  }, []);

  // Removed commitAndRequestResponse - backend uses server-side VAD and triggers inference automatically

  // UCO integration helpers
  const { uco } = useUCO();
  const sentInitialUCORef = useRef<boolean>(false);
  
  // Add debug effect to track UCO status
  useEffect(() => {
    if (isDevMode) {
      const status = getUCOStatus();
      console.log('[UCO Debug] Current UCO status:', status);
    }
  }, [uco, isDevMode, getUCOStatus]);

  // Send microphone audio to the server (via useAudioProcessor below)
  const onPcmRecorded = useCallback(
    (pcm: Uint8Array) => {
      console.log('[VoiceWS] 🎤 onPcmRecorded called - audio data:', pcm.length, 'bytes, sessionReady:', sessionReadyRef.current);

      if (!sessionReadyRef.current) {
        console.log('[VoiceWS] ⚠️ DROPPING audio frame - session not ready');
        return;
      }

      sendJsonMessage({
        type: "input_audio",
        data: base64EncodeBytes(pcm),
        sample_rate: PCM_SAMPLE_RATE,
        channels: 1,
      });
    },
    [sendJsonMessage]
  );

  const { setupAudio, shutdownAudio, audioProcessor } =
    useAudioProcessor(onPcmRecorded);
  const {
    canvasRef: recordingCanvasRef,
    downloadRecording,
    recordingAvailable,
  } = useRecordingCanvas({
    size: 1080,
    shouldRecord: shouldConnect,
    audioProcessor: audioProcessor.current,
    chatHistory: rawChatHistory,
  });

  const onConnectButtonPress = async () => {
    // If we're not connected yet
    if (!shouldConnect) {
      const mediaStream = await askMicrophoneAccess();
      // If we have access to the microphone:
      if (mediaStream) {
        await setupAudio(mediaStream);
        setShouldConnect(true);
      }
    } else {
      setShouldConnect(false);
      sendJsonMessage({ type: 'session_end' });
      shutdownAudio();
    }
  };

  const onDownloadRecordingButtonPress = () => {
    try {
      downloadRecording(false);
      analyticsOnDownloadRecording();
    } catch (e) {
      if (e instanceof Error) {
        setErrors((prev) => [...prev, makeErrorItem(e.message)]);
      }
    }
  };

  const onToggleChat = () => {
    setShowChat(prev => !prev);
  };

  const onToggleIntiViz = () => {
    setShowIntiViz(prev => !prev);
  };

  const onToggleUserViz = () => {
    setShowUserViz(prev => !prev);
  };

  //   const onToggleLiveText = () => {
  //     setShowLiveText(prev => !prev);
  //     console.log(`Live Text ${!showLiveText ? 'enabled' : 'disabled'}`);
  //   };

  // If the websocket connection is closed, shut down the audio processing
  useEffect(() => {
    if (readyState === ReadyState.CLOSING || readyState === ReadyState.CLOSED) {
      setShouldConnect(false);
      shutdownAudio();
    }
  }, [readyState, shutdownAudio]);

  // Handle incoming messages from the server
  useEffect(() => {
    if (lastMessage === null) return;

    const data = JSON.parse(lastMessage.data);
    if (data.type === 'session.ready') {
      console.log('[VoiceWS] Received session.ready, enabling audio send');
      setSessionReady(true);
      sessionReadyRef.current = true;
      return;
    }
    if (data.type === 'transcript') {
      const text = data.text ?? '';
      if (!text.trim()) {
        return;
      }

      setRawChatHistory((prev) => {
        const copy = [...prev];

        if (!copy.length || copy[copy.length - 1]?.role !== 'user') {
          return [...copy, { role: 'user', content: text }];
        }

        copy[copy.length - 1] = { role: 'user', content: text };
        return copy;
      });
      return;
    }
    if (data.type === 'assistant_text') {
      const text = data.text ?? '';
      if (!text.trim()) {
        return;
      }
      setRawChatHistory((prev) => [...prev, { role: 'assistant', content: text }]);
      return;
    }
    if (data.type === 'output_audio') {
      const payload = data.data as string | undefined;
      if (!payload) {
        return;
      }

      const audioBytes = base64DecodeToUint8(payload);
      const ap = audioProcessor.current;
      if (!ap) {
        return;
      }

      if (isLikelyOgg(audioBytes) && ap.decoder) {
        ap.decoder.postMessage(
          {
            command: "decode",
            pages: audioBytes,
          },
          [audioBytes.buffer]
        );
        return;
      }

      const pcmFrame = uint8PcmToFloat32(audioBytes);
      ap.outputWorklet.port.postMessage(
        {
          frame: pcmFrame,
          type: "audio",
          micDuration: 0,
        },
        [pcmFrame.buffer]
      );
      return;
    }
    if (data.type === "unmute.additional_outputs") {
      setDebugDict(data.args.debug_dict);
    } else if (data.type === "error") {
      if (data.error.type === "warning") {
        console.warn(`Warning from server: ${data.error.message}`, data);
        // Warnings aren't explicitly shown in the UI
      } else {
        console.error(`Error from server: ${data.error.message}`, data);
        setErrors((prev) => [...prev, makeErrorItem(data.error.message)]);
      }
    } else {
      console.warn("[VoiceWS] Received unsupported message", data);
    }
  }, [audioProcessor, lastMessage]);

  // When we connect, send the initial config once per connection and clear the chat history.
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    if (sessionInitializedRef.current) return; // prevent resend loop on rerenders
    sessionInitializedRef.current = true;

    setRawChatHistory([]);
    resetUCORef.current(); // Reset UCO formatter for new conversation
    setSessionReady(false);
    sessionReadyRef.current = false;
    if (typeof window !== 'undefined') {
      delete (window as any).__UCO_NOT_READY_LOGGED__;
    }

    // After session setup, wait for UCO readiness before sending initial context
    const sendInitialUCOWhenReady = () => {
      if (sentInitialUCORef.current) return;

      try {
        const fm: any = formatMessageWithUCORef.current('', 'session_start', true, true); // waitForReady=true
        
        if (typeof fm === 'object' && fm.status === 'not_ready') {
          // UCO not ready yet, try again in 1500ms (throttled)
          if ((window as any).__UCO_NOT_READY_LOGGED__ !== true) {
            console.log('[UCO] Not ready for initial send (throttled) ...');
            (window as any).__UCO_NOT_READY_LOGGED__ = true;
          }
          setTimeout(sendInitialUCOWhenReady, 1500);
          return;
        }
        
        if (typeof fm !== 'string') {
          const payload = fm.uco || fm.ucoDelta || fm;
          if (payload) {
            console.log('[UCO] Successfully sent initial UCO context to LLM');
            sendJsonMessage({
              type: 'input_text',
              text: `UCO:\n${JSON.stringify(payload, null, 2)}`,
            });
            sentInitialUCORef.current = true;
          }
        } else {
          console.log('[UCO] Initial UCO formatted as plain string, will retry');
          setTimeout(sendInitialUCOWhenReady, 500);
        }
      } catch (e) {
        console.warn('[UCO] Initial UCO send failed:', e);
        // Retry after error
        setTimeout(sendInitialUCOWhenReady, 1000);
      }
    };
    
    // Start the UCO readiness checking process
    sendInitialUCOWhenReady();
  }, [readyState]);

  // Reset session init guard when socket closes
  useEffect(() => {
    if (readyState === ReadyState.CLOSED || readyState === ReadyState.CLOSING) {
      sessionInitializedRef.current = false;
    }
  }, [readyState]);

  // Log socket state transitions for debugging
  useEffect(() => {
    console.log('[VoiceWS] readyState:', ReadyState[readyState], 'url:', socketUrl);
  }, [readyState, socketUrl]);

  // Send UCO deltas on subsequent UCO state updates during an open session
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    if (!sentInitialUCORef.current) return;
    try {
      const fm: any = formatMessageWithUCO('', 'navigation_change');
      if (typeof fm !== 'string') {
        const ucoPayload = fm.ucoDelta || fm.uco; // prefer delta
        if (ucoPayload && Object.keys(ucoPayload || {}).length > 0) {
          sendJsonMessage({
            type: 'input_text',
            text: `UCO_DELTA:\n${JSON.stringify(ucoPayload, null, 2)}`,
          });
        }
      }
    } catch {
      // ignore
    }
  }, [uco, readyState, formatMessageWithUCO, sendJsonMessage]);

  if (!healthStatus || !backendServerUrl) {
    return (
      <div className="flex flex-col gap-4 items-center">
        <h1 className="text-xl mb-4">Loading...</h1>
      </div>
    );
  }

  if (healthStatus && !healthStatus.ok) {
    return <CouldNotConnect healthStatus={healthStatus} />;
  }

  return (
    <div className="w-full" style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: "100vh", alignItems: "center" }}>
      <ErrorMessages errors={errors} setErrors={setErrors} />
      {/* The main full-height demo */}
      <div className="relative flex w-full min-h-screen flex-col text-gray-800 items-center" style={{background: 'var(--background)'}}>
        {/* z-index on the header to put it in front of the circles */}
        <header className="static md:absolute max-w-6xl px-3 md:px-8 right-0 flex justify-end z-10">
          <UnmuteHeader />
        </header>
        
        {/* Simple test message to verify workflow */}
        {user && (
          <div className="text-gray-800 text-xl font-semibold mt-8 mb-4 text-center z-20 drop-shadow-md">
            Welcome {user.displayName || user.username}!
          </div>
        )}
        
        <div
          className={clsx(
            "w-full h-auto min-h-75",
            "flex flex-row-reverse md:flex-row items-center justify-center grow",
            "-mt-10 md:mt-0 mb-10 md:mb-0 md:-mr-4"
          )}
        >
          <PositionedAudioVisualizer
            chatHistory={chatHistory}
            role={"assistant"}
            analyserNode={audioProcessor.current?.outputAnalyser || null}
            onCircleClick={onConnectButtonPress}
            isConnected={shouldConnect}
            isVisible={showIntiViz}
          />
          <PositionedAudioVisualizer
            chatHistory={chatHistory}
            role={"user"}
            analyserNode={audioProcessor.current?.inputAnalyser || null}
            isConnected={shouldConnect}
            isVisible={showUserViz}
            profileImageUrl={user?.profileImage || null} // Pass user profile image from Replit
          />
        </div>
        {showSubtitles && <Subtitles chatHistory={chatHistory} />}
        {/* Original buttons removed - functionality now in Inti LightBoard menu */}
        {microphoneAccess === "refused" && (
          <div className="text-red my-6 px-3 text-center">
            {"You'll need to allow microphone access to use the demo. " +
              "Please check your browser settings."}
          </div>
        )}
      </div>
      {/* Debug stuff, not counted into the screen height */}
      {isDevMode && (
        <div>
          <div className="text-xs w-full overflow-auto">
            <pre
              className="whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{
                __html: prettyPrintJson.toHtml(debugDict),
              }}
            ></pre>
          </div>
          <div>Subtitles: press S. Dev mode: press D.</div>
        </div>
      )}
      <canvas ref={recordingCanvasRef} className="hidden" />
      {/* Inti Text Chat Interface */}
      <IntiTextChat
        topicUuid={undefined} 
        isVisible={showChat} 
        onClose={() => setShowChat(false)} 
      />
      {/* Inti Floating Logo for LightBoard menu access */}
      <IntiFloatingLogo        
        onDownloadRecording={onDownloadRecordingButtonPress}
        onConnect={onConnectButtonPress}
        isConnected={shouldConnect}        
        recordingAvailable={recordingAvailable}
        unmuteConfig={unmuteConfig}
        onConfigChange={setUnmuteConfig}
        onToggleChat={onToggleChat}
        onToggleIntiViz={onToggleIntiViz}
        onToggleUserViz={onToggleUserViz}
        showIntiViz={showIntiViz}
        showUserViz={showUserViz}
        showSubtitles={showSubtitles}
        onToggleSubtitles={toggleSubtitles}
      />
      {/* Live Text Display */}
      {false && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40 bg-black/80 backdrop-blur-sm rounded-lg p-4 border border-white/10 max-w-4xl w-full mx-4">
          <div className="text-white text-sm">
            <div className="text-center text-white/60 text-xs mb-2">Live Text</div>
            <div className="space-y-1">
              {chatHistory.slice(-3).map((message, index) => (
                <div key={index} className={`${message.role === 'assistant' ? 'text-green-400' : 'text-blue-400'}`}>
                  <span className="font-medium">{message.role === 'assistant' ? 'Inti: ' : 'You: '}</span>
                  {message.content}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Unmute;





