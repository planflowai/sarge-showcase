export interface ForensicLogEntry {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  timestamp: string;
  category: 'session' | 'round' | 'response' | 'detection' | 'judge' | 'system' | 'human' | 'kill' | 'observation';
  event: string;
  severity: 'info' | 'warning' | 'critical' | 'success';

  input?: string;
  output?: string;

  modelState?: {
    modelId: string;
    agentRole: 'd1' | 'd2' | 'd3' | 'judge';
    tokens: number;
    promptTokens?: number;
    completionTokens?: number;
    responseTimeMs: number;
    temperature?: number;
  };

  aiDecision: {
    action: string;
    confidence: number;
    modelVersion: string;
    explanation: string;
    factors: string[];
    thresholds: Record<string, string>;
  };

  medicationContext: {
    drugName: string;
    prescribedDose: string;
    administeredDose: string;
    variance: string;
  };

  actors: {
    aiSystem: string;
    humanUsers: string[];
    overrideOccurred: boolean;
    overrideReason: string;
  };

  dataLineage: {
    sources: string[];
    transformations: string[];
    validationChecks: string[];
  };

  compliance: {
    regulations: string[];
    retentionUntil: string;
    auditReady: boolean;
    airGapCompliant?: boolean;
    externalConnections?: string;
  };

  previousValues?: Record<string, unknown>;
  alertHistory: string[];
  acknowledgments: string[];
  relatedEvents: string[];
  systemState: {
    responseTimeMs?: number;
    tokenCount?: number;
    roundNumber?: number;
    echoCountSoFar?: number;
    truthAnchorCount?: number;
  };

  hash: string;
  previousHash: string;
}

export interface ForensicSession {
  id: string;
  type: 'single' | 'batch';
  startTime: string;
  endTime?: string;
  config: {
    mode: string;
    rounds: number;
    poisonRound?: number;
    poisonAgent?: string;
    models: Record<string, string>;
    batchSize?: number;
  };
  entryCount: number;
  verdict?: string;
}

export type ForensicLogViewType = 'timeline' | 'investigation' | 'replay' | 'export';
