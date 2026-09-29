'use strict';

const path = require('path');
require('dotenv').config();

const MIN_VOLUME = 0;
const MAX_VOLUME = 2;

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function toFloat(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clampVolume(value) {
  if (!Number.isFinite(value)) return 1.0;
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, value));
}

const config = {
  // Nome de exibicao do bot. Unica fonte de verdade - mude so aqui (via .env).
  botName: process.env.BOT_NAME || 'MEGAzFM',

  discordToken: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  voiceChannelId: process.env.VOICE_CHANNEL_ID || '',
  textChannelId: process.env.TEXT_CHANNEL_ID || '',

  defaultStation: (process.env.DEFAULT_STATION || 'lofi').trim(),
  stationsPath: path.resolve(process.cwd(), process.env.STATIONS_PATH || './stations'),
  shuffleEnabled: toBool(process.env.SHUFFLE_ENABLED, true),
  avoidImmediateRepeat: toBool(process.env.AVOID_IMMEDIATE_REPEAT, true),
  volume: clampVolume(toFloat(process.env.VOLUME, 1.0)),
  autoReconnect: toBool(process.env.AUTO_RECONNECT, true),
  ffmpegPath: process.env.FFMPEG_PATH || null,

  publicStationSwitchEnabled: toBool(process.env.PUBLIC_STATION_SWITCH_ENABLED, false),
  publicUserCooldownMs: toInt(process.env.PUBLIC_STATION_USER_COOLDOWN_MS, 300000),
  publicGlobalCooldownMs: toInt(process.env.PUBLIC_STATION_GLOBAL_COOLDOWN_MS, 60000),
  adminCooldownMs: toInt(process.env.ADMIN_STATION_COOLDOWN_MS, 2000),
  announcePublicStationChange: toBool(process.env.ANNOUNCE_PUBLIC_STATION_CHANGE, false),
};

function validateConfig(logger) {
  const missing = [];
  if (!config.discordToken) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (!config.voiceChannelId) missing.push('VOICE_CHANNEL_ID');

  if (missing.length > 0) {
    logger.error('config', `variaveis obrigatorias ausentes no .env: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

module.exports = { config, validateConfig, MIN_VOLUME, MAX_VOLUME };
