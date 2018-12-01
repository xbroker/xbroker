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

import type { Agent, AgentType, AgentOptions, AgentAllOptions } from './Agent';
import BaseAgent from './BaseAgent'

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

export default class BrokerAgent implements Agent {
  type: AgentType;
  name: string;
  options: BrokerAgentAllOptions;

  agents: {[string]: Agent}

  constructor(name: string, options: ?BrokerAgentOptions, agents: {[string]: Agent}): void {
    this.type = 'broker';
    this.name = name;
    this.options = BrokerAgent.buildOptions(options);
    this.agents = agents;
    this.debug("OPTIONS:", this.options);
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

  createResponse(command: XBrokerCommand, err: mixed, result: mixed): XBrokerResponse {
    const tag = command.tag;
    let resp: ?XBrokerResponse;
    if(err) {
      resp = {tag, status: "error", errorMsg: String(err), command};
    } else if(result !== undefined && result !== null) {
      resp = {tag, status: "ok", result, command};
    } else {
      resp = {tag, status: "error", errorMsg: "Internal error: no result value", command};
    }
    return resp;
  }

  dispatchCommand(command: XBrokerCommand): void {
    const agent: Agent = this.agents[command.agent];
    if(agent) {
      agent.dispatchCommand(command);
    } else {
      const resp: XBrokerResponse = {tag: command.tag, status: "error", errorMsg: "Unknown agent name: "+command.agent, command};
      this.dispatchResponse(resp);
    }
  }

  dispatchResponse(response: XBrokerResponse): void {
    if(response.command) {
      const clientAgent: Agent = this.agents[response.command.clientAgent];
      clientAgent.dispatchResponse(response);
    }
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

  subscribe(channel: string, subscriber: Agent): void {

  }

  unsubscribe(channel: string, subscriber: Agent): void {

  }

  psubscribe(pattern: string, subscriber: Agent): void {

  }

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
