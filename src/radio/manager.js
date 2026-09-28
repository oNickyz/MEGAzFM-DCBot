'use strict';

const path = require('path');
const logger = require('../utils/logger');
const { StationManager } = require('./stationManager');
const { Playlist } = require('./playlist');
const { VoicePlayer } = require('./player');
const { cleanTrackName } = require('../utils/trackName');

const RadioState = {
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
  ONLINE: 'ONLINE',
  EMPTY: 'EMPTY', // estacao atual sem musicas
};

const MAX_CONSECUTIVE_ERRORS = 5;

class RadioManager {
  constructor({ config, guild }) {
    this.config = config;
    this.guild = guild;

    this.stationManager = new StationManager(config.stationsPath);
    this.playlist = new Playlist({
      shuffleEnabled: config.shuffleEnabled,
      avoidImmediateRepeat: config.avoidImmediateRepeat,
    });

    this.voicePlayer = new VoicePlayer({
      voiceChannelId: config.voiceChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      volume: config.volume,
      autoReconnect: config.autoReconnect,
      ffmpegPath: config.ffmpegPath,
    });

    this.currentStation = null;
    this.currentTrackPath = null;
    this.nextTrackPath = null;
    this.state = RadioState.OFFLINE;
    this._skipLock = false;
    this._consecutiveErrors = 0;

    this.voicePlayer.onNeedNextTrack = () => this._playNext();
    this.voicePlayer.onTrackError = () => this._handleTrackError();
    this.voicePlayer.onReconnected = () => this._resumeAfterReconnect();
  }

  /** Descobre estacoes no disco. Retorna estatisticas. */
  scanLibrary() {
    const stats = this.stationManager.scan();
    logger.info('radio', `${stats.stationCount} estacoes encontradas`);
    for (const name of this.stationManager.listStationNames()) {
      const count = this.stationManager.getTracks(name).length;
      logger.info('radio', `${count} musicas na estacao ${name}`);
    }
    return stats;
  }

  /**
   * Conecta ao canal de voz configurado. Antes de conectar, tenta checar se o
   * bot realmente tem permissao de Conectar/Falar naquele canal — sem isso a
   * radio "toca" nos logs mas ninguem ouve nada, sem gerar nenhum erro visivel.
   */
  async connectVoice() {
    this.state = RadioState.CONNECTING;

    try {
      const channel = await this.guild.channels.fetch(this.config.voiceChannelId);
      const me = this.guild.members.me;
      if (channel && me) {
        const perms = channel.permissionsFor(me);
        if (perms && (!perms.has('Connect') || !perms.has('Speak'))) {
          logger.error('voice', 'o bot NAO tem permissao de Conectar e/ou Falar neste canal de voz — a radio vai "tocar" nos logs mas ninguem vai ouvir nada. Ajuste as permissoes do canal/cargo do bot.');
        }
      }
    } catch (err) {
      logger.warn('voice', `nao foi possivel verificar permissoes do canal de voz antecipadamente: ${err.message}`);
    }

    this.voicePlayer.connect();
    const ready = await this.voicePlayer.waitUntilReady();
    if (ready) {
      logger.info('voice', 'conectado ao canal');
    } else {
      logger.warn('voice', 'seguindo mesmo assim, mas o audio provavelmente nao vai funcionar ate a conexao de voz atingir "Ready" — veja o erro acima');
    }
  }

  /**
   * Inicia a reproducao na estacao informada (ou a estacao atual/padrao).
   */
  startStation(stationName) {
    const resolved = this._resolveStartableStation(stationName);

    if (!resolved) {
      this._enterWaitingState();
      return false;
    }

    if (resolved !== stationName) {
      logger.warn('radio', `estacao "${stationName}" indisponivel, usando "${resolved}" no lugar`);
    }

    this.currentStation = resolved;
    this.playlist.resetHistory();
    this._consecutiveErrors = 0;
    this._playNext();
    return true;
  }

  /** Encontra uma estacao valida para iniciar, com fallback. */
  _resolveStartableStation(preferredName) {
    if (preferredName && this.stationManager.isStationAvailable(preferredName)) {
      return preferredName;
    }

    if (preferredName) {
      logger.warn('radio', `estacao padrao/solicitada "${preferredName}" esta vazia ou nao existe`);
    }

    const available = this.stationManager.listAvailableStationNames();
    return available.length > 0 ? available[0] : null;
  }

  /**
   * Estado nao-fatal: nenhuma musica disponivel no momento. O bot continua
   * online e conectado ao canal, apenas aguardando um /reload apos novas
   * musicas serem adicionadas. Nao inicia nenhum timer/loop de polling.
   */
  _enterWaitingState() {
    this.state = RadioState.EMPTY;
    this.currentTrackPath = null;
    logger.warn('radio', 'nenhuma musica disponivel no momento');
    logger.warn('radio', 'aguardando /reload ou novas musicas');
  }

  /** Troca de estacao (usado por /station e /estacao). */
  switchStation(stationName) {
    if (!this.stationManager.isStationAvailable(stationName)) {
      return { ok: false, reason: 'unavailable' };
    }

    this.voicePlayer.stop();
    this.currentStation = stationName;
    this.playlist.resetHistory();
    this._consecutiveErrors = 0;
    this._playNext();

    return { ok: true };
  }

  /** Pula a faixa atual. Retorna false se ja houver um skip em andamento. */
  skip() {
    if (this._skipLock) return false;
    this._skipLock = true;
    try {
      this.voicePlayer.stop();
      this._playNext();
    } finally {
      // pequena folga para nao permitir skips simultaneos instantaneos
      setTimeout(() => {
        this._skipLock = false;
      }, 500);
    }
    return true;
  }

  _playNext() {
    if (!this.currentStation) return;

    const tracks = this.stationManager.getTracks(this.currentStation);
    if (tracks.length === 0) {
      logger.warn('radio', `estacao "${this.currentStation}" ficou sem musicas`);
      this._enterWaitingState();
      return;
    }

    const track = this.playlist.pickNext(tracks);
    if (!track) {
      this.state = RadioState.EMPTY;
      return;
    }

    try {
      this.voicePlayer.play(track);
      this.currentTrackPath = track;
      this.state = RadioState.ONLINE;
      this._consecutiveErrors = 0;
      logger.info('radio', `tocando: ${cleanTrackName(path.basename(track))}`);
    } catch (err) {
      logger.error('radio', `falha ao reproduzir "${path.basename(track)}": ${err.message}`);
      this._handleTrackError();
    }
  }

  _handleTrackError() {
    this._consecutiveErrors += 1;
    if (this._consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      logger.error('radio', 'muitas falhas seguidas, radio pausada nesta estacao');
      this._enterWaitingState();
      return;
    }
    // tenta a proxima faixa, evitando loop sincrono de erro
    setImmediate(() => this._playNext());
  }

  _resumeAfterReconnect() {
    logger.info('radio', 'retomando radio apos reconexao');
    if (this.currentStation) {
      this._playNext();
    } else {
      this.startStation(this.config.defaultStation);
    }
  }

  /** Recarrega a biblioteca de estacoes/musicas sem interromper a faixa atual quando possivel. */
  reload() {
    const stats = this.scanLibrary();

    const stationStillValid = this.currentStation
      && this.stationManager.isStationAvailable(this.currentStation);

    if (!stationStillValid) {
      logger.warn('radio', 'estacao atual ficou invalida apos reload, selecionando outra');
      this.startStation(this.config.defaultStation);
    }

    return stats;
  }

  getNowPlaying() {
    const currentTrackName = this.currentTrackPath
      ? cleanTrackName(path.basename(this.currentTrackPath))
      : null;

    return {
      station: this.currentStation,
      track: currentTrackName,
      state: this.state,
    };
  }

  listStations() {
    return this.stationManager.listStationNames();
  }

  listAvailableStations() {
    return this.stationManager.listAvailableStationNames();
  }

  /** Usado por /estacoes: nome + quantidade de musicas de cada estacao. */
  getStationsSummary() {
    return this.stationManager.listStationNames().map((name) => ({
      name,
      trackCount: this.stationManager.getTracks(name).length,
    }));
  }

  /**
   * Usado por /fila. A arquitetura atual escolhe a proxima musica apenas
   * quando a atual termina, entao nao existe uma fila persistida de verdade.
   * Isso retorna uma previsao das proximas faixas seguindo a mesma logica
   * de selecao, sem consumir nem alterar o estado real de reproducao.
   */
  previewQueue(count = 3) {
    if (!this.currentStation) return [];
    const tracks = this.stationManager.getTracks(this.currentStation);
    return this.playlist
      .previewUpcoming(tracks, count)
      .map((track) => cleanTrackName(path.basename(track)));
  }

  /** Usado por /historico: ultimas musicas tocadas, mais recente primeiro. */
  getRecentHistory(limit = 5) {
    const history = this.playlist.recentHistory;
    // remove a ultima entrada (musica atual) e inverte para mais recente primeiro
    const past = history.slice(0, -1).reverse();
    return past.slice(0, limit).map((track) => cleanTrackName(path.basename(track)));
  }

  /**
   * Usado por /volume. A validacao dos limites e feita no comando; aqui apenas
   * aplicamos o valor. Reaplica na faixa atual (reinicia do comeco) para o efeito
   * ser audivel imediatamente, ja que nao ha rastreamento de posicao de playback.
   */
  setVolume(value) {
    this.voicePlayer.setVolume(value);
    if (this.currentTrackPath) {
      try {
        this.voicePlayer.play(this.currentTrackPath);
      } catch (err) {
        logger.error('radio', `falha ao aplicar novo volume: ${err.message}`);
      }
    }
  }

  /** Usado por /shuffle. Nao duplica nada em memoria, so troca um booleano. */
  setShuffle(enabled) {
    this.playlist.setShuffleEnabled(enabled);
  }

  /** Usado por /reconnect. Protegido contra reconexoes simultaneas dentro do VoicePlayer. */
  reconnect() {
    return this.voicePlayer.forceReconnect();
  }
}

module.exports = { RadioManager, RadioState };
