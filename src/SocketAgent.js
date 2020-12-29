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
import https from 'https';
import fs from 'fs';
import path from 'path';

import type { XBrokerClient, XBrokerCommand, XBrokerResponse } from './XBrokerTypes';

import BaseAgent from './BaseAgent';
import type BrokerAgent from "./BrokerAgent";

export type SocketAgentAllOptions = {|
  type: 'socket',
  debug: boolean,
  verbose: boolean,

  batchIntervalMs: number,
  socketQueueItemsLimit: number,
  socketQueueSizeLimit: number,
  socketQueueSizeFlush: number,
  socketSendInProgressLimit: number,
  socketMonitoringIntervalMs: number,
  port: number,
  https?: {|
    cert: string,
    key: string,
  |},
  defaultAgent?: string,
|};  

export type SocketAgentOptions = {|
  type: 'socket',
  debug?: boolean,
  verbose?: boolean,

  batchIntervalMs?: number,
  socketQueueItemsLimit: number,
  socketQueueSizeLimit?: number,
  socketQueueSizeFlush?: number,
  socketSendInProgressLimit?: number,
  socketMonitoringIntervalMs?: number,
  port?: number,
  https?: {|
    cert: string,
    key: string,
  |},
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
}

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
  socketQueueItemsLimit: 10, // in UTF-16 characters
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

  sendResponse(socket: SocketAgentConnection, msgStr: string, message: XBrokerResponse): void {
    while(message.tag === null && socket.responseQueueSize >= this.options.socketQueueSizeLimit && socket.responseQueue.length >= this.options.socketQueueItemsLimit) {
      const removedMsgStr = socket.responseQueue.shift();
      socket.responseQueueSize -= removedMsgStr.length;
      socket.responseQueueDiscarded += removedMsgStr.length;
    }
    socket.responseQueue.push(msgStr);
    socket.responseQueueSize += msgStr.length;
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

  dispatchResponse(command: XBrokerCommand, response: XBrokerResponse): void {
    const respStr = JSON.stringify(response);
    this.debug("OUT:", respStr);
    const conn: SocketAgentConnection = this.connections[command.clientId];
    if(conn) {
      this.sendResponse(conn, respStr, response);
    }
  }

  dispatchMessage(clientId: XBrokerClient, channel: string, message: XBrokerResponse): void {
    const respStr = JSON.stringify(message);
    this.debug("MESSAGE:", respStr);
    const conn: SocketAgentConnection = this.connections[clientId.clientId];
    if(conn) {
      this.sendResponse(conn, respStr, message);
    }
  }

  dispatchPMessage(clientId: XBrokerClient, pattern: string, channel: string, message: XBrokerResponse): void {
    const respStr = JSON.stringify(message);
    this.debug("PMESSAGE:", respStr);
    const conn: SocketAgentConnection = this.connections[clientId.clientId];
    if(conn) {
      this.sendResponse(conn, respStr, message);
    }
  }

  onParsedCommand(conn: SocketAgentConnection, command: XBrokerCommand): void {
    const tag = command.tag;
    conn.tags[tag] = command;

    try {
      if(!command.agent && command.agent !== "") {
        if(this.options.defaultAgent) {
          command.agent = this.options.defaultAgent;
        } else {
          throw "Invalid command, missing agent";
        }
      }
      if(conn.responseQueueSize >= this.options.socketQueueSizeLimit && conn.responseQueue.length >= this.options.socketQueueItemsLimit) {
        throw "Server is too busy"
      }
      if(this.broker) {
        this.broker.dispatchCommand(command);
      } else {
        throw "Misconfigured agent, attached to no broker";
      }
    } catch(err) {
      const resp: XBrokerResponse = {tag, status: "error", err: err.toString()};
      this.sendResponse(conn, JSON.stringify(resp), resp);
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
      resp = {tag: null, status: "error", err: err.toString(), cmd: commandStr};
      this.sendResponse(conn, JSON.stringify(resp), resp);
      return;
    }

    const command: XBrokerCommand = {clientAgent: this.name, clientId: conn.clientId, ...parsedCommand};

    try {
      const tag: string = command.tag;

      if(!tag) {
        resp = {tag: tag, status: "error", err: "missing tag"};
      } else if(conn.tags[tag]) {
        resp = {tag: tag, status: "error", err: "duplicate tag"};
      } else {
        let cmd: string = command.cmd;
        if(!cmd) {
          resp = {tag: tag, status: "error", err: "missing command"};
        } else {
          this.onParsedCommand(conn, command);
        }
      }
    } catch(err) {
      resp = {tag: null, status: "error", err: err.toString()};
    } finally {
      if(resp) {
        this.sendResponse(conn, JSON.stringify(resp), resp);
      }
    }
  }

  forEachConnection(f: (conn: SocketAgentConnection)=>void): void {
    try {
      for(let id: string in this.connections) {
        const conn: SocketAgentConnection = this.connections[id];
        f(conn);
      }
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
    const perMessageDeflate = {
      zlibDeflateOptions: {
        // See zlib defaults.
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 5 * 1024
      },
      // Other options settable:
      clientNoContextTakeover: true, // Defaults to negotiated value.
      serverNoContextTakeover: true, // Defaults to negotiated value.
      serverMaxWindowBits: 10, // Defaults to negotiated value.
      // Below options specified as default values.
      concurrencyLimit: 4, // Limits zlib concurrency for perf.
      threshold: 1024 // Size (in bytes) below which messages
      // should not be compressed.
    }

    this.clientIdSeq = 1
    this.connections = {}

    if(this.options.https) {
      const httpsCert = this.options.https.cert;
      const httpsKey = this.options.https.key;

      var dirname = ".";
      if(this.broker.xbroker.optionsFile) {
        dirname = path.dirname(this.broker.xbroker.optionsFile);
      }
      
      const cert = fs.readFileSync(dirname+'/'+httpsCert, 'utf8');
      const key = fs.readFileSync(dirname+'/'+httpsKey, 'utf8');

      const httpsServer = new https.createServer({
        cert,
        key
      }); 
      httpsServer.listen(this.options.port);

      this.webSocketServer = new ws.Server({server: httpsServer, perMessageDeflate});
    } else {
      this.webSocketServer = new ws.Server({port: this.options.port, perMessageDeflate});
    }

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
