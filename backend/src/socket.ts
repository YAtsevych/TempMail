import { Server } from "socket.io";

let _io: Server | null = null;

export function initIo(server: Server): void {
  _io = server;
}

export function getIo(): Server {
  if (!_io)
    throw new Error("Socket.io не инициализирован. Вызови initIo() сначала.");
  return _io;
}
