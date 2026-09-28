'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');
const path = require('path');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  entersState,
} = require('@discordjs/voice');
const prism = require('prism-media');
const logger = require('../utils/logger');

// FFmpeg empacotado via ffmpeg-static: garante que a radio funcione mesmo em
// hosts (como a Discloud) que nao tem o binario do FFmpeg instalado no sistema.
// Se o pacote nao estiver disponivel por algum motivo, cai de volta para o
// "ffmpeg"/"avconv" do PATH do sistema (comportamento antigo).
let bundledFfmpegPath = null;
try {
  // eslint-disable-next-line global-require
  bundledFfmpegPath = require('ffmpeg-static');
  if (bundledFfmpegPath && !fs.existsSync(bundledFfmpegPath)) {
    bundledFfmpegPath = null;
  }
} catch (_) {
  bundledFfmpegPath = null;
}

/**
 * O fato do binario existir no disco nao garante que ele realmente executa
 * (arquitetura de CPU incompativel, biblioteca do sistema faltando, sem
 * permissao de execucao etc). Isso roda uma unica vez no startup e deixa
 * bem claro no log se o FFmpeg realmente funciona nesse host, em vez de
 * falhar silenciosamente so quando uma musica tentar tocar.
 */
function verifyFfmpegBinary(command) {
  const bin = command || 'ffmpeg';
  try {
    const output = execFileSync(bin, ['-version'], { timeout: 5000 }).toString();
    const firstLine = output.split('\n')[0].trim();
    logger.info('player', `ffmpeg testado com sucesso: ${firstLine}`);
    return true;
  } catch (err) {
    logger.error('player', `o binario do ffmpeg em "${bin}" NAO executou (${err.message}). A radio ficara sem audio ate isso ser corrigido.`);
    return false;
  }
}

const RECONNECT_DELAY_MS = 5000;

class VoicePlayer {
  /**
   * @param {object} opts
   * @param {string} opts.voiceChannelId
   * @param {string} opts.guildId
   * @param {import('discord.js').VoiceAdapterCreator} opts.adapterCreator
   * @param {number} opts.volume
   * @param {boolean} opts.autoReconnect
   * @param {string} [opts.ffmpegPath] - caminho customizado (env FFMPEG_PATH), tem prioridade sobre o bundlado
   */
  constructor({ voiceChannelId, guildId, adapterCreator, volume, autoReconnect, ffmpegPath }) {
    this.voiceChannelId = voiceChannelId;
    this.guildId = guildId;
    this.adapterCreator = adapterCreator;
    this.volume = volume;
    this.autoReconnect = autoReconnect;

    this.ffmpegCommand = ffmpegPath || bundledFfmpegPath || null;
    if (this.ffmpegCommand) {
      logger.info('player', `usando ffmpeg em: ${this.ffmpegCommand}`);
    } else {
      logger.warn('player', 'ffmpeg-static indisponivel, tentando usar "ffmpeg"/"avconv" do PATH do sistema');
    }
    verifyFfmpegBinary(this.ffmpegCommand);

    this.connection = null;
    this.audioPlayer = createAudioPlayer();
    this.currentFfmpeg = null;
    this._reconnecting = false;

    /** Chamado quando o player fica ocioso e precisa da proxima faixa. */
    this.onNeedNextTrack = null;
    /** Chamado quando um erro de reproducao ocorre para a faixa atual. */
    this.onTrackError = null;

    this._bindPlayerEvents();
  }

  _bindPlayerEvents() {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this._cleanupFfmpeg();
      if (typeof this.onNeedNextTrack === 'function') {
        this.onNeedNextTrack();
      }
    });

    this.audioPlayer.on('error', (error) => {
      logger.error('player', `Erro na reproducao: ${error.message}`);
      this._cleanupFfmpeg();
      if (typeof this.onTrackError === 'function') {
        this.onTrackError(error);
      }
    });
  }

  connect() {
    // Garante que nunca fiquemos com duas conexoes de voz ativas nem com
    // listeners duplicados de uma conexao antiga que ainda nao foi limpa.
    if (this.connection) {
      try {
        this.connection.removeAllListeners();
        this.connection.destroy();
      } catch (_) {
        // conexao ja pode estar destruida, ignora
      }
    }

    this.connection = joinVoiceChannel({
      channelId: this.voiceChannelId,
      guildId: this.guildId,
      adapterCreator: this.adapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    this.connection.subscribe(this.audioPlayer);
    this._bindConnectionEvents();

    return this.connection;
  }

  /**
   * Espera a conexao realmente atingir o estado Ready. A chamada de connect()
   * retorna quase instantaneamente, mas a conexao ainda precisa completar o
   * handshake de voz (que usa UDP, ao contrario do resto do bot que usa
   * WebSocket/TCP) antes que qualquer audio realmente saia. Sem essa espera,
   * o bot poderia "achar" que esta tudo certo enquanto a etapa de UDP trava
   * silenciosamente — exatamente o tipo de problema que nao gera nenhum erro
   * visivel, so silencio.
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  async waitUntilReady(timeoutMs = 15000) {
    if (!this.connection) return false;
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, timeoutMs);
      logger.info('voice', 'conexao de voz pronta (Ready) — audio deve fluir normalmente');
      return true;
    } catch (err) {
      logger.error('voice', `a conexao de voz NAO atingiu o estado "Ready" em ${Math.round(timeoutMs / 1000)}s — a radio pode aparentar estar tocando sem nenhum audio realmente sair. A conexao principal do bot usa WebSocket/TCP (por isso os comandos funcionam normalmente), mas o audio de voz usa UDP separadamente; se esse handshake nunca completa, costuma ser trafego UDP bloqueado/instavel na rede do host.`);
      return false;
    }
  }

  _bindConnectionEvents() {
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      logger.warn('voice', 'conexao caiu, tentando reconectar...');
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
        // Discord esta apenas trocando de canal/sessao, deixa o proprio connection lidar
      } catch (err) {
        this._scheduleReconnect();
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      this._scheduleReconnect();
    });

    this.connection.on('error', (err) => {
      logger.error('voice', `erro de conexao: ${err.message}`);
    });
  }

  _scheduleReconnect() {
    if (!this.autoReconnect) return;
    if (this._reconnecting) return; // evita tentativas simultaneas
    this._reconnecting = true;

    logger.info('voice', `reconectando em ${Math.round(RECONNECT_DELAY_MS / 1000)}s...`);

    setTimeout(() => {
      try {
        this.connect();
        logger.info('voice', 'conectado ao canal');
      } catch (err) {
        logger.error('voice', `falha ao reconectar: ${err.message}`);
      } finally {
        this._reconnecting = false;
        if (typeof this.onReconnected === 'function') {
          this.onReconnected();
        }
      }
    }, RECONNECT_DELAY_MS);
  }

  /**
   * Forca uma reconexao manual ao canal de voz (usado pelo /reconnect).
   * Reaproveita o mesmo trava de reconexao usada pelo processo automatico,
   * entao nunca cria duas conexoes simultaneas mesmo se chamado repetidamente.
   * @returns {boolean} true se a reconexao foi executada, false se ja havia uma em andamento
   */
  forceReconnect() {
    if (this._reconnecting) {
      logger.warn('voice', 'reconexao ja em andamento, ignorando novo pedido');
      return false;
    }

    this._reconnecting = true;
    try {
      this.connect();
      logger.info('voice', 'reconectado manualmente ao canal');
      if (typeof this.onReconnected === 'function') {
        this.onReconnected();
      }
      return true;
    } catch (err) {
      logger.error('voice', `falha ao reconectar manualmente: ${err.message}`);
      return false;
    } finally {
      this._reconnecting = false;
    }
  }

  /**
   * Define o volume usado nas proximas reproducoes (nao afeta a faixa ja em execucao
   * ate a proxima chamada de play(), que quem chama pode disparar para aplicar na hora).
   */
  setVolume(value) {
    this.volume = value;
  }

  /**
   * Reproduz um arquivo local via FFmpeg (streaming, sem carregar tudo na RAM).
   * @param {string} filePath
   */
  play(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo nao encontrado: ${filePath}`);
    }

    this._cleanupFfmpeg();

    const ffmpegArgs = [
      '-i', filePath,
      '-analyzeduration', '0',
      '-loglevel', 'error',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
    ];

    if (this.volume !== 1) {
      ffmpegArgs.push('-af', `volume=${this.volume}`);
    }

    const ffmpegOptions = { args: ffmpegArgs };
    if (this.ffmpegCommand) {
      ffmpegOptions.command = this.ffmpegCommand;
    }

    const ffmpeg = new prism.FFmpeg(ffmpegOptions);
    this.currentFfmpeg = ffmpeg;

    ffmpeg.on('error', (err) => {
      logger.error('player', `ffmpeg falhou em "${filePath}": ${err.message}`);
    });

    // O processo do ffmpeg pode morrer (arquitetura incompativel, biblioteca do
    // sistema faltando, etc) sem que a lib emita um evento 'error' utilizavel —
    // nesse caso a faixa "toca" silenciosamente sem nenhum audio real saindo.
    // Aqui capturamos o codigo de saida e o stderr do proprio ffmpeg para deixar
    // esse tipo de falha visivel no log em vez de silenciosa.
    const ffmpegProcess = ffmpeg.process || ffmpeg._process;
    if (ffmpegProcess) {
      const stderrChunks = [];
      if (ffmpegProcess.stderr) {
        ffmpegProcess.stderr.on('data', (chunk) => {
          stderrChunks.push(chunk);
          let total = stderrChunks.reduce((n, c) => n + c.length, 0);
          while (total > 4096 && stderrChunks.length > 1) {
            total -= stderrChunks.shift().length;
          }
        });
      }
      ffmpegProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          const stderrText = Buffer.concat(stderrChunks).toString().trim().slice(-500);
          logger.error('player', `processo ffmpeg encerrou com codigo ${code}${signal ? ` (sinal ${signal})` : ''} ao tocar "${path.basename(filePath)}"${stderrText ? `: ${stderrText}` : ''}`);
        }
      });
    }

    const resource = createAudioResource(ffmpeg, {
      inputType: StreamType.Raw,
      inlineVolume: false,
    });

    // Diagnostico extra: se o ffmpeg nao gerar nenhum byte de audio real nos
    // primeiros segundos (arquivo vazio/corrompido, ou o proprio processo
    // travado), isso fica visivel no log em vez de tocar "silencio" sem aviso.
    let bytesReceived = 0;
    const onData = (chunk) => { bytesReceived += chunk.length; };
    ffmpeg.on('data', onData);
    setTimeout(() => {
      if (bytesReceived === 0 && this.currentFfmpeg === ffmpeg) {
        logger.warn('player', `nenhum byte de audio foi gerado para "${path.basename(filePath)}" apos 3s — o arquivo pode estar vazio ou corrompido`);
      }
    }, 3000);

    this.audioPlayer.play(resource);
  }

  stop() {
    this.audioPlayer.stop(true);
    this._cleanupFfmpeg();
  }

  _cleanupFfmpeg() {
    if (this.currentFfmpeg) {
      try {
        this.currentFfmpeg.destroy();
      } catch (_) {
        // ignora
      }
      this.currentFfmpeg = null;
    }
  }

  destroy() {
    this.stop();
    if (this.connection) {
      try {
        this.connection.destroy();
      } catch (_) {
        // ignora
      }
    }
  }
}

module.exports = { VoicePlayer };
