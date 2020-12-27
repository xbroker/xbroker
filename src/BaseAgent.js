/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

import type { XBrokerClient, XBrokerCommand, XBrokerResponse } from './XBrokerTypes';

import type { Agent, AgentType, AgentAllOptions } from './Agent';

import BrokerAgent from './BrokerAgent';

import EventEmitter from 'events'

import { println } from './Utils';

export default class BaseAgent<T: AgentType, O: AgentAllOptions> extends EventEmitter implements Agent {
  type: T;
  name: string;
  options: O;
  broker: BrokerAgent;

  getType(): AgentType {
    return this.type;
  }

  getName(): string {
    return this.name;
  }
  
  getOptions(): AgentAllOptions { 
    return this.options;
  }

  constructor(type: T, name: string, options: O, broker: BrokerAgent): void {
    super()
    this.type = type;
    this.name = name;
    this.options = options;
    this.broker = broker;
    this.debug("OPTIONS:", options);
  }

  createResponse(command: XBrokerCommand, err: mixed, result: mixed): XBrokerResponse {
    const tag = command.tag;
    let resp: ?XBrokerResponse;
    if(err) {
      resp = {tag, status: "error", err: String(err)};
    } else if(result !== undefined && result !== null) {
      resp = {tag, status: "ok", result};
    } else {
      resp = {tag, status: "error", err: "Internal error: no result value"};
    }
    return resp;
  }

  dispatchCommand(command: XBrokerCommand): void {
    const response: XBrokerResponse = this.createResponse(command, null, null);
    if(this.broker) {
      this.broker.dispatchResponse(command, response);
    }
  }

  dispatchResponse(command: XBrokerCommand, response: XBrokerResponse): void {
    if(this.broker) {
      this.broker.dispatchResponse(command, response);
    }
  }

  dispatchMessage(clientId: XBrokerClient, channel: string, message: XBrokerResponse): void {
    if(this.broker) {
      this.broker.dispatchMessage(clientId, channel, message);
    }
  }

  dispatchPMessage(clientId: XBrokerClient, pattern: string, channel: string, message: XBrokerResponse): void {
    if(this.broker) {
      this.broker.dispatchPMessage(clientId, pattern, channel, message);
    }
  }

  start() {
  }

  stop() {
  }
  
  restart() {
    try {
      this.stop();
    } finally {
      this.start();
    }
  }

  debug(... data: Array<mixed>): void {
    if(this.options.debug) {
      println(this.name, ":", ... data);
    }    
  }

  info(... data: Array<mixed>): void {
    if(this.options.verbose) {
      println(this.name, ":", ... data);
    }    
  }

  fail(err: mixed): void {
    println(this.name, ":", "ERROR", err);
  }

}
