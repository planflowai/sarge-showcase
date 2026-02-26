// @sarge/chat — Chat + multi-chat module, snaps onto @sarge/core
// Default barrel = client-safe only (no transitive @sarge/diagnostics or @sarge/builder)
// For forensic/test components, use:
//   import { ... } from '@sarge/chat/index.server'

export * from './index.client';
