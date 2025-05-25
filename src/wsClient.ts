type WSMessage = { type: string; [key: string]: any };
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
      this.queue.forEach((msg) => this.ws.send(msg));
      this.queue = [];
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.listeners.forEach((cb) => cb(data));
    };

    this.ws.onclose = () => {
      this.isOpen = false;
      // Можно реализовать авто-реконнект при необходимости
    };
  }

  send(msg: WSMessage) {
    const str = JSON.stringify(msg);
    if (this.isOpen) {
      this.ws.send(str);
    } else {
      this.queue.push(str);
    }
  }

  subscribe(cb: WSListener) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }
}

export const wsClient = new WSClient("ws://localhost:8080");