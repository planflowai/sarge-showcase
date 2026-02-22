      storage: createDebouncedStorage(),
    }
  )
    },
    {
      name: "journal",
      storage: createDebouncedStorage(),
    }
  )
);
    });

    // Collect dates from analyses
    analysisHistory.forEach((a) => {
      const date = new Date(a.timestamp);
      date.setHours(0, 0, 0, 0);
      dateSet.add(date.toISOString());
    });

    // Convert back to Date objects and sort descending
    return Array.from(dateSet)
      .map((iso) => new Date(iso))
      .sort((a, b) => b.getTime() - a.getTime());
  },

  // Conversation actions
  createConversation: (title) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conversation: JournalConversation = {
      id,
      title: title || `Chat ${new Date().toLocaleDateString()}`,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const updated = [...get().conversations, conversation];
    set({ conversations: updated, activeConversationId: id });
    saveConversations(updated);
    return id;
  },

  addMessageToConversation: (conversationId, message) => {
    const { conversations } = get();
    const updated = conversations.map((c) => {
      if (c.id === conversationId) {
        const newMessage: JournalChatMessage = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
        };
        return {
          ...c,
          updatedAt: new Date().toISOString(),
          messages: [...c.messages, newMessage],
        };
      }
      return c;
    });
    set({ conversations: updated });
    saveConversations(updated);
  },

  getConversation: (id) => {
    return get().conversations.find((c) => c.id === id);
  },

  getConversations: () => {
    return get().conversations.slice().reverse(); // Most recent first
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
  },

  deleteConversation: (id) => {
    const updated = get().conversations.filter((c) => c.id !== id);
    const activeId = get().activeConversationId;
    set({
      conversations: updated,
      activeConversationId: activeId === id ? null : activeId,
    });
    saveConversations(updated);
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    if (!activeConversationId) return undefined;
    return conversations.find((c) => c.id === activeConversationId);
  },

  // Shared context actions - connect Analysis to Chat
  setCurrentAnalysis: (analysis, provider) => {
    set((state) => ({
      sharedContext: {
        ...state.sharedContext,
        currentAnalysis: analysis,
        currentAnalysisProvider: provider,
      },
      latestAnalysis: analysis, // Also update latestAnalysis for backward compat
    }));
  },

  setCurrentPrompts: (prompts) => {
    set((state) => ({
      sharedContext: { ...state.sharedContext, currentPrompts: prompts },
    }));
  },

  setSelectedBatchLog: (log) => {
    set((state) => ({
      sharedContext: { ...state.sharedContext, selectedBatchLog: log },
    }));
  },

  setLastSuggestion: (suggestion) => {
    set((state) => ({
      sharedContext: { ...state.sharedContext, lastSuggestion: suggestion },
    }));
  },

  clearSharedContext: () => {
    set({ sharedContext: { ...defaultSharedContext } });
  }),
    {
      name: "journal",
      storage: createDebouncedStorage(),
    }
  )
);
