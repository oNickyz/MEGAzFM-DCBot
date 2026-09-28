'use strict';

class StationSwitchCooldown {
  constructor({ userCooldownMs, globalCooldownMs, adminCooldownMs }) {
    this.userCooldownMs = userCooldownMs;
    this.globalCooldownMs = globalCooldownMs;
    this.adminCooldownMs = adminCooldownMs;

    this.lastGlobalSwitch = 0;
    this.lastByUser = new Map(); // userId -> timestamp
    this.lastAdminSwitch = 0;
  }

  /**
   * @param {boolean} isAdmin
   * @returns {{ ok: boolean, retryAfterMs?: number, scope?: 'user'|'global'|'admin' }}
   */
  check(userId, isAdmin) {
    const now = Date.now();

    if (isAdmin) {
      const elapsed = now - this.lastAdminSwitch;
      if (elapsed < this.adminCooldownMs) {
        return { ok: false, retryAfterMs: this.adminCooldownMs - elapsed, scope: 'admin' };
      }
      return { ok: true };
    }

    const globalElapsed = now - this.lastGlobalSwitch;
    if (globalElapsed < this.globalCooldownMs) {
      return { ok: false, retryAfterMs: this.globalCooldownMs - globalElapsed, scope: 'global' };
    }

    const lastUser = this.lastByUser.get(userId) || 0;
    const userElapsed = now - lastUser;
    if (userElapsed < this.userCooldownMs) {
      return { ok: false, retryAfterMs: this.userCooldownMs - userElapsed, scope: 'user' };
    }

    return { ok: true };
  }

  register(userId, isAdmin) {
    const now = Date.now();
    if (isAdmin) {
      this.lastAdminSwitch = now;
      return;
    }
    this.lastGlobalSwitch = now;
    this.lastByUser.set(userId, now);

    // Evita crescimento indefinido em servidores com muitos usuarios distintos:
    // limpa entradas que ja passaram do proprio cooldown quando o Map cresce demais.
    if (this.lastByUser.size > 500) {
      for (const [id, ts] of this.lastByUser) {
        if (now - ts > this.userCooldownMs) {
          this.lastByUser.delete(id);
        }
      }
    }
  }
}

module.exports = { StationSwitchCooldown };
