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
import RedisAgent from './RedisAgent';
import BrokerAgent from './BrokerAgent';


export type XBrokerAllOptions = {
  [string]: AgentAllOptions
};

export type XBrokerOptions = {
  [string]: AgentOptions
};

export default class XBroker {

  options: XBrokerOptions
  optionsFile: ?string
  agents: {[string]: Agent}

  constructor(options: XBrokerOptions, optionsFile: string): void {

    this.agents = {};

    if(options) {
      this.options = options;
      this.optionsFile = optionsFile;
    } else {
      this.options = {};
      this.optionsFile = null;
    }

    let broker: ?BrokerAgent;

    for(let name in this.options) {
      const agentOptions: AgentOptions = this.options[name];
      switch(agentOptions.type) {
        case 'broker': {
          const agent: BrokerAgent = new BrokerAgent(name, agentOptions, this);
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
