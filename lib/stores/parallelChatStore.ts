      storage: createDebouncedStorage(),
    }
  )
    },
    {
      name: "parallel-chat",
      storage: createDebouncedStorage(),
    }
  )
);

    // Create context message
    const contextContent = `Context from another model (${fromModelName}):\n${message.content}`;

    // Send as a new user message to the target column
    sendToColumn(toColumnId, contextContent);
  },

  shareMessageToAll: (fromColumnId: string, message: Message) => {
    const { columns, sendToColumn, activeColumnCount } = get();
    const fromColumn = columns.find(c => c.id === fromColumnId);

    if (!fromColumn) return;

    // Get model display name
    const fromModelName = fromColumn.model.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    // Create context message
    const contextContent = `Context from another model (${fromModelName}):\n${message.content}`;

    // Send to all OTHER columns (not the source) that are currently visible
    columns.slice(0, activeColumnCount).forEach(col => {
      if (col.id !== fromColumnId) {
        sendToColumn(col.id, contextContent);
      }
    });
  },

  setColumnSending: (columnId: string, sending: boolean) => {
    set(state => ({
      columns: state.columns.map(c =>
        c.id === columnId ? { ...c, sending } : c
      ),
    }));
  },

  addMessageToColumn: (columnId: string, message: Message) => {
    set(state => {
      const newColumns = state.columns.map(c =>
        c.id === columnId
          ? { ...c, messages: [...c.messages, message] }
          : c
      );
      // Save to storage
      const column = newColumns.find(c => c.id === columnId);
      if (column) {
        saveMessagesToStorage(column.conversationId, column.messages);
      }
      return { columns: newColumns };
    });
  },

  clearColumn: (columnId: string) => {
    set(state => {
      const newColumns = state.columns.map(c =>
        c.id === columnId
          ? { ...c, messages: [], conversationId: `parallel-${c.id}-${generateId()}` }
          : c
      );
      saveColumnsToStorage(newColumns);
      return { columns: newColumns };
    });
  },

  clearAllColumns: () => {
    set(state => {
      const newColumns = state.columns.map(c => ({
        ...c,
        messages: [],
        conversationId: `parallel-${c.id}-${generateId()}`
      }));
      saveColumnsToStorage(newColumns);
      return { columns: newColumns };
    });
  },

  getOtherColumns: (excludeColumnId: string) => {
    return get().columns.filter(c => c.id !== excludeColumnId);
  },

  saveCurrentSession: (name?: string) => {
    const { columns, activeColumnCount, savedSessions } = get();
    const now = Date.now();
    const autoName = name?.trim() || (() => {
      const d = new Date(now);
      return `Session — ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    })();
    const session: SavedParallelSession = {
      id: `session-${generateId()}`,
      name: autoName,
      savedAt: now,
      activeColumnCount,
      columns: columns.slice(0, activeColumnCount).map(c => ({
        id: c.id,
        provider: c.provider,
        model: c.model,
        roleId: c.roleId,
        messages: [...c.messages],
      })),
    };
    const newSessions = [session, ...savedSessions];
    writeSavedSessions(newSessions);
    set({ savedSessions: newSessions });
    return session;
  },

  loadSession: (sessionId: string) => {
    const { savedSessions } = get();
    const session = savedSessions.find(s => s.id === sessionId);
    if (!session) return;

    // Rebuild columns from session
    const newColumns: ChatColumn[] = session.columns.map(sc => ({
      id: sc.id,
      provider: sc.provider,
      model: sc.model,
      roleId: sc.roleId,
      messages: sc.messages,
      sending: false,
      conversationId: `parallel-${sc.id}-${generateId()}`,
    }));
    // Pad to 4 columns
    while (newColumns.length < 4) {
      const idx = newColumns.length;
      const defaults: Array<[Provider, string]> = [
        ["anthropic", "claude-sonnet-4-20250514"],
        ["openai", "gpt-4o"],
        ["google", "gemini-1.5-pro"],
        ["ollama", "llama3.2:latest"],
      ];
      const [prov, model] = defaults[idx] || ["ollama", "llama3.2:latest"];
      newColumns.push(createDefaultColumn(String(idx + 1), prov, model));
    }
    // Persist to live storage
    saveColumnsToStorage(newColumns);
    newColumns.forEach(c => saveMessagesToStorage(c.conversationId, c.messages));
    set({ columns: newColumns, activeColumnCount: session.activeColumnCount });
  },

  deleteSession: (sessionId: string) => {
    const { savedSessions } = get();
    const newSessions = savedSessions.filter(s => s.id !== sessionId);
    writeSavedSessions(newSessions);
    set({ savedSessions: newSessions });
  }),
    {
      name: "parallel-chat",
      storage: createDebouncedStorage(),
    }
  )
);
