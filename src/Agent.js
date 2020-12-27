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

import type { SocketAgentAllOptions, SocketAgentOptions } from './SocketAgent';
import type { RedisAgentAllOptions, RedisAgentOptions } from './RedisAgent';
import type { BrokerAgentAllOptions, BrokerAgentOptions } from './BrokerAgent';

export type AgentType = 
  'broker' |
  'socket' |
  'redis';

export type AgentAllOptions =
  BrokerAgentAllOptions | 
  SocketAgentAllOptions |
  RedisAgentAllOptions
;

export type AgentOptions =
  BrokerAgentOptions | 
  SocketAgentOptions |
  RedisAgentOptions
;

export interface Agent {
  createResponse(command: XBrokerCommand, err: mixed, res: mixed): XBrokerResponse;

  getType(): AgentType;
  getName(): string;
  getOptions(): AgentAllOptions;

  dispatchCommand(command: XBrokerCommand): void;
  dispatchResponse(command: XBrokerCommand, response: XBrokerResponse): void;
  dispatchMessage(clientId: XBrokerClient, channel: string, message: XBrokerResponse): void;
  dispatchPMessage(clientId: XBrokerClient, pattern: string, channel: string, message: XBrokerResponse): void;

  start(): void;
  stop(): void;
  restart(): void;

  debug(... data: Array<mixed>): void;
  info(... data: Array<mixed>): void;
  fail(err: mixed): void;
}
