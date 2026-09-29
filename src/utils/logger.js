'use strict';

/**
 * Logger simples e leve. NUNCA deve receber tokens/secrets como argumento.
 * Formato: [YYYY-MM-DD HH:mm:ss] [scope] mensagem
 */
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

module.exports = { logger };
