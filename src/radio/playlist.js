'use strict';

/**
 * Escolhe faixas de forma aleatoria dentro de uma lista de arquivos,
 * evitando repetir imediatamente as ultimas tocadas (historico curto).
 * Estado leve: guarda apenas caminhos de arquivo, nunca audio.
 */
class Playlist {
  constructor({ shuffleEnabled = true, avoidImmediateRepeat = true } = {}) {
    this.shuffleEnabled = shuffleEnabled;
    this.avoidImmediateRepeat = avoidImmediateRepeat;
    this.recentHistory = []; // ultimos caminhos tocados, mais recente no fim
  }

  resetHistory() {
    this.recentHistory = [];
  }

  /**
   * @param {string[]} tracks - caminhos completos disponiveis na estacao atual
   * @returns {string|null} caminho da proxima faixa, ou null se nao houver faixas
   */
  pickNext(tracks) {
    if (!tracks || tracks.length === 0) return null;

    if (tracks.length === 1) {
      this._remember(tracks[0]);
      return tracks[0];
    }

    if (!this.shuffleEnabled) {
      // Modo sequencial simples: proxima apos a ultima tocada
      const lastIndex = this.recentHistory.length > 0
        ? tracks.indexOf(this.recentHistory[this.recentHistory.length - 1])
        : -1;
      const nextIndex = (lastIndex + 1) % tracks.length;
      const chosen = tracks[nextIndex];
      this._remember(chosen);
      return chosen;
    }

    const historySize = this._historySize(tracks.length);

    // Nota: "slice(-0)" em JS equivale a "slice(0)" (retorna o array inteiro),
    // entao quando historySize e 0 precisamos usar um Set vazio explicitamente.
    const recentSet = historySize > 0
      ? new Set(this.recentHistory.slice(-historySize))
      : new Set();

    let candidates = tracks.filter((t) => !recentSet.has(t));

    if (candidates.length === 0) {
      candidates = tracks;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    this._remember(chosen);
    return chosen;
  }

  /**
   * Simula as proximas N escolhas sem alterar o estado real do historico.
   * Usado apenas para exibir uma previsao (ex: /fila), nunca para decidir
   * a proxima musica de verdade — isso continua acontecendo em pickNext().
   * @param {string[]} tracks
   * @param {number} count
   * @returns {string[]}
   */
  previewUpcoming(tracks, count = 3) {
    if (!tracks || tracks.length === 0) return [];

    const results = [];
    const tempHistory = [...this.recentHistory];

    if (!this.shuffleEnabled) {
      let lastIndex = tempHistory.length > 0
        ? tracks.indexOf(tempHistory[tempHistory.length - 1])
        : -1;
      for (let i = 0; i < count && i < tracks.length; i++) {
        lastIndex = (lastIndex + 1) % tracks.length;
        results.push(tracks[lastIndex]);
      }
      return results;
    }

    for (let i = 0; i < count && i < tracks.length; i++) {
      const historySize = this._historySize(tracks.length);
      const recentSet = historySize > 0 ? new Set(tempHistory.slice(-historySize)) : new Set();
      let candidates = tracks.filter((t) => !recentSet.has(t));
      if (candidates.length === 0) candidates = tracks;

      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      results.push(chosen);
      tempHistory.push(chosen);
    }

    return results;
  }

  setShuffleEnabled(enabled) {
    this.shuffleEnabled = Boolean(enabled);
  }

  _historySize(trackCount) {
    return this.avoidImmediateRepeat
      ? Math.min(Math.max(1, Math.floor(trackCount / 2)), 10)
      : 0;
  }

  _remember(track) {
    this.recentHistory.push(track);
    if (this.recentHistory.length > 20) {
      this.recentHistory.shift();
    }
  }
}

module.exports = { Playlist };
