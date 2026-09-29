'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const prism = require('prism-media');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { logger } = require('../utils/logger');

const RECONNECT_DELAY_MS = 5000;
const READY_TIMEOUT_MS = 15000;
const BYTE_CHECK_DELAY_MS = 3000;

let bundledFfmpegPath = null;
try {
  const candidate = require('ffmpeg-static');
  if (candidate && fs.existsSync(candidate)) {
    bundledFfmpegPath = candidate;
  }
} catch (err) {
  bundledFfmpegPath = null;
}

function verifyFfmpegBinary(command) {
  if (!command) return false;
  try {
    execFileSync(command, ['-version'], { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * VoicePlayer - conexao de voz + reproducao via FFmpeg.
 *
 * Ponto de extensao para versoes privadas: `_resolveStreamSource(url)`.
 * Por padrao, apenas repassa a URL para o FFmpeg (funciona com qualquer
 * stream Icecast/Shoutcast HTTP direto). Uma subclasse pode sobrescrever
 * este metodo para resolver fontes adicionais (ex: YouTube) sem duplicar
 * o restante desta classe.
 */
class VoicePlayer {
  constructor({ voiceChannelId, guildId, adapterCreator, volume = 1.0, autoReconnect = true, ffmpegPath = null }) {
    this.voiceChannelId = voiceChannelId;
    this.guildId = guildId;
    this.adapterCreator = adapterCreator;
    this.volume = volume;
    this.autoReconnect = autoReconnect;

    this.ffmpegCommand = ffmpegPath || bundledFfmpegPath || 'ffmpeg';
    const source = ffmpegPath ? 'FFMPEG_PATH' : bundledFfmpegPath ? 'ffmpeg-static (bundled)' : 'sistema (fallback)';
    logger.info('player', `usando binario ffmpeg via ${source}`);

    if (!verifyFfmpegBinary(this.ffmpegCommand)) {
      logger.error('player', `nao foi possivel executar o binario ffmpeg ("${this.ffmpegCommand}"). Verifique a instalacao ou defina FFMPEG_PATH.`);
    }

    this.connection = null;
    this.audioPlayer = createAudioPlayer();
    this.currentFfmpeg = null;
    this._reconnecting = false;
    this._byteCheckTimer = null;

    this.audioPlayer.on('error', (err) => {
      logger.error('player', `erro no audio player: ${err.message}`);
    });
  }

  connect() {
    if (this.connection) {
      try {
        this.connection.removeAllListeners();
        this.connection.destroy();
      } catch (err) {
        // ignora - conexao pode ja estar destruida
      }
      this.connection = null;
    }

    this.connection = joinVoiceChannel({
      channelId: this.voiceChannelId,
      guildId: this.guildId,
      adapterCreator: this.adapterCreator,
      selfDeaf: true,
    });

    this.connection.subscribe(this.audioPlayer);
    this._bindConnectionEvents();
    logger.info('voice', 'conectado ao canal');
  }

  async waitUntilReady(timeoutMs = READY_TIMEOUT_MS) {
    if (!this.connection) return false;
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, timeoutMs);
      logger.info('voice', 'conexao de voz atingiu o estado Ready (audio deve fluir normalmente)');
      return true;
    } catch (err) {
      logger.error(
        'voice',
        'conexao de voz NAO atingiu o estado Ready dentro do tempo limite. ' +
          'A conexao com o Discord (gateway) pode estar OK, mas o canal UDP de audio nao foi estabelecido. ' +
          'Causas comuns: firewall/antivirus bloqueando UDP, NAT restritivo, VPN, ou instabilidade regional ' +
          'nos servidores de voz do Discord. O bot continuara online mesmo assim.'
      );
      return false;
    }
  }

  _bindConnectionEvents() {
    if (!this.connection) return;

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (!this.autoReconnect) return;
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch (err) {
        this._scheduleReconnect();
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (this.autoReconnect) this._scheduleReconnect();
    });

    this.connection.on('error', (err) => {
      logger.error('voice', `erro na conexao de voz: ${err.message}`);
    });
  }

  _scheduleReconnect() {
    if (this._reconnecting) return;
    this._reconnecting = true;
    logger.warn('voice', 'reconectando...');
    setTimeout(() => {
      this._reconnecting = false;
      try {
        this.connect();
      } catch (err) {
        logger.error('voice', `falha ao reconectar: ${err.message}`);
      }
    }, RECONNECT_DELAY_MS);
  }

  async forceReconnect() {
    if (this._reconnecting) {
      logger.warn('voice', 'reconexao ja em andamento, ignorando novo pedido');
      return false;
    }
    this._reconnecting = true;
    try {
      logger.warn('voice', 'reconectando (forcado)...');
      this.connect();
      const ready = await this.waitUntilReady();
      return ready;
    } finally {
      this._reconnecting = false;
    }
  }

  setVolume(value) {
    this.volume = value;
  }

  /**
   * Hook de extensao: dado uma URL de "estacao de stream", retorna a fonte
   * a ser usada pelo FFmpeg. A implementacao padrao (Core) apenas repassa
   * a URL HTTP diretamente - funciona para qualquer stream Icecast/Shoutcast.
   *
   * Uma subclasse privada pode sobrescrever este metodo para resolver
   * outras fontes (ex: extrair a URL real de audio de uma live do YouTube)
   * sem precisar duplicar playStream()/_runFfmpegAndPlay().
   *
   * Retorno esperado: { directUrl } OU { nodeStream } (um Readable ja
   * decodificado que sera repassado ao FFmpeg via stdin).
   */
  async _resolveStreamSource(url) {
    return { directUrl: url };
  }

  play(filePath) {
    const args = [
      '-analyzeduration', '0',
      '-loglevel', 'error',
      '-i', filePath,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
    ];
    if (this.volume !== 1) args.push('-af', `volume=${this.volume}`);

    const ffmpeg = new prism.FFmpeg({ args, command: this.ffmpegCommand });
    this._runFfmpegAndPlay(ffmpeg, path.basename(filePath));
  }

  async playStream(url) {
    let resolved;
    try {
      resolved = await this._resolveStreamSource(url);
    } catch (err) {
      throw new Error(`nao foi possivel resolver a fonte de audio: ${err.message}`);
    }

    const commonArgs = ['-analyzeduration', '0', '-loglevel', 'error', '-f', 's16le', '-ar', '48000', '-ac', '2'];
    if (this.volume !== 1) commonArgs.push('-af', `volume=${this.volume}`);

    let ffmpegArgs;
    let nodeStream = null;

    if (resolved && resolved.nodeStream) {
      nodeStream = resolved.nodeStream;
      ffmpegArgs = ['-i', 'pipe:0', ...commonArgs];
    } else {
      const directUrl = (resolved && resolved.directUrl) || url;
      ffmpegArgs = [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', directUrl,
        ...commonArgs,
      ];
    }

    const ffmpeg = new prism.FFmpeg({ args: ffmpegArgs, command: this.ffmpegCommand });

    if (nodeStream) {
      nodeStream.on('error', (err) => {
        logger.error('player', `erro na fonte de stream: ${err.message}`);
      });
      nodeStream.pipe(ffmpeg);
    }

    this._runFfmpegAndPlay(ffmpeg, url);
  }

  _runFfmpegAndPlay(ffmpeg, label) {
    this._cleanupFfmpeg();
    this.currentFfmpeg = ffmpeg;

    let stderrTail = '';
    if (ffmpeg.process && ffmpeg.process.stderr) {
      ffmpeg.process.stderr.on('data', (chunk) => {
        stderrTail += chunk.toString();
        if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000);
      });
    }

    ffmpeg.on('error', (err) => {
      logger.error('player', `erro no ffmpeg ao processar "${label}": ${err.message}`);
    });

    if (ffmpeg.process) {
      ffmpeg.process.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          logger.error('player', `ffmpeg encerrou com codigo ${code} (sinal: ${signal || 'nenhum'}) ao processar "${label}"`);
          if (stderrTail) logger.error('player', `ultimas linhas do ffmpeg: ${stderrTail.slice(-500)}`);
        }
      });
    }

    let bytesSeen = 0;
    ffmpeg.on('data', (chunk) => {
      bytesSeen += chunk.length;
    });

    if (this._byteCheckTimer) clearTimeout(this._byteCheckTimer);
    this._byteCheckTimer = setTimeout(() => {
      if (bytesSeen === 0) {
        logger.warn('player', `nenhum byte de audio recebido apos ${BYTE_CHECK_DELAY_MS}ms para "${label}" - fonte pode estar vazia/corrompida/inacessivel`);
      }
    }, BYTE_CHECK_DELAY_MS);

    const resource = createAudioResource(ffmpeg, { inputType: StreamType.Raw });
    this.audioPlayer.play(resource);
    logger.info('player', `proxima faixa: ${label}`);
  }

  stop() {
    try {
      this.audioPlayer.stop(true);
    } catch (err) {
      // ignora
    }
    this._cleanupFfmpeg();
  }

  _cleanupFfmpeg() {
    if (this._byteCheckTimer) {
      clearTimeout(this._byteCheckTimer);
      this._byteCheckTimer = null;
    }
    if (this.currentFfmpeg) {
      try {
        this.currentFfmpeg.destroy();
      } catch (err) {
        // ignora
      }
      this.currentFfmpeg = null;
    }
  }

  destroy() {
    this._cleanupFfmpeg();
    try {
      this.audioPlayer.stop(true);
    } catch (err) {
      // ignora
    }
    if (this.connection) {
      try {
        this.connection.removeAllListeners();
        this.connection.destroy();
      } catch (err) {
        // ignora
      }
      this.connection = null;
    }
  }

  get AudioPlayerStatus() {
    return AudioPlayerStatus;
  }
}

module.exports = { VoicePlayer, verifyFfmpegBinary };
