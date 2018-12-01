/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

import type { Agent, AgentOptions, AgentAllOptions } from './Agent';

import { println } from './Utils';

import SocketAgent from './SocketAgent';
import type { SocketAgentAllOptions, SocketAgentOptions } from './SocketAgent';
import { socketAgentDefaultOptions } from './SocketAgent';

import RedisAgent from './RedisAgent';
import type { RedisAgentAllOptions, RedisAgentOptions } from './RedisAgent';
import { redisAgentDefaultOptions } from './RedisAgent';

import BrokerAgent from './BrokerAgent';
import type { BrokerAgentAllOptions, BrokerAgentOptions } from './BrokerAgent';
import { BrokerAgentDefaultOptions } from './BrokerAgent';


export type XBrokerAllOptions = {
  [string]: AgentAllOptions
};

export type XBrokerOptions = {
  [string]: AgentOptions
};

const xBrokerDefaultOptions: XBrokerAllOptions = {
  broker: BrokerAgentDefaultOptions,
  socket: socketAgentDefaultOptions,
  redis: redisAgentDefaultOptions,
};

export default class XBroker {

  options: XBrokerOptions
  agents: {[string]: Agent}

  constructor(options: ?XBrokerOptions): void {

    this.agents = {};

    if(options) {
      this.options = options;
    } else {
      this.options = {};
    }

    let broker: ?BrokerAgent;

    for(let name in this.options) {
      const agentOptions: AgentOptions = this.options[name];
      switch(agentOptions.type) {
        case 'broker': {
          const agent: BrokerAgent = new BrokerAgent(name, agentOptions, this.agents);
          this.agents[name] = agent;
          broker = agent;
          break;
        }
        case 'socket': {
          if(broker) {
            const agent: Agent = new SocketAgent(broker, name, agentOptions);
            this.agents[name] = agent;
          } else {
            this.fail()
          }
          break;
        }
        case 'redis': {
          if(broker) {
            const agent: RedisAgent = new RedisAgent(broker, name, agentOptions);
            this.agents[name] = agent;
          } else {
            this.fail()
          }
          break;
        }
        default: {
          throw new Error("Unknown agent type: "+agentOptions.type);
        }
      }
    }

  }

  debug(... data: Array<mixed>): void {
    println(... data);
  }

  info(... data: Array<mixed>): void {
    println(... data);
  }

  fail(err: mixed): void {
    println("ERROR", err);
  }

}
