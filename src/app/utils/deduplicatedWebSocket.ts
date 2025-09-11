// Deduplicated WebSocket Wrapper
// Prevents duplicate WebSocket messages and provides intelligent throttling
// File: src/app/utils/deduplicatedWebSocket.ts

'use client';

interface MessageQueue {
  message: any;
  timestamp: number;
  attempts: number;
}

interface SentMessage {
  timestamp: number;
  hash: string;
}

export class DeduplicatedWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private sentMessages = new Map<string, SentMessage>();
  private messageQueue: MessageQueue[] = [];
  private readonly debounceMs = 100;
  private readonly maxRetries = 3;
  private readonly messageTTL = 5000; // 5 seconds
  private cleanupInterval?: NodeJS.Timeout;
  
  private listeners = {
    onOpen: [] as ((event: Event) => void)[],
    onMessage: [] as ((event: MessageEvent) => void)[],
    onError: [] as ((event: Event) => void)[],
    onClose: [] as ((event: CloseEvent) => void)[]
  };

  constructor(url: string) {
    this.url = url;
    this.startCleanup();
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventListeners();
    } catch (error) {
      console.error('[WS] Failed to create WebSocket:', error);
    }
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = (event) => {
      console.log('[WS] Connected');
      this.processQueuedMessages();
      this.listeners.onOpen.forEach(listener => listener(event));
    };

    this.ws.onmessage = (event) => {
      this.listeners.onMessage.forEach(listener => listener(event));
    };

    this.ws.onerror = (event) => {
      console.error('[WS] Error:', event);
      this.listeners.onError.forEach(listener => listener(event));
    };

    this.ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      this.listeners.onClose.forEach(listener => listener(event));
    };
  }

  private generateMessageHash(message: any): string {
    // Create a hash from message content for deduplication
    const messageString = typeof message === 'string' ? message : JSON.stringify(message);
    let hash = 0;
    for (let i = 0; i < messageString.length; i++) {
      const char = messageString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private shouldSkipMessage(message: any): boolean {
    const hash = this.generateMessageHash(message);
    const sent = this.sentMessages.get(hash);
    
    if (!sent) return false;
    
    // Skip if sent recently
    const timeSinceSent = Date.now() - sent.timestamp;
    if (timeSinceSent < this.debounceMs) {
      console.log('[WS] Skipping duplicate message:', message.type || 'unknown');
      return true;
    }
    
    return false;
  }

  send(message: any, priority: 'high' | 'normal' | 'low' = 'normal'): boolean {
    // Skip duplicate messages
    if (this.shouldSkipMessage(message)) {
      return false;
    }

    // Queue message if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queueMessage(message);
      return false;
    }

    return this.sendImmediate(message);
  }

  private sendImmediate(message: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(messageString);
      
      // Track sent message
      const hash = this.generateMessageHash(message);
      this.sentMessages.set(hash, {
        timestamp: Date.now(),
        hash
      });
      
      console.log('[WS] Sent message:', message.type || 'unknown');
      return true;
    } catch (error) {
      console.error('[WS] Failed to send message:', error);
      return false;
    }
  }

  private queueMessage(message: any): void {
    this.messageQueue.push({
      message,
      timestamp: Date.now(),
      attempts: 0
    });
    
    // Limit queue size
    if (this.messageQueue.length > 50) {
      this.messageQueue.shift(); // Remove oldest message
    }
    
    console.log('[WS] Queued message:', message.type || 'unknown');
  }

  private processQueuedMessages(): void {
    const now = Date.now();
    const messagesToSend = this.messageQueue.filter(item => {
      // Skip expired messages
      if (now - item.timestamp > this.messageTTL) {
        return false;
      }
      
      // Skip messages that exceeded retry limit
      if (item.attempts >= this.maxRetries) {
        return false;
      }
      
      return true;
    });

    // Send queued messages
    for (const item of messagesToSend) {
      item.attempts++;
      if (this.sendImmediate(item.message)) {
        // Remove sent message from queue
        const index = this.messageQueue.indexOf(item);
        if (index > -1) {
          this.messageQueue.splice(index, 1);
        }
      }
    }
  }

  // Event listeners
  addEventListener(type: 'open', listener: (event: Event) => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'error', listener: (event: Event) => void): void;
  addEventListener(type: 'close', listener: (event: CloseEvent) => void): void;
  addEventListener(type: string, listener: any): void {
    switch (type) {
      case 'open':
        this.listeners.onOpen.push(listener);
        break;
      case 'message':
        this.listeners.onMessage.push(listener);
        break;
      case 'error':
        this.listeners.onError.push(listener);
        break;
      case 'close':
        this.listeners.onClose.push(listener);
        break;
    }
  }

  removeEventListener(type: string, listener: any): void {
    switch (type) {
      case 'open':
        const openIndex = this.listeners.onOpen.indexOf(listener);
        if (openIndex > -1) this.listeners.onOpen.splice(openIndex, 1);
        break;
      case 'message':
        const messageIndex = this.listeners.onMessage.indexOf(listener);
        if (messageIndex > -1) this.listeners.onMessage.splice(messageIndex, 1);
        break;
      case 'error':
        const errorIndex = this.listeners.onError.indexOf(listener);
        if (errorIndex > -1) this.listeners.onError.splice(errorIndex, 1);
        break;
      case 'close':
        const closeIndex = this.listeners.onClose.indexOf(listener);
        if (closeIndex > -1) this.listeners.onClose.splice(closeIndex, 1);
        break;
    }
  }

  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.sentMessages.clear();
    this.messageQueue = [];
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get url(): string {
    return this.ws?.url ?? this.url;
  }

  // Cleanup expired messages
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      // Clean expired sent messages
      for (const [hash, sent] of this.sentMessages.entries()) {
        if (now - sent.timestamp > this.messageTTL) {
          this.sentMessages.delete(hash);
        }
      }
      
      // Clean expired queued messages
      this.messageQueue = this.messageQueue.filter(item => 
        now - item.timestamp < this.messageTTL
      );
    }, 10000); // Clean every 10 seconds
  }

  // Get connection stats
  getStats() {
    return {
      readyState: this.readyState,
      sentMessagesCount: this.sentMessages.size,
      queuedMessagesCount: this.messageQueue.length,
      url: this.url
    };
  }
}