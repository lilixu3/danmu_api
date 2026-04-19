export function isMatchDebugEnabled(url) {
  if (!url || !url.searchParams) return false;
  const raw = url.searchParams.get('debug');
  if (raw == null) return false;
  return raw === '' || raw === '1' || raw === 'true' || raw === 'yes';
}

export function createMatchDebugCollector(enabled = false) {
  if (!enabled) {
    return {
      enabled: false,
      set() {},
      addAttempt() {},
      finish() {},
      toJSON() { return undefined; }
    };
  }

  const state = {
    version: 1,
    input: {},
    normalized: {},
    preference: {},
    search: {
      used: false,
      skippedReason: null,
      rawCandidateCount: 0,
      candidateCount: 0,
      candidates: []
    },
    ai: {
      attempted: false,
      matched: false,
      reasonCode: null,
      skippedReason: null,
      latencyMs: 0,
      preferredPlatform: null,
      selectedAnimeId: null,
      selectedAnimeTitle: null,
      selectedEpisodeTitle: null
    },
    attempts: [],
    final: {}
  };

  return {
    enabled: true,
    set(section, value) {
      state[section] = value;
    },
    addAttempt(attempt) {
      state.attempts.push(attempt);
    },
    finish(finalState) {
      state.final = finalState;
    },
    toJSON() {
      return state;
    }
  };
}
