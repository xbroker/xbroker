/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

import type { XBrokerResponse, XBrokerClient } from './XBrokerTypes';

import type BrokerAgent from './BrokerAgent';
import type { AgentType, AgentAllOptions } from './Agent'
import BaseAgent from './BaseAgent'
import type { SubscriptionAgent } from './SubscriptionAgent'
import { isEmpty } from './Utils'

type S1XBC = {[string]: XBrokerClient};
type S2XBC = {[string]: S1XBC};
type S3XBC = {[string]: S2XBC};

// channel|pattern -> clientAgentName -> clientId -> XBrokerClient
export type AgentSubscriptions = S3XBC; // {[string]: {[string]: {[string]: XBrokerClient}}};

// clientAgentName -> clientId -> channel|pattern -> XBrokerClient
export type AgentClientsSubscriptions = S3XBC; // {[string]: {[string]: {[string]: XBrokerClient}}};

export class SubscriptionBaseAgent<T: AgentType, O: AgentAllOptions> extends BaseAgent<T, O> implements SubscriptionAgent {

  channelSubscriptions: AgentSubscriptions;
  patternSubscriptions: AgentSubscriptions;

  clientsChannels: AgentClientsSubscriptions;
  clientsPatterns: AgentClientsSubscriptions;

  constructor(type: T, name: string, options: O, broker: BrokerAgent): void {
    super(type, name, options, broker);

    this.channelSubscriptions = {}
    this.patternSubscriptions = {}
    this.clientsChannels = {};
    this.clientsPatterns = {};
  }

  subscribe(channel: string, client: XBrokerClient): boolean {
    let newChannel = false;
    if(this.channelSubscriptions[channel]) {
      const s2xbc: S2XBC = this.channelSubscriptions[channel];
      if(s2xbc[client.clientAgent]) {
        const s1xbc: S1XBC = s2xbc[client.clientAgent];
        if(s1xbc[client.clientId]) {
          throw new Error("The channel: "+channel+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        } else {
          s1xbc[client.clientId] = client;
        }
      } else {
        const s1xbc: S1XBC = {};
        s1xbc[client.clientId] = client;
        s2xbc[client.clientAgent] = s1xbc;
      }
    } else {
      newChannel = true;
      const s1xbc: S1XBC = {};
      s1xbc[client.clientId] = client;
      const s2xbc = {};
      s2xbc[client.clientAgent] = s1xbc;
      this.channelSubscriptions[channel] = s2xbc;
    }

    if(this.clientsChannels[client.clientAgent]) {
      const s2xbc: S2XBC = this.clientsChannels[client.clientAgent];
      if(s2xbc[client.clientId]) {
        const s1xbc: S1XBC = s2xbc[client.clientId];
        if(s1xbc[channel]) {
          throw new Error("The channel: "+channel+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        } else {
          s1xbc[channel] = client;
        }
      } else {
        const s1xbc: S1XBC = {};
        s1xbc[channel] = client;
        s2xbc[client.clientId] = s1xbc;
      }
    } else {
      const s1xbc: S1XBC = {};
      s1xbc[channel] = client;
      const s2xbc = {};
      s2xbc[client.clientId] = s1xbc;
      this.clientsChannels[client.clientAgent] = s2xbc;
    }

    return newChannel;
  }

  psubscribe(pattern: string, client: XBrokerClient): boolean {
    let newPattern = false;
    if(this.patternSubscriptions[pattern]) {
      const s2xbc: S2XBC = this.patternSubscriptions[pattern];
      if(s2xbc[client.clientAgent]) {
        const s1xbc: S1XBC = s2xbc[client.clientAgent];
        if(s1xbc[client.clientId]) {
          throw new Error("The pattern: "+pattern+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        } else {
          s1xbc[client.clientId] = client;
        }
      } else {
        const s1xbc: S1XBC = {};
        s1xbc[client.clientId] = client;
        s2xbc[client.clientAgent] = s1xbc;
      }
    } else {
      newPattern = true;
      const s1xbc: S1XBC = {};
      s1xbc[client.clientId] = client;
      const s2xbc = {};
      s2xbc[client.clientAgent] = s1xbc;
      this.patternSubscriptions[pattern] = s2xbc;
    }

    if(this.clientsPatterns[client.clientAgent]) {
      const s2xbc: S2XBC = this.clientsPatterns[client.clientAgent];
      if(s2xbc[client.clientId]) {
        const s1xbc: S1XBC = s2xbc[client.clientId];
        if(s1xbc[pattern]) {
          throw new Error("The pattern: "+pattern+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        } else {
          s1xbc[pattern] = client;
        }
      } else {
        const s1xbc: S1XBC = {};
        s1xbc[pattern] = client;
        s2xbc[client.clientId] = s1xbc;
      }
    } else {
      const s1xbc: S1XBC = {};
      s1xbc[pattern] = client;
      const s2xbc = {};
      s2xbc[client.clientId] = s1xbc;
      this.clientsPatterns[client.clientAgent] = s2xbc;
    }

    return newPattern;
  }

  unsubscribe(channel: string, client: XBrokerClient): boolean {
    let deadChannel = false;
    if(this.channelSubscriptions[channel]) {
      const s2xbc: S2XBC = this.channelSubscriptions[channel];
      if(s2xbc[client.clientAgent]) {
        const s1xbc: S1XBC = s2xbc[client.clientAgent];
        if(s1xbc[client.clientId]) {
          delete s1xbc[client.clientId];
          if(isEmpty(s1xbc)) {
            delete s2xbc[client.clientAgent];
            if(isEmpty(s2xbc)) {
              delete this.channelSubscriptions[channel];
              deadChannel = true;
            }
          }
        } else {
          throw new Error("The channel: "+channel+" has not been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        }
      } else {
        throw new Error("The channel: "+channel+" has not been subscribed by this agent: "+client.clientAgent);
      }
    } else {
      throw new Error("The channel: "+channel+" has not been subscribed");
    }

    if(this.clientsChannels[client.clientAgent]) {
      const s2xbc: S2XBC = this.clientsChannels[client.clientAgent];
      if(s2xbc[client.clientId]) {
        const s1xbc: S1XBC = s2xbc[client.clientId];
        if(s1xbc[channel]) {
          delete s1xbc[channel];
          if(isEmpty(s1xbc)) {
            delete s2xbc[client.clientId];
            if(isEmpty(s2xbc)) {
              delete this.clientsChannels[client.clientAgent];
              deadChannel = true;
            }
          }
        } else {
          throw new Error("The channel: "+channel+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        }
      } else {
        throw new Error("The channel: "+channel+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
      }
    } else {
      throw new Error("The channel: "+channel+" has already been subscribed by this agent: "+client.clientAgent);
    }

    return deadChannel;
  }

  punsubscribe(pattern: string, client: XBrokerClient): boolean {
    let deadPattern = false;
    if(this.patternSubscriptions[pattern]) {
      const s2xbc: S2XBC = this.patternSubscriptions[pattern];
      if(s2xbc[client.clientAgent]) {
        const s1xbc: S1XBC = s2xbc[client.clientAgent];
        if(s1xbc[client.clientId]) {
          delete s1xbc[client.clientId];
          if(isEmpty(s1xbc)) {
            delete s2xbc[client.clientAgent];
            if(isEmpty(s2xbc)) {
              delete this.patternSubscriptions[pattern];
              deadPattern = true;
            }
          }
        } else {
          throw new Error("The pattern: "+pattern+" has not been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        }
      } else {
        throw new Error("The pattern: "+pattern+" has not been subscribed by this agent: "+client.clientAgent);
      }
    } else {
      throw new Error("The pattern: "+pattern+" has not been subscribed");
    }

    if(this.clientsPatterns[client.clientAgent]) {
      const s2xbc: S2XBC = this.clientsPatterns[client.clientAgent];
      if(s2xbc[client.clientId]) {
        const s1xbc: S1XBC = s2xbc[client.clientId];
        if(s1xbc[pattern]) {
          delete s1xbc[pattern];
          if(isEmpty(s1xbc)) {
            delete s2xbc[client.clientId];
            if(isEmpty(s2xbc)) {
              delete this.clientsPatterns[client.clientAgent];
              deadPattern = true;
            }
          }
        } else {
          throw new Error("The pattern: "+pattern+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
        }
      } else {
        throw new Error("The pattern: "+pattern+" has already been subscribed by this client: "+client.clientAgent+", "+client.clientId);
      }
    } else {
      throw new Error("The pattern: "+pattern+" has already been subscribed by this agent: "+client.clientAgent);
    }

    return deadPattern;
  }

  onMessage(channel: string, message: string): void {
    this.debug("MESSAGE", channel, message);
    if(this.channelSubscriptions[channel]) {
      let resp: XBrokerResponse = {tag: null, status: "message", channel: channel, message: message};
      const s2xbc: S2XBC = this.channelSubscriptions[channel];
      if(s2xbc) {
        for(let agentName in s2xbc) {
          const s1xbc: S1XBC = s2xbc[agentName];
          for(let clientId in s1xbc) {
            const xbc: XBrokerClient = s1xbc[clientId];
            this.broker.dispatchMessage(xbc, channel, resp);
          }
        }
      }
    }
  }

  onPMessage(pattern: string, channel: string, message: string): void {
    this.debug("PMESSAGE", pattern, channel, message);
    if(this.patternSubscriptions[pattern]) {
      let resp: XBrokerResponse = {tag: null, status: "pmessage", pattern: pattern, channel: channel, message: message};
      const s2xbc: S2XBC = this.patternSubscriptions[pattern];
      if(s2xbc) {
        for(let agentName in s2xbc) {
          const s1xbc: S1XBC = s2xbc[agentName];
          for(let clientId in s1xbc) {
            const xbc: XBrokerClient = s1xbc[clientId];
            this.broker.dispatchPMessage(xbc, pattern, channel, resp);
          }
        }
      }
    }
  }

  removeClient(clientId: XBrokerClient) {
    if(this.clientsChannels[clientId.clientAgent]) {
      const s2xbc: S2XBC = this.clientsChannels[clientId.clientAgent];
      if(s2xbc[clientId.clientId]) {
        const s1xbc: S1XBC = s2xbc[clientId.clientAgent];
        const channels: Array<string> = Object.keys(s1xbc);
        for(let i = 0; i < channels.length; i++) {
          try {
            const channel: string = channels[i];
            this.unsubscribe(channel, clientId);
          } catch(ex) {
            this.fail(ex);
          }
        }
      }
    }

    if(this.clientsPatterns[clientId.clientAgent]) {
      const s2xbc: S2XBC = this.clientsPatterns[clientId.clientAgent];
      if(s2xbc[clientId.clientId]) {
        const s1xbc: S1XBC = s2xbc[clientId.clientAgent];
        const patterns: Array<string> = Object.keys(s1xbc);
        for(let i = 0; i < patterns.length; i++) {
          try {
            const pattern: string = patterns[i];
            this.punsubscribe(pattern, clientId);
          } catch(ex) {
            this.fail(ex);
          }
        }
      }
    }
  }

}
