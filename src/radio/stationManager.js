'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const AUDIO_EXTENSION = '.mp3';

class StationManager {
  /**
   * @param {string} stationsPath - pasta raiz onde ficam as estacoes
   */
  constructor(stationsPath) {
    this.stationsPath = stationsPath;
    // Map<stationName, string[] caminhosDosArquivos>
    this.stations = new Map();
  }

  /**
   * Varre o disco e reconstroi a lista de estacoes e faixas.
   * Nao carrega nenhum audio em memoria, apenas os caminhos dos arquivos.
   */
  scan() {
    const found = new Map();

    if (!fs.existsSync(this.stationsPath)) {
      logger.error('stations', `Pasta de estacoes nao encontrada: ${this.stationsPath}`);
      this.stations = found;
      return { stationCount: 0, trackCount: 0 };
    }

    let entries = [];
    try {
      entries = fs.readdirSync(this.stationsPath, { withFileTypes: true });
    } catch (err) {
      logger.error('stations', `Falha ao ler pasta de estacoes: ${err.message}`);
      this.stations = found;
      return { stationCount: 0, trackCount: 0 };
    }

    let totalTracks = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const stationName = entry.name;
      const stationDir = path.join(this.stationsPath, stationName);

      let files = [];
      try {
        files = fs
          .readdirSync(stationDir, { withFileTypes: true })
          .filter((f) => f.isFile() && path.extname(f.name).toLowerCase() === AUDIO_EXTENSION)
          .map((f) => path.join(stationDir, f.name))
          .sort();
      } catch (err) {
        logger.warn('stations', `Falha ao ler pasta "${stationName}": ${err.message}`);
        files = [];
      }

      found.set(stationName, files);
      totalTracks += files.length;

      if (files.length === 0) {
        logger.warn('stations', `Estacao "${stationName}" nao possui musicas (.mp3) - marcada como indisponivel`);
      }
    }

    this.stations = found;

    return { stationCount: found.size, trackCount: totalTracks };
  }

  listStationNames() {
    return Array.from(this.stations.keys());
  }

  listAvailableStationNames() {
    return this.listStationNames().filter((name) => this.getTracks(name).length > 0);
  }

  hasStation(name) {
    return this.stations.has(name);
  }

  isStationAvailable(name) {
    return this.hasStation(name) && this.getTracks(name).length > 0;
  }

  getTracks(name) {
    return this.stations.get(name) || [];
  }
}

module.exports = { StationManager, AUDIO_EXTENSION };
