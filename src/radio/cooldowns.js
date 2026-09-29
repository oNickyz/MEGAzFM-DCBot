'use strict';

const PRUNE_THRESHOLD = 500;

/**
 * Cooldown de troca de estacao com tres niveis:
 *  - por usuario comum
 *  - global (entre trocas publicas, de qualquer usuario)
 *  - administradores (cooldown minimo, apenas anti-spam acidental)
 *
 * Mantido em memoria (Map), com limpeza periodica leve para nao crescer
 * indefinidamente em servidores grandes.
 */
class StationSwitchCooldown {
  constructor({ userCooldownMs, globalCooldownMs, adminCooldownMs }) {
    this.userCooldownMs = userCooldownMs;
    this.globalCooldownMs = globalCooldownMs;
    this.adminCooldownMs = adminCooldownMs;
    this.lastByUser = new Map();
    this.lastGlobal = 0;
    this.lastAdmin = 0;
  }

  check(userId, isAdmin) {
    const now = Date.now();

    if (isAdmin) {
      const elapsed = now - this.lastAdmin;
      if (elapsed < this.adminCooldownMs) {
        return { ok: false, retryAfterMs: this.adminCooldownMs - elapsed, scope: 'admin' };
      }
      return { ok: true };
    }

    const lastUser = this.lastByUser.get(userId) || 0;
    const userElapsed = now - lastUser;
    if (userElapsed < this.userCooldownMs) {
      return { ok: false, retryAfterMs: this.userCooldownMs - userElapsed, scope: 'user' };
    }

    const globalElapsed = now - this.lastGlobal;
    if (globalElapsed < this.globalCooldownMs) {
      return { ok: false, retryAfterMs: this.globalCooldownMs - globalElapsed, scope: 'global' };
    }

    return { ok: true };
  }

  register(userId, isAdmin) {
    const now = Date.now();
    if (isAdmin) {
      this.lastAdmin = now;
      return;
    }
    this.lastByUser.set(userId, now);
    this.lastGlobal = now;

    if (this.lastByUser.size > PRUNE_THRESHOLD) {
      for (const [id, ts] of this.lastByUser) {
        if (now - ts > this.userCooldownMs) {
          this.lastByUser.delete(id);
        }
      }
    }
  }
}

module.exports = { StationSwitchCooldown };
