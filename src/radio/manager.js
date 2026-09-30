'use strict';

const { Routes, PermissionFlagsBits } = require('discord.js');
const { StationManager } = require('./stationManager');
const { Playlist } = require('./playlist');
const { VoicePlayer } = require('./player');
const { cleanTrackName } = require('../utils/trackName');
const { logger } = require('../utils/logger');

const MAX_CONSECUTIVE_ERRORS = 5;

const STATE = {
  ONLINE: 'ONLINE',
  EMPTY: 'EMPTY',
};

/**
 * RadioManager - orquestra estacoes, playlist e o VoicePlayer.
 *
 * O construtor aceita `VoicePlayerClass` para permitir que uma versao
 * privada injete uma subclasse de VoicePlayer (com _resolveStreamSource
 * sobrescrito) sem duplicar nenhuma logica deste arquivo.
 */
class RadioManager {
  constructor({ config, guild, VoicePlayerClass = VoicePlayer }) {
    this.config = config;
    this.guild = guild;

    this.stationManager = new StationManager(config.stationsPath);
    this.playlist = new Playlist({
      shuffleEnabled: config.shuffleEnabled,
      avoidImmediateRepeat: config.avoidImmediateRepeat,
    });
    this.voicePlayer = new VoicePlayerClass({
      voiceChannelId: config.voiceChannelId,
      guildId: config.guildId,
      adapterCreator: guild.voiceAdapterCreator,
      volume: config.volume,
      autoReconnect: config.autoReconnect,
      ffmpegPath: config.ffmpegPath,
    });

    this.currentStation = null;
    this.currentTrackPath = null;
    this.state = STATE.EMPTY;
    this._consecutiveErrors = 0;
    this._skipLock = false;

    this.voicePlayer.audioPlayer.on('stateChange', (oldState, newState) => {
      if (newState.status === 'idle' && oldState.status !== 'idle') {
        setImmediate(() => this._playNext());
      }
    });
  }

  scanLibrary() {
    this.stationManager.scan();
    const names = this.stationManager.listStationNames();
    logger.info('radio', `${names.length} estacoes encontradas`);
    for (const name of names) {
      const info = this.stationManager.getStationInfo(name);
      if (info.type === 'stream') {
        const desc = info.streamUrl
          ? 'e uma transmissao ao vivo (URL configurada)'
          : 'e uma transmissao ao vivo (SEM URL valida)';
        logger.info('radio', `estacao "${name}" ${desc}`);
      } else {
        logger.info('radio', `${info.tracks.length} musicas na estacao ${name}`);
      }
    }
  }

  async connectVoice() {
    let channel = null;
    try {
      channel = await this.guild.channels.fetch(this.config.voiceChannelId);
      if (!channel) {
        logger.error('voice', `canal de voz ${this.config.voiceChannelId} nao encontrado`);
        return;
      }
      const me = this.guild.members.me;
      const perms = me ? channel.permissionsFor(me) : null;
      if (perms && (!perms.has('Connect') || !perms.has('Speak'))) {
        logger.error('voice', 'o bot nao tem permissao de Conectar/Falar no canal de voz configurado');
      }
    } catch (err) {
      logger.warn('voice', `nao foi possivel verificar permissoes do canal antes de conectar: ${err.message}`);
    }

    this.voicePlayer.connect();
    if (channel) {
      const me = this.guild.members.me;
      const perms = me ? channel.permissionsFor(me) : null;
      if (perms && perms.has(PermissionFlagsBits.SetVoiceChannelStatus)) {
        try {
          await this.guild.client.rest.put(Routes.channelVoiceStatus(channel.id), {
            body: { status: 'Powered by MEGAzFM' },
          });
          logger.info('voice', 'status do canal atualizado para "Powered by MEGAzFM"');
        } catch (err) {
          logger.warn('voice', `nao foi possivel atualizar o status do canal: ${err.message}`);
        }
      } else {
        logger.warn('voice', 'sem permissao Set Voice Channel Status; status da call nao foi atualizado');
      }
    }

    const ready = await this.voicePlayer.waitUntilReady();
    if (ready) {
      logger.info('voice', 'pronto para reproduzir audio');
    } else {
      logger.warn('voice', 'seguindo mesmo assim (bot permanece conectado e online)');
    }
  }

  startStation(stationName) {
    const resolved = this._resolveStartableStation(stationName);
    if (!resolved) {
      this._enterWaitingState();
      return;
    }
    this.currentStation = resolved;
    this._consecutiveErrors = 0;
    this._playNext();
  }

  _resolveStartableStation(stationName) {
    if (stationName && this.stationManager.isStationAvailable(stationName)) {
      return stationName;
    }
    if (stationName) {
      logger.warn('radio', `estacao solicitada "${stationName}" esta vazia ou nao existe`);
    }
    const available = this.stationManager.listAvailableStationNames();
    return available.length > 0 ? available[0] : null;
  }

  _enterWaitingState() {
    this.state = STATE.EMPTY;
    this.currentTrackPath = null;
    logger.warn('radio', 'nenhuma musica disponivel no momento');
    logger.warn('radio', 'aguardando /reload ou novas musicas');
  }

  switchStation(stationName) {
    if (!this.stationManager.isStationAvailable(stationName)) {
      return { ok: false, reason: 'unavailable' };
    }
    this.currentStation = stationName;
    this._consecutiveErrors = 0;
    this.playlist.resetHistory();
    this._playNext();
    return { ok: true };
  }

  skip() {
    if (this._skipLock) return { ok: false, reason: 'locked' };
    this._skipLock = true;
    setTimeout(() => {
      this._skipLock = false;
    }, 500);
    this._playNext();
    return { ok: true };
  }

  async _playNext() {
    if (!this.currentStation || !this.stationManager.isStationAvailable(this.currentStation)) {
      this._enterWaitingState();
      return;
    }

    if (this.stationManager.isStreamStation(this.currentStation)) {
      await this._playLiveStream();
      return;
    }

    const tracks = this.stationManager.getTracks(this.currentStation);
    const next = this.playlist.pickNext(tracks);
    if (!next) {
      this._enterWaitingState();
      return;
    }

    try {
      this.voicePlayer.play(next);
      this.currentTrackPath = next;
      this.state = STATE.ONLINE;
      this._consecutiveErrors = 0;
    } catch (err) {
      this._handleTrackError(err, next);
    }
  }

  async _playLiveStream() {
    const info = this.stationManager.getStationInfo(this.currentStation);
    const streamUrl = info && info.streamUrl;
    if (!streamUrl) {
      this._enterWaitingState();
      return;
    }
    try {
      await this.voicePlayer.playStream(streamUrl);
      this.currentTrackPath = null;
      this.state = STATE.ONLINE;
      this._consecutiveErrors = 0;
    } catch (err) {
      this._handleTrackError(err, streamUrl);
    }
  }

  _handleTrackError(err, label) {
    this._consecutiveErrors += 1;
    logger.error('radio', `falha ao reproduzir "${label}": ${err.message}`);
    if (this._consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      logger.error('radio', 'muitas falhas seguidas, radio pausada nesta estacao');
      this._enterWaitingState();
    } else {
      setImmediate(() => this._playNext());
    }
  }

  async _resumeAfterReconnect() {
    if (this.currentStation && this.stationManager.isStationAvailable(this.currentStation)) {
      await this._playNext();
    }
  }

  reload() {
    this.scanLibrary();
    if (!this.currentStation || !this.stationManager.isStationAvailable(this.currentStation)) {
      const fallback = this._resolveStartableStation(this.config.defaultStation);
      if (fallback) {
        logger.info('reload', `retomando reproducao com a estacao "${fallback}"`);
        this.startStation(fallback);
        return;
      }
      this._enterWaitingState();
      return;
    }
    logger.info('reload', 'biblioteca recarregada');
  }

  getNowPlaying() {
    const info = this.currentStation ? this.stationManager.getStationInfo(this.currentStation) : null;
    const isLive = !!info && info.type === 'stream';
    const trackMetadata = this.currentStation && this.currentTrackPath
      ? this.stationManager.getTrackMetadata(this.currentStation, this.currentTrackPath)
      : null;
    let track = null;
    if (isLive) {
      track = '🔴 Transmissao ao vivo';
    } else if (this.currentTrackPath) {
      const path = require('path');
      track = cleanTrackName(path.basename(this.currentTrackPath));
    }
    return {
      station: this.currentStation,
      track,
      license: trackMetadata ? trackMetadata.license : null,
      state: this.state,
      isLive,
    };
  }

  listStations() {
    return this.stationManager.listStationNames();
  }

  listAvailableStations() {
    return this.stationManager.listAvailableStationNames();
  }

  getStationsSummary() {
    return this.listStations().map((name) => {
      const info = this.stationManager.getStationInfo(name);
      const isLive = info.type === 'stream';
      return {
        name,
        trackCount: isLive ? null : info.tracks.length,
        isLive,
        available: this.stationManager.isStationAvailable(name),
      };
    });
  }

  previewQueue(count) {
    if (!this.currentStation) return [];
    const tracks = this.stationManager.getTracks(this.currentStation);
    const path = require('path');
    return this.playlist.previewUpcoming(tracks, count).map((p) => cleanTrackName(path.basename(p)));
  }

  getRecentHistory(limit) {
    const path = require('path');
    return this.playlist.getRecentHistory(limit)
      .filter((p) => typeof p === 'string' && p.toLowerCase().endsWith('.mp3'))
      .map((p) => cleanTrackName(path.basename(p)));
  }

  setVolume(value) {
    this.voicePlayer.setVolume(value);
    if (this.currentStation && this.stationManager.isStreamStation(this.currentStation)) {
      this._playLiveStream();
    } else if (this.currentTrackPath) {
      this.voicePlayer.play(this.currentTrackPath);
    }
  }

  setShuffle(enabled) {
    this.playlist.setShuffleEnabled(enabled);
  }

  async reconnect() {
    const ready = await this.voicePlayer.forceReconnect();
    if (ready) {
      await this._resumeAfterReconnect();
    }
    return ready;
  }
}

module.exports = { RadioManager, STATE };
