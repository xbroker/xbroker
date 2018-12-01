/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

import ws from 'ws';

import type { XBrokerClient, XBrokerCommand, XBrokerResponse } from './XBrokerTypes';

import type { AgentType, Agent } from "./Agent";
import BaseAgent from './BaseAgent';
import type BrokerAgent from "./BrokerAgent";

export type SocketAgentAllOptions = {|
  type: 'socket',
  debug: boolean,
  verbose: boolean,

  batchIntervalMs: number,
  socketQueueSizeLimit: number,
  socketQueueSizeFlush: number,
  socketSendInProgressLimit: number,
  socketMonitoringIntervalMs: number,
  port: number,
  defaultAgent?: string,
|};  

export type SocketAgentOptions = {|
  type: 'socket',
  debug?: boolean,
  verbose?: boolean,

  batchIntervalMs?: number,
  socketQueueSizeLimit?: number,
  socketQueueSizeFlush?: number,
  socketSendInProgressLimit?: number,
  socketMonitoringIntervalMs?: number,
  port?: number,
  defaultAgent?: string,
|};

// tag -> XBrokerCommand
export type SocketAgentTags = {[string]: XBrokerCommand};

export type SocketAgentConnectionCallback = (err: number) => void;

export interface SocketAgentWebSocket {
  readyState: number;
  send(msg: string, callback: SocketAgentConnectionCallback): void;

  on('closed', callback: () => void): SocketAgentWebSocket;
  on('pong', callback: () => void): SocketAgentWebSocket;
  on('error', callback: (err: mixed) => void): SocketAgentWebSocket;
  on('message', callback: (msg: mixed) => void): SocketAgentWebSocket;

  ping(() => void): void;
  terminate(): void;
};

class SocketAgentConnection {
  webSocket: SocketAgentWebSocket;

  clientId: string; 
  responseQueue: Array<string>;
  responseQueueSize: number;
  responseQueueDiscarded: number;
  lastSentMs: number;
  sendInProgressCnt: number;
  sendInProgressSize: number;
  socketTimer: ?TimeoutID;
  isAlive: boolean;
  tags: SocketAgentTags;

  constructor(clientId: string, webSocket: SocketAgentWebSocket): void {
    this.clientId = clientId;
    this.webSocket = webSocket;
  }
}

// clientId -> SocketAgentConnection 
export type SocketAgentConnections = {[string]: SocketAgentConnection};

export interface SocketAgentWebSocketServer {
  clients: Array<WebSocket>;
  on(msg: string, (... data: Array<mixed>) => void): SocketAgentWebSocketServer;
  on('connection', socket: SocketAgentWebSocket): SocketAgentWebSocketServer;
  close(): void;
}

export const socketAgentDefaultOptions: SocketAgentAllOptions = {
  type: 'socket',
  debug: false,
  verbose: false,

  batchIntervalMs: 100,
  socketQueueSizeLimit: 1*1024*1024, // in UTF-16 characters
  socketQueueSizeFlush: 128*1024, // in UTF-16 characters
  socketSendInProgressLimit: 8,
  socketMonitoringIntervalMs: 30000, // checking if socket is alive
  port: 3500,
};

export default class SocketAgent extends BaseAgent<'socket', SocketAgentAllOptions> {
  clientIdSeq: number;
  connections: SocketAgentConnections;
  webSocketServer: SocketAgentWebSocketServer;
  timer: ?IntervalID;  

  constructor(broker: BrokerAgent, name: string, options: ?SocketAgentOptions): void {

    super('socket', name, SocketAgent.buildOptions(options), broker);
    
    this.start()
  }

  static buildOptions(someOptions: ?SocketAgentOptions): SocketAgentAllOptions {
    let options: ?SocketAgentAllOptions;

    if(someOptions) {
      options = {... socketAgentDefaultOptions, ... someOptions};
    } else {
      options = {... socketAgentDefaultOptions};
    }

    return options;
  }

  flushBatch(socket: SocketAgentConnection): void {
    const sentMs = new Date().getTime();
    if(socket.lastSentMs <= 0) {
      socket.lastSentMs = sentMs;
    }
    const deltaMs = sentMs - socket.lastSentMs;
    socket.lastSentMs = sentMs;

    const queue: Array<string> = [];
    let queueSize = 0;

    while(socket.responseQueue.length > 0 && queueSize < this.options.socketQueueSizeFlush) {
      const msg = socket.responseQueue.shift();
      socket.responseQueueSize -= msg.length;
      queue.push(msg);
      queueSize += msg.length;
    }
    socket.sendInProgressCnt++;
    socket.sendInProgressSize += queueSize;

    const callback: SocketAgentConnectionCallback = (err: mixed) => {
      socket.sendInProgressCnt--;
      socket.sendInProgressSize -= queueSize;
      if(this.options.verbose) {
        const callbackMs = Date.now();
        const callbackDeltaMs = callbackMs - sentMs;
        const errorMsg: string = String(err);

        this.info(errorMsg+deltaMs+"/"+callbackDeltaMs+
          " sent "+queue.length+"/"+queueSize+
          ", pending "+socket.responseQueue.length+"/"+socket.responseQueueSize+
          ", discarded "+socket.responseQueueDiscarded+
          ", in progress "+socket.sendInProgressCnt+"/"+socket.sendInProgressSize);
      }
      socket.responseQueueDiscarded = 0;
    };

    try {
      const respStr: string = JSON.stringify(queue);
      socket.webSocket.send(respStr, callback);
    } catch(e) {
      callback(e);
    }
  }

  flush(socket: SocketAgentConnection): void {
    while(socket.webSocket.readyState === ws.OPEN && socket.sendInProgressCnt < this.options.socketSendInProgressLimit) {
      this.flushBatch(socket);
      if(socket.responseQueueSize < this.options.socketQueueSizeFlush) {
        break;
      }
    }
  }

  forceFlush(socket: SocketAgentConnection): void {
    while(socket.webSocket.readyState === ws.OPEN && socket.responseQueueSize > 0) {
      this.flushBatch(socket);
    }
  }

  sendResponse(socket: SocketAgentConnection, msgStr: string): void {
    socket.responseQueue.push(msgStr);
    socket.responseQueueSize += msgStr.length;
    while(socket.responseQueueSize >= this.options.socketQueueSizeLimit) {
      const removedMsgStr = socket.responseQueue.shift();
      socket.responseQueueSize -= removedMsgStr.length;
      socket.responseQueueDiscarded += removedMsgStr.length;
    }
    if(socket.responseQueueSize >= this.options.socketQueueSizeFlush) {
      if(socket.socketTimer) {
        clearTimeout(socket.socketTimer);
        socket.socketTimer = null;
      }
      this.flush(socket);
    }
    if(!socket.socketTimer && socket.responseQueueSize >= 0) {
      socket.socketTimer = setTimeout(() => {
        socket.socketTimer = null;
        this.flush(socket);
      }, this.options.batchIntervalMs)
    }
  }

  setupConnection(socket: SocketAgentWebSocket): void {
    const conn: SocketAgentConnection = new SocketAgentConnection(this.clientIdSeq.toString(), socket);
    this.clientIdSeq++;
    conn.responseQueue = [];
    conn.responseQueueSize = 0;
    conn.responseQueueDiscarded = 0;
    conn.lastSentMs = 0;
    conn.sendInProgressCnt = 0;
    conn.sendInProgressSize = 0;
    conn.socketTimer = null;
    conn.isAlive = true;
    conn.tags = {};

    conn.webSocket.
    on('closed', () => {
      this.removeConnection(conn);
    })
    .on('pong', () => {
      conn.isAlive = true;
    })
    .on('error', (err: mixed): void => {
      this.fail(err);
    })
    .on('message', (msg: mixed): void => {
      const msgStr = String(msg);
      if(msgStr === "PING") {
        conn.webSocket.send("PONG", ()=>{});
        return;
      }
      this.onCommand(conn, msgStr);
    });
    this.connections[conn.clientId] = conn;
  }

  removeConnection(conn: SocketAgentConnection): void {
    delete this.connections[conn.clientId];
  }

  dispatchResponse(response: XBrokerResponse): void {
    const respStr = JSON.stringify(response);
    this.debug("OUT:", respStr);
    if(response.command) {
      const conn: SocketAgentConnection = this.connections[response.command.clientId];
      if(conn) {
        this.sendResponse(conn, respStr);
      }
    }
  }

  dispatchMessage(clientId: XBrokerClient, channel: string, message: XBrokerResponse): void {
    const respStr = JSON.stringify(message);
    this.debug("MESSAGE:", respStr);
    const conn: SocketAgentConnection = this.connections[clientId.clientId];
    if(conn) {
      this.sendResponse(conn, respStr);
    }
  }

  dispatchPMessage(clientId: XBrokerClient, pattern: string, channel: string, message: XBrokerResponse): void {
    const respStr = JSON.stringify(message);
    this.debug("PMESSAGE:", respStr);
    const conn: SocketAgentConnection = this.connections[clientId.clientId];
    if(conn) {
      this.sendResponse(conn, respStr);
    }
  }

  onParsedCommand(conn: SocketAgentConnection, command: XBrokerCommand): void {
    const tag = command.tag;
    conn.tags[tag] = command;

    try {
      if(!command.agent) {
        if(this.options.defaultAgent) {
          command.agent = this.options.defaultAgent;
        } else {
          throw "Invalid command, missing agent";
        }
      }
      if(this.broker) {
        this.broker.dispatchCommand(command);
      } else {
        throw "Misconfigured agent, attached to no broker";
      }
    } catch(err) {
      const resp: XBrokerResponse = {tag, status: "error", errorMsg: err.toString(), command};
      this.sendResponse(conn, JSON.stringify(resp));
    } finally {
      delete conn.tags[tag];
    }
  }

  onCommand(conn: SocketAgentConnection, commandStr: string): void {
    let resp: ?XBrokerResponse = null;
    this.debug("IN:", commandStr);

    let parsedCommand: ?XBrokerCommand = null;
    try {
      parsedCommand = JSON.parse(commandStr);
    } catch(err) {
      resp = {tag: null, status: "error", errorMsg: err.toString(), commandStr: commandStr};
      this.sendResponse(conn, JSON.stringify(resp));
      return;
    }

    const command: XBrokerCommand = {clientAgent: this.name, clientId: conn.clientId, ...parsedCommand};

    try {
      const tag: string = command.tag;

      if(!tag) {
        resp = {tag: tag, status: "error", errorMsg: "missing tag", command: command};
      } else if(conn.tags.hasOwnProperty(tag)) {
        resp = {tag: tag, status: "error", errorMsg: "duplicate tag", command: command};
      } else {
        let cmd: string = command.cmd;
        if(!cmd) {
          resp = {tag: tag, status: "error", errorMsg: "missing command", command: command};
        } else {
          this.onParsedCommand(conn, command);
        }
      }
    } catch(err) {
      resp = {tag: null, status: "error", errorMsg: err.toString(), command: command};
    } finally {
      if(resp) {
        this.sendResponse(conn, JSON.stringify(resp));
      }
    }
  }

  forEachConnection(f: (conn: SocketAgentConnection)=>void): void {
    try {
      for(let id: string in this.connections) {
        const conn: SocketAgentConnection = this.connections[id];
        f(conn);
      };
    } catch(ex) {
      this.fail(ex);
    }
  }

  startTimer(): void {
    const timerFnc = () => {

      this.forEachConnection((conn: SocketAgentConnection) => {
        if(conn.isAlive === false) {
          this.removeConnection(conn);
          conn.webSocket.terminate();
        } else {
          conn.isAlive = false;
          conn.webSocket.ping(function(){});
        }
      })
    };

    this.timer = setInterval(timerFnc, this.options.socketMonitoringIntervalMs);
  }

  stopTimer(): void {
    if(this.timer) {
      try {
        clearInterval(this.timer);
      } finally {
        this.timer = null;
      }
    }
  }

  start(): void {
    this.clientIdSeq = 1
    this.connections = {}

    this.webSocketServer = new ws.Server({port: this.options.port});

    this.webSocketServer
    .on('connection', (socket: SocketAgentWebSocket) => {
      this.setupConnection(socket);
    })
    .on('error', (err: mixed) => {
      this.fail(err);
    })
    .on('close', (arg1, arg2) => {
      const code: number = ((arg1: any): number);
      const reason: string = ((arg2: any): string);
      this.fail(new Error("WebSocket server closed. Code: "+code+", Reason:"+reason));
    });

    this.startTimer();
  }

  stop(): void {
    try {
      this.stopTimer();
    } catch(ex) {
      this.fail(ex);
    }

    this.forEachConnection((conn: SocketAgentConnection ) => {
      this.forceFlush(conn);
      conn.webSocket.terminate();
    });


    this.forEachConnection((conn: SocketAgentConnection) => this.removeConnection(conn));

    try {
      this.webSocketServer.close();
    } catch(ex) {
      this.fail(ex);
    }

  }

}
