'use strict';

const HISTORY_LIMIT = 20;

/**
 * Controla a ordem de reproducao dentro de uma estacao:
 * - shuffle opcional
 * - anti-repeat de curto prazo (evita repetir as N ultimas faixas tocadas)
 *
 * Nao mantem copia dos arquivos em memoria, apenas os caminhos.
 */
class Playlist {
  constructor({ shuffleEnabled = true, avoidImmediateRepeat = true } = {}) {
    this.shuffleEnabled = shuffleEnabled;
    this.avoidImmediateRepeat = avoidImmediateRepeat;
    this.recentHistory = [];
  }

  setShuffleEnabled(enabled) {
    this.shuffleEnabled = !!enabled;
  }

  resetHistory() {
    this.recentHistory = [];
  }

  _recentSet(historySize) {
    if (!(historySize > 0)) return new Set();
    return new Set(this.recentHistory.slice(-historySize));
  }

  pickNext(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    if (tracks.length === 1) {
      this._registerPlayed(tracks[0]);
      return tracks[0];
    }

    if (!this.shuffleEnabled) {
      // Sem shuffle: segue ordem simples baseada na ultima tocada.
      const lastPlayed = this.recentHistory[this.recentHistory.length - 1];
      const lastIndex = lastPlayed ? tracks.indexOf(lastPlayed) : -1;
      const nextIndex = (lastIndex + 1) % tracks.length;
      const next = tracks[nextIndex];
      this._registerPlayed(next);
      return next;
    }

    const historySize = this.avoidImmediateRepeat
      ? Math.min(HISTORY_LIMIT, Math.max(1, Math.floor(tracks.length / 2)))
      : 0;
    const recent = this._recentSet(historySize);

    let candidates = tracks.filter((t) => !recent.has(t));
    if (candidates.length === 0) candidates = tracks;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this._registerPlayed(chosen);
    return chosen;
  }

  /**
   * Simula os proximos "count" itens sem alterar o estado real do historico.
   * Usado por /fila - e uma previsao, nao uma fila garantida.
   */
  previewUpcoming(tracks, count) {
    if (!Array.isArray(tracks) || tracks.length === 0) return [];

    const clone = new Playlist({
      shuffleEnabled: this.shuffleEnabled,
      avoidImmediateRepeat: this.avoidImmediateRepeat,
    });
    clone.recentHistory = [...this.recentHistory];

    const preview = [];
    for (let i = 0; i < count; i++) {
      const next = clone.pickNext(tracks);
      if (!next) break;
      preview.push(next);
    }
    return preview;
  }

  _registerPlayed(track) {
    this.recentHistory.push(track);
    if (this.recentHistory.length > HISTORY_LIMIT) {
      this.recentHistory.shift();
    }
  }

  getRecentHistory(limit) {
    return this.recentHistory.slice(-limit).reverse();
  }
}

module.exports = { Playlist };
