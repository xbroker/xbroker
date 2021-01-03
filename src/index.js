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
import { encodePassword } from './EncodePassword'

const createServer = (options: XBrokerOptions, optionsFile: string): XBroker =>
  new XBroker(options, optionsFile)

export {
  createServer,
  encodePassword,
}

export default {
  createServer,
  encodePassword,
}
