/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

export type XBrokerCommandArg = string | number | boolean | {};

export type XBrokerCommand = {|
  clientAgent: string,
  clientId: string,
  
  tag: string,
  agent: string,
  cmd: string,
  args: Array<XBrokerCommandArg>,
|};

export type XBrokerResponse = {|
  tag: ?string,
  status: "error",
  err: string,
|} | {|
  tag: ?string,
  status: "error",
  err: string,
  cmd: string,
|} | {|
  tag: string,
  status: "ok",
  result: mixed,
|} | {|
  tag: null,
  status: "message",
  channel: string,
  message: string,
|} | {|
  tag: null,
  status: "pmessage",
  pattern: string,
  channel: string,
  message: string,
|};

export type XBrokerClient = {|
  clientAgent: string;
  clientId: string;
|};

export type XBrokerCallback = (err: mixed, result: mixed) => void;

