"use client";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMicrophoneAccess } from "./useMicrophoneAccess";
import { base64DecodeOpus, base64EncodeOpus } from "./audioUtil";
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
import { COOKIE_CONSENT_STORAGE_KEY } from "./ConsentModal";
import { IntiFloatingLogo } from "./IntiFloatingLogo";
import { IntiTextChatSecure as IntiTextChat } from "./components/IntiTextChatSecure";
import { useAuth } from "./components/IntiCommunicationProvider";
import { useUCOMessageFormatter } from "./hooks/useUCOMessageFormatter";
import { useUCO } from "./hooks/useUCO";
import { buildUCOSystemPrompt, buildUCOSmalltalkInstructions } from "./prompts/ucoSystemPrompt";

const Unmute = () => {
  const { user } = useAuth();
  const { isDevMode, showSubtitles, toggleSubtitles } = useKeyboardShortcuts();
  const { formatMessageWithUCO, reset: resetUCO, getTokenStats, isUCOReady, getUCOStatus } = useUCOMessageFormatter();
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

        const response = await fetch(`${backendServerUrl}/v1/health`, {
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

  const socketUrl = shouldConnect ? webSocketUrl : null;
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
    }
  );

  const commitAndRequestResponse = useCallback(() => {
    try {
      console.log('[VoiceWS] Committing audio buffer and requesting response');
      sendMessage(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      sendMessage(JSON.stringify({ type: 'response.create' }));
    } catch (e) {
      console.warn('[VoiceWS] Failed to commit/request response:', e);
    }
  }, [sendMessage]);

  // UCO integration helpers
  const { uco, getMinimalMarkdown } = useUCO();
  const sentInitialUCORef = useRef<boolean>(false);
  
  // Add debug effect to track UCO status
  useEffect(() => {
    if (isDevMode) {
      const status = getUCOStatus();
      console.log('[UCO Debug] Current UCO status:', status);
    }
  }, [uco, isDevMode, getUCOStatus]);

  const sendUCOItem = useCallback((payload: any) => {
    try {
      if (!payload) return;
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const msg = {
        type: "conversation.item.create",
        item: {
          role: "user",
          content: [
            { type: "input_text", text: `UCO:\n${text}` }
          ]
        }
      } as any;
      // realtime UCO disabled
    } catch (e) {
      console.warn('[UCO] Failed to send UCO item:', e);
    }
  }, [sendMessage]);

  // Send microphone audio to the server (via useAudioProcessor below)
  const onOpusRecorded = useCallback(
    (opus: Uint8Array) => {
      if (!sessionReadyRef.current) {
        // Drop audio frames until session is confirmed ready
        return;
      }
      sendMessage(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: base64EncodeOpus(opus),
        })
      );
    },
    [sendMessage]
  );

  const { setupAudio, shutdownAudio, audioProcessor } =
    useAudioProcessor(onOpusRecorded);
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
    if (data.type === 'session.updated') {
      console.log('[VoiceWS] Received session.updated, enabling audio send');
      setSessionReady(true);
      sessionReadyRef.current = true;
      return;
    }
    if (data.type === 'input_audio_buffer.speech_stopped') {
      // End of utterance detected by server VAD; trigger inference
      commitAndRequestResponse();
    } else if (data.type === "response.audio.delta") {
      const opus = base64DecodeOpus(data.delta);
      const ap = audioProcessor.current;
      if (!ap) return;

      ap.decoder.postMessage(
        {
          command: "decode",
          pages: opus,
        },
        [opus.buffer]
      );
    } else if (data.type === "unmute.additional_outputs") {
      setDebugDict(data.args.debug_dict);
    } else if (data.type === "error") {
      if (data.error.type === "warning") {
        console.warn(`Warning from server: ${data.error.message}`, data);
        // Warnings aren't explicitly shown in the UI
      } else {
        console.error(`Error from server: ${data.error.message}`, data);
        setErrors((prev) => [...prev, makeErrorItem(data.error.message)]);
      }
    } else if (
      data.type === "conversation.item.input_audio_transcription.delta"
    ) {
      // Transcription of the user speech
      setRawChatHistory((prev) => [
        ...prev,
        { role: "user", content: data.delta },
      ]);
    } else if (data.type === "response.text.delta") {
      // Text-to-speech output
      setRawChatHistory((prev) => [
        ...prev,
        // The TTS doesn't include spaces in its messages, so add a leading space.
        // This way we'll get a leading space at the very beginning of the message,
        // but whatever.
        { role: "assistant", content: " " + data.delta },
      ]);
    } else {
      const ignoredTypes = [
        "response.created",
        "response.text.delta",
        "response.text.done",
        "response.audio.done",
        "conversation.item.input_audio_transcription.delta",
        "input_audio_buffer.speech_started",
        "unmute.interrupted_by_vad",
        "unmute.response.text.delta.ready",
        "unmute.response.audio.delta.ready",
      ];
      if (!ignoredTypes.includes(data.type)) {
        console.warn("Received unknown message:", data);
      }
    }
  }, [audioProcessor, lastMessage]);

  // When we connect, we send the initial config (voice and instructions) to the server.
  // Also clear the chat history.
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;

    const recordingConsent =
      localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === "true";

    setRawChatHistory([]);
    resetUCO(); // Reset UCO formatter for new conversation
    setSessionReady(false);
    sessionReadyRef.current = false;
    
    // Build UCO-aware system prompt based on instruction type
    let ucoInstructions;
    if (unmuteConfig.instructions.type === "constant") {
      ucoInstructions = {
        type: "constant",
        text: buildUCOSystemPrompt(unmuteConfig.instructions.text, unmuteConfig.instructions.language || "en"),
        language: unmuteConfig.instructions.language
      };
    } else if (unmuteConfig.instructions.type === "smalltalk") {
      ucoInstructions = {
        type: "constant",
        text: buildUCOSystemPrompt(
          buildUCOSmalltalkInstructions(),
          unmuteConfig.instructions.language || "en"
        ),
        language: unmuteConfig.instructions.language
      };
    } else {
      // For other types, keep original with UCO basics added
      ucoInstructions = unmuteConfig.instructions;
    }
    console.log('[VoiceWS] Sending session.update');
    sendMessage(
      JSON.stringify({
        type: "session.update",
        session: {
          instructions: ucoInstructions,
          voice: unmuteConfig.voice,
          allow_recording: recordingConsent,
        },
      })
    );

    // After session setup, wait for UCO readiness before sending initial context
    const sendInitialUCOWhenReady = () => {
      if (sentInitialUCORef.current) return;
      
      try {
        const fm: any = formatMessageWithUCO('', 'session_start', true, true); // waitForReady=true
        
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
          const ucoPayload = fm.uco || fm.ucoDelta;
          if (ucoPayload) {
            console.log('[UCO] Successfully sent initial UCO context to LLM');
            /* realtime UCO disabled */
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
  }, [unmuteConfig, readyState, sendMessage, resetUCO, formatMessageWithUCO]);

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
          /* realtime UCO disabled */
        }
      }
    } catch {
      // ignore
    }
  }, [uco, readyState, formatMessageWithUCO, sendUCOItem]);

  // Disconnect when the voice or instruction changes.
  // TODO: If it's a voice change, immediately reconnect with the new voice.
  useEffect(() => {
    setShouldConnect(false);
    shutdownAudio();
  }, [shutdownAudio, unmuteConfig.voice, unmuteConfig.instructions]);

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


