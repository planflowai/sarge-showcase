      storage: createDebouncedStorage(),
    }
  )
    },
    {
      name: "pin",
      storage: createDebouncedStorage(),
    }
  )
);
    set({ pinHash, pinEnabled: true, isLocked: false });
  },

  removePin: () => {
    savePinData(null, false);
    localStorage.removeItem(TIMEOUT_KEY);
    set({ pinHash: null, pinEnabled: false, isLocked: false });
  },

  verifyPin: (pin: string): boolean => {
    const hash = hashPinSync(pin);
    return hash === get().pinHash;
  },

  unlock: () => {
    localStorage.setItem(TIMEOUT_KEY, Date.now().toString());
    set({ isLocked: false });
  },

  checkTimeout: () => {
    const state = get();
    if (!state.pinEnabled || !state.pinHash) return;
    const lastActive = localStorage.getItem(TIMEOUT_KEY);
    if (!lastActive) {
      set({ isLocked: true });
      return;
    }
    const elapsed = Date.now() - parseInt(lastActive, 10);
    if (elapsed > TIMEOUT_MS) {
      set({ isLocked: true });
    }
  },

  touchActivity: () => {
    if (get().pinEnabled) {
      localStorage.setItem(TIMEOUT_KEY, Date.now().toString());
    }
  }),
    {
      name: "pin",
      storage: createDebouncedStorage(),
    }
  )
);
