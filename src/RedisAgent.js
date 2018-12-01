/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

import redis from 'redis';

import type { XBrokerCommand, XBrokerResponse, XBrokerClient, XBrokerCallback } from './XBrokerTypes';
import type BrokerAgent from './BrokerAgent'

import type { Agent } from './Agent'
import BaseAgent from './BaseAgent'

import type { SubscriptionAgent } from './SubscriptionAgent'
import { SubscriptionBaseAgent } from './SubscriptionBaseAgent'

import { println } from './Utils';

export type RedisAgentAllOptions = {|
  type: 'redis',
  port: number,
  host: string,
  auth: ?string,
  debug: boolean,
  verbose: boolean,
|};

export type RedisAgentOptions = {|
  type: 'redis',
  port?: number,
  host?: string,
  auth?: ?string,
  debug?: boolean,
  verbose?: boolean,
|};

export interface RedisConnection {
  on(msg: 'message', callback: (channel: string, message: string) => void): void;
  on(msg: 'pmessage', callback: (pattern: string, channel: string, message: string) => void): void;

  subscribe(channel: string, callback: XBrokerCallback): void;
  unsubscribe(channel: string, callback: XBrokerCallback): void;
  psubscribe(pattern: string, callback: XBrokerCallback): void;
  punsubscribe(pattern: string, callback: XBrokerCallback): void;
  send_command(command: string, args: Array<string | number>, callback: XBrokerCallback): void;
  quit(): void;
}

export const redisAgentDefaultOptions: RedisAgentAllOptions = {
  type: 'redis',
  debug: false,
  verbose: false,

  port: 6379,
  host: 'localhost',
  auth: null,
};

export default class RedisAgent extends SubscriptionBaseAgent<'redis', RedisAgentAllOptions> implements Agent {

  options: RedisAgentAllOptions

  redisCmdsConnection: RedisConnection
  redisSubsConnection: RedisConnection

  constructor(broker: BrokerAgent, name: string, options: ?RedisAgentOptions): void {

    super('redis', name, RedisAgent.buildOptions(options), broker);

    this.start();
  }

  static buildOptions(someOptions: ?RedisAgentOptions): RedisAgentAllOptions {
    let options: ?RedisAgentAllOptions;

    if(someOptions) {
      options = {... redisAgentDefaultOptions, ... someOptions};
    } else {
      options = {... redisAgentDefaultOptions};
    }

    return options;
  }

  dispatchCommand(command: XBrokerCommand): void {
    const cmd = command.cmd.toLowerCase();
    const args = command.args;
    const callback = (err: mixed, res: mixed): void => {
      const resp: XBrokerResponse = this.createResponse(command, err, res);
      this.dispatchResponse(resp);
    };

    try {
    const client: XBrokerClient = {clientAgent: command.clientAgent, clientId: command.clientId};
    let runCmd: boolean = false;
    let runSub: boolean = false;

    switch(cmd) {
    case "subscribe": {
      const channel: string = args[0].toString();
      runSub = this.subscribe(channel, client);
      break;
    }
    case "psubscribe": {
      const pattern: string = args[0].toString();
      runSub = this.psubscribe(pattern, client);
      break;
    }
    case "unsubscribe": {
      const channel: string = args[0].toString();
      runSub = this.unsubscribe(channel, client);
      break;
    }
    case "punsubscribe": {
      const pattern: string = args[0].toString();
      runSub = this.punsubscribe(pattern, client);
      break;
    }
    default: {
      runCmd = true;
      break;
    }
    }  

    if(runCmd) {
      this.debug("COMMAND: ", cmd);
      this.redisCmdsConnection.send_command(cmd, args, callback);
    } else if(runSub) {
      this.debug("SUBSCRIBE: ", cmd);
      this.redisSubsConnection.send_command(cmd, args, callback);
    } else {
      callback(null, "ok");
    }

  } catch(ex) {
    callback(ex, null);
  }
  }

  start(): void {
    // Create a redis connection for regular redis commands
    this.redisCmdsConnection = redis.createClient(this.options.port, this.options.host)
    if(this.options.auth) {
      this.redisCmdsConnection.auth(this.options.auth);
    }

    // Create a redis connection for redis subscriptions
    this.redisSubsConnection = this.redisCmdsConnection.duplicate()
    if(this.options.auth) {
      this.redisSubsConnection.auth(this.options.auth);
    }

    this.redisSubsConnection.on('message', (channel: string, message: string): void => {
      this.onMessage(channel, message);
    });

    this.redisSubsConnection.on('pmessage', (pattern: string, channel: string, message: string): void => {
      this.onPMessage(pattern, channel, message);
    });
  }

  stop(): void {
    try {
      this.redisSubsConnection.quit();
    } catch(ex) {
      this.fail(ex);
    }

    try {
      this.redisCmdsConnection.quit();    
    } catch(ex) {
      this.fail(ex);
    }     
  }

  restart(): void {
    try {
      this.stop();
    } finally {
      this.start();
    }
  }

}
