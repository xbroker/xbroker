/**
 *  Copyright (c) 2018, AMI System, LLC
 *  All rights reserved.
 *
 *  This source code is licensed under the MIT-style license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 *  @flow
 */

export const println = (... data: Array<mixed>): void => {
  /* eslint-disable no-console */
  console.log(... data);
  /* eslint-enable no-console */
}

export const isEmpty = (obj: {}): boolean => {
  let empty = true;

  for(let field in obj) {
    empty = false;
    break;
  }
  
  return empty;
}
