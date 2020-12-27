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
import XBroker from './XBroker'
import EventEmitter from 'events'

import { println } from './Utils';

export type BrokerAgentAllOptions = {
  type: 'broker',
  debug: boolean,
  verbose: boolean,
};

export type BrokerAgentOptions = {
  type: 'broker',
  debug?: boolean,
  verbose?: boolean,
};

export const BrokerAgentDefaultOptions: BrokerAgentAllOptions = {
  type: 'broker',
  debug: false,
  verbose: false,
};

export default class BrokerAgent extends EventEmitter implements Agent {
  type: AgentType;
  name: string;
  options: BrokerAgentAllOptions;

  xbroker: XBroker
  agents: {[string]: Agent}

  constructor(name: string, options: ?BrokerAgentOptions, xbroker: XBroker): void {
    super();
    this.type = 'broker';
    this.name = name;
    this.options = BrokerAgent.buildOptions(options);
    this.xbroker = xbroker;
    this.agents = xbroker.agents;
    this.debug("OPTIONS:", this.options);
    this.eventHandlers();
    this.start();
  }

  static buildOptions(someOptions: ?BrokerAgentOptions): BrokerAgentAllOptions {
    let options: ?BrokerAgentAllOptions;

    if(someOptions) {
      options = {... BrokerAgentDefaultOptions, ... someOptions};
    } else {
      options = {... BrokerAgentDefaultOptions};
    }

    return options;
  }

  getType(): AgentType {
    return this.type;
  }

  getName(): string {
    return this.name;
  }
  
  getOptions(): AgentAllOptions { 
    return this.options;
  }

  eventHandlers() {
    this.on("list", (command: XBrokerCommand) => {

      if(command.args.length !== 1) {
        const resp = this.createResponse(command, "Invalid number of arguments: "+command.args.length);
        this.dispatchResponse(command, resp);
        return;
      }

      var resp: XBrokerResponse;
      var arg = String(command.args[0]);
      switch(arg) {
        case 'agents': {
          const agents = {};
          for(var a: string in this.agents) {
            const agent: Agent = this.agents[a];
            agents[a] = agent.getType();
          }
          resp = this.createResponse(command, undefined, agents);
          break;
        }
        default: {
          resp = this.createResponse(command, "Invalid argument: "+arg);
          break;
        }
      }
      this.dispatchResponse(command, resp);      
    })
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
    if(command.agent === "" || command.agent === this.name) {
      this.emit(command.cmd, command);
      return;
    }

    const agent: Agent = this.agents[command.agent];
    if(agent) {
      agent.dispatchCommand(command);
    } else {
      const resp: XBrokerResponse = this.createResponse(command, "Unknown agent name: "+command.agent);
      this.dispatchResponse(command, resp);
    }
  }

  dispatchResponse(command: XBrokerCommand, response: XBrokerResponse): void {
      const clientAgent: Agent = this.agents[command.clientAgent];
      clientAgent.dispatchResponse(command, response);
  }

  dispatchMessage(clientId: XBrokerClient, channel: string, message: XBrokerResponse): void {
    const clientAgent: Agent = this.agents[clientId.clientAgent];
    this.debug("MESSAGE:", clientId);
    clientAgent.dispatchMessage(clientId, channel, message);
  }

  dispatchPMessage(clientId: XBrokerClient, pattern: string, channel: string, message: XBrokerResponse): void {
    const clientAgent: Agent = this.agents[clientId.clientAgent];
    this.debug("PMESSAGE:", clientId);
    clientAgent.dispatchPMessage(clientId, pattern, channel, message);
  }

  // eslint-disable-next-line no-unused-vars
  subscribe(channel: string, subscriber: Agent): void {

  }

  // eslint-disable-next-line no-unused-vars
  unsubscribe(channel: string, subscriber: Agent): void {

  }

  // eslint-disable-next-line no-unused-vars
  psubscribe(pattern: string, subscriber: Agent): void {

  }

  // eslint-disable-next-line no-unused-vars
  punsubscribe(pattern: string, subscriber: Agent): void {

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
      println(... data);
    }    
  }

  fail(err: mixed): void {
    println("ERROR", err);
  }

}
