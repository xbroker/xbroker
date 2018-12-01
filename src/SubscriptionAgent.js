/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

import type { XBrokerClient } from './XBrokerTypes';

import type { Agent } from './Agent';

export interface SubscriptionAgent extends Agent {
  subscribe(channel: string, client: XBrokerClient): boolean;
  psubscribe(pattern: string, client: XBrokerClient): boolean;
  unsubscribe(channel: string, client: XBrokerClient): boolean;
  punsubscribe(pattern: string, client: XBrokerClient): boolean;

  removeClient(clientId: XBrokerClient): void;

  onMessage(channel: string, message: string): void;
  onPMessage(pattern: string, channel: string, message: string): void;
}
