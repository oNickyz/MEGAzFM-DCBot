'use strict';

require('dotenv').config();
const path = require('path');

function toBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

const MIN_VOLUME = 0;
const MAX_VOLUME = 2;

function clampVolume(value) {
  if (!Number.isFinite(value)) return 1.0;
  return Math.min(Math.max(value, MIN_VOLUME), MAX_VOLUME);
}

const config = {
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

  // Opcional: forca um caminho customizado do binario do FFmpeg. Na grande
  // maioria dos casos nao precisa definir isso — o bot ja empacota seu proprio
  // FFmpeg via ffmpeg-static, funcionando mesmo em hosts sem FFmpeg instalado.
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
    logger.error('config', `Configuracao invalida. Variaveis ausentes: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

module.exports = { config, validateConfig, MIN_VOLUME, MAX_VOLUME };
