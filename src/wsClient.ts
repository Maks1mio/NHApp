/* src/wsClient.ts */
type WSMessage  = { type: string; [key: string]: any };
type WSListener = (msg: WSMessage) => void;

class WSClient {
  private ws: WebSocket;
  private listeners: WSListener[] = [];
  private isOpen = false;
  private queue: string[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.isOpen = true;
      this.queue.forEach((m) => this.ws.send(m));
      this.queue = [];
    };

    this.ws.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data);
      /* call all active listeners */
      this.listeners.forEach((cb) => cb(data));
    };

    this.ws.onclose = () => { this.isOpen = false; };
  }

  /** send JSON‐serialisable data */
  send(msg: WSMessage) {
    const str = JSON.stringify(msg);
    if (this.isOpen) this.ws.send(str);
    else             this.queue.push(str);
  }

  /** subscribe – returns an unsubscribe function */
  subscribe(cb: WSListener) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter((l) => l !== cb); };
  }

  /** subscribe once, then auto-unsubscribe after first matching event */
  once(eventType: string, cb: WSListener) {
    const unsubscribe = this.subscribe((msg) => {
      if (msg.type === eventType) {
        unsubscribe();   // remove listener
        cb(msg);         // call user callback
      }
    });
    return unsubscribe;  // in case caller wants to cancel beforehand
  }
}

export const wsClient = new WSClient("ws://localhost:8080");
