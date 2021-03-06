'use strict';

const Bacon = require('baconjs');
const open = require('opn');

const Logger = require('./logger.js');

function openPage (url) {
  Logger.debug('Opening browser');
  return Bacon.fromPromise(open(url, { wait: false }));
}

module.exports = { openPage };
