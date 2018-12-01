/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

import type { XBrokerOptions } from './XBroker'
import XBroker from './XBroker'

const createServer = (options: ?XBrokerOptions): XBroker =>
  new XBroker(options)

export {
  createServer
}

export default {
  createServer
}
