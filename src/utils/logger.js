'use strict';

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function line(scope, message) {
  return `[${timestamp()}] [${scope}] ${message}`;
}

const logger = {
  info(scope, message) {
    console.log(line(scope, message));
  },
  warn(scope, message) {
    console.warn(line(scope, message));
  },
  error(scope, message) {
    console.error(line(scope, message));
  },
};

module.exports = logger;
