'use strict';

const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const AUDIO_EXTENSION = '.mp3';
const STREAM_MARKER_FILE = 'stream.url';

/**
 * Descobre estacoes dentro de STATIONS_PATH.
 * Cada subpasta pode ser:
 *  - uma estacao local: contem arquivos .mp3
 *  - uma estacao de stream: contem um arquivo "stream.url" com uma URL
 *    http(s) na primeira linha (ex: um stream Icecast/Shoutcast publico).
 *
 * Nunca lanca excecao - qualquer falha de leitura resulta em estacao/pasta
 * vazia, nao em crash do processo.
 */
class StationManager {
  constructor(stationsPath) {
    this.stationsPath = stationsPath;
    this.stations = new Map();
  }

  scan() {
    this.stations = new Map();

    let entries = [];
    try {
      entries = fs.readdirSync(this.stationsPath, { withFileTypes: true });
    } catch (err) {
      logger.warn('stations', `nao foi possivel ler a pasta de estacoes (${this.stationsPath}): ${err.message}`);
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const stationName = entry.name;
      const stationDir = path.join(this.stationsPath, stationName);

      try {
        const info = this._scanStationDir(stationDir);
        this.stations.set(stationName, info);

        if (info.type === 'stream') {
          if (info.streamUrl) {
            logger.info('stations', `estacao "${stationName}" configurada como transmissao ao vivo`);
          } else {
            logger.warn('stations', `estacao "${stationName}" possui stream.url invalido ou vazio - marcada como indisponivel`);
          }
        } else if (info.tracks.length === 0) {
          logger.warn('stations', `estacao "${stationName}" nao possui musicas (.mp3) - marcada como indisponivel`);
        }
      } catch (err) {
        logger.warn('stations', `falha ao ler a estacao "${stationName}": ${err.message}`);
        this.stations.set(stationName, { type: 'local', tracks: [], streamUrl: null });
      }
    }
  }

  _scanStationDir(stationDir) {
    let files = [];
    try {
      files = fs.readdirSync(stationDir);
    } catch (err) {
      return { type: 'local', tracks: [], streamUrl: null };
    }

    const streamMarker = files.find((f) => f.toLowerCase() === STREAM_MARKER_FILE);
    if (streamMarker) {
      const streamUrl = this._readStreamUrl(path.join(stationDir, streamMarker));
      return { type: 'stream', tracks: [], streamUrl };
    }

    const tracks = files
      .filter((f) => f.toLowerCase().endsWith(AUDIO_EXTENSION))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((f) => path.join(stationDir, f));

    return { type: 'local', tracks, streamUrl: null };
  }

  _readStreamUrl(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const firstLine = content.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
      if (firstLine && /^https?:\/\//i.test(firstLine)) {
        return firstLine;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  listStationNames() {
    return Array.from(this.stations.keys());
  }

  listAvailableStationNames() {
    return this.listStationNames().filter((name) => this.isStationAvailable(name));
  }

  hasStation(name) {
    return this.stations.has(name);
  }

  getStationInfo(name) {
    return this.stations.get(name) || null;
  }

  isStreamStation(name) {
    const info = this.getStationInfo(name);
    return !!info && info.type === 'stream';
  }

  isStationAvailable(name) {
    const info = this.getStationInfo(name);
    if (!info) return false;
    if (info.type === 'stream') return !!info.streamUrl;
    return info.tracks.length > 0;
  }

  getTracks(name) {
    const info = this.getStationInfo(name);
    if (!info || info.type !== 'local') return [];
    return info.tracks;
  }
}

module.exports = { StationManager, AUDIO_EXTENSION, STREAM_MARKER_FILE };
