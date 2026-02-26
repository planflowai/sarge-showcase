/**
 * useAssetGenerator Hook
 *
 * Composable hook for generating game assets using AI.
 * Pipeline: document_gen → prompt → HuggingFace Stable Diffusion → judge picks best → store
 *
 * Fallback: If HuggingFace unavailable, returns picsum.photos placeholder
 */

import { useState, useCallback } from 'react';
import { capabilityEventBus, useUnifiedCapabilitiesStore } from '@sarge/core';

// ============================================================================
// TYPES
// ============================================================================

export type AssetType = 'sprite' | 'background' | 'ui' | 'tileset' | 'icon' | 'card';

export interface GeneratedAsset {
  id: string;
  url: string;
  type: AssetType;
  prompt: string;
  width: number;
  height: number;
  isMock: boolean;
  createdAt: number;
}

export interface AssetGeneratorState {
  isGenerating: boolean;
  progress: number;  // 0-100
  currentStep: string;
  assets: GeneratedAsset[];
  error: string | null;
}

export interface AssetGeneratorConfig {
  huggingFaceApiKey?: string;
  model?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  batchSize?: number;
  useMockFallback?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2';

const DEFAULT_SIZES: Record<AssetType, { width: number; height: number }> = {
  sprite: { width: 64, height: 64 },
  background: { width: 800, height: 600 },
  ui: { width: 256, height: 128 },
  tileset: { width: 256, height: 256 },
  icon: { width: 32, height: 32 },
  card: { width: 256, height: 384 },
};

const STYLE_PROMPTS: Record<string, string> = {
  pixel: 'pixel art style, 8-bit, retro game aesthetic',
  cartoon: 'cartoon style, vibrant colors, clean lines',
  realistic: 'realistic style, detailed textures, photorealistic',
  anime: 'anime style, cel shaded, Japanese animation aesthetic',
  minimalist: 'minimalist style, simple shapes, flat colors',
  fantasy: 'fantasy art style, magical, detailed illustration',
};

// ============================================================================
// MOCK FALLBACK
// ============================================================================

function getMockAssetUrl(type: AssetType, seed?: string): string {
  const size = DEFAULT_SIZES[type];
  const seedValue = seed || Date.now().toString();
  return `https://picsum.photos/seed/${seedValue}/${size.width}/${size.height}`;
}

function generateMockAsset(type: AssetType, prompt: string): GeneratedAsset {
  const size = DEFAULT_SIZES[type];
  const id = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    url: getMockAssetUrl(type, id),
    type,
    prompt,
    width: size.width,
    height: size.height,
    isMock: true,
    createdAt: Date.now(),
  };
}

// ============================================================================
// HUGGINGFACE API
// ============================================================================

async function generateWithHuggingFace(
  prompt: string,
  apiKey: string,
  model: string = 'stabilityai/stable-diffusion-2'
): Promise<Blob | null> {
  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_inference_steps: 30,
          guidance_scale: 7.5,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AssetGenerator] HuggingFace API error:', errorText);
      return null;
    }

    return await response.blob();
  } catch (error) {
    console.error('[AssetGenerator] HuggingFace request failed:', error);
    return null;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useAssetGenerator(config: AssetGeneratorConfig = {}) {
  const [state, setState] = useState<AssetGeneratorState>({
    isGenerating: false,
    progress: 0,
    currentStep: '',
    assets: [],
    error: null,
  });

  const { capabilities } = useUnifiedCapabilitiesStore();
  const isAssetGeneratorEnabled = capabilities.asset_generator?.enabled ?? false;

  /**
   * Build a detailed prompt for asset generation
   */
  const buildPrompt = useCallback((
    type: AssetType,
    basePrompt: string,
    style?: string
  ): string => {
    const stylePrompt = style ? STYLE_PROMPTS[style] || style : '';
    const typePrompt = {
      sprite: 'game sprite, transparent background, single character or object',
      background: 'game background, seamless, environment scene',
      ui: 'game UI element, clean design, user interface',
      tileset: 'game tileset, seamless tiles, top-down view',
      icon: 'game icon, small detailed, recognizable symbol',
      card: 'trading card art, bordered frame, detailed illustration',
    }[type];

    return `${basePrompt}, ${typePrompt}, ${stylePrompt}, high quality, game asset`.trim();
  }, []);

  /**
   * Generate a single asset
   */
  const generateAsset = useCallback(async (
    type: AssetType,
    prompt: string,
    style?: string
  ): Promise<GeneratedAsset | null> => {
    if (!isAssetGeneratorEnabled) {
      setState(s => ({ ...s, error: 'Asset Generator capability is not enabled' }));
      return null;
    }

    const fullPrompt = buildPrompt(type, prompt, style);

    // Emit start event
    capabilityEventBus.emit('asset:generate_start', {
      type,
      prompt: fullPrompt,
      style,
    });

    setState(s => ({
      ...s,
      isGenerating: true,
      progress: 10,
      currentStep: 'Preparing prompt...',
      error: null,
    }));

    try {
      let asset: GeneratedAsset;

      // Try HuggingFace if API key provided
      if (config.huggingFaceApiKey) {
        setState(s => ({ ...s, progress: 30, currentStep: 'Generating with AI...' }));

        const blob = await generateWithHuggingFace(
          fullPrompt,
          config.huggingFaceApiKey,
          config.model
        );

        if (blob) {
          // Convert blob to data URL
          const url = URL.createObjectURL(blob);
          const size = DEFAULT_SIZES[type];

          asset = {
            id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            url,
            type,
            prompt: fullPrompt,
            width: config.defaultWidth || size.width,
            height: config.defaultHeight || size.height,
            isMock: false,
            createdAt: Date.now(),
          };
        } else {
          // Fallback to mock
          console.log('[AssetGenerator] Using mock fallback');
          asset = generateMockAsset(type, fullPrompt);
        }
      } else {
        // No API key, use mock
        setState(s => ({ ...s, progress: 50, currentStep: 'Using placeholder...' }));
        asset = generateMockAsset(type, fullPrompt);
      }

      setState(s => ({ ...s, progress: 90, currentStep: 'Finalizing...' }));

      // Emit success event
      capabilityEventBus.emit('asset:generated', {
        url: asset.url,
        type: asset.type,
        prompt: asset.prompt,
        width: asset.width,
        height: asset.height,
        isMock: asset.isMock,
      });

      setState(s => ({
        ...s,
        isGenerating: false,
        progress: 100,
        currentStep: 'Complete',
        assets: [...s.assets, asset],
      }));

      return asset;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      capabilityEventBus.emit('asset:generation_failed', {
        error: errorMessage,
        type,
        prompt: fullPrompt,
      });

      setState(s => ({
        ...s,
        isGenerating: false,
        progress: 0,
        currentStep: '',
        error: errorMessage,
      }));

      return null;
    }
  }, [isAssetGeneratorEnabled, config, buildPrompt]);

  /**
   * Generate multiple assets in batch
   */
  const generateBatch = useCallback(async (
    requests: Array<{ type: AssetType; prompt: string; style?: string }>
  ): Promise<GeneratedAsset[]> => {
    const results: GeneratedAsset[] = [];
    const batchSize = config.batchSize || 3;

    setState(s => ({
      ...s,
      isGenerating: true,
      progress: 0,
      currentStep: `Generating ${requests.length} assets...`,
    }));

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(req => generateAsset(req.type, req.prompt, req.style))
      );

      results.push(...batchResults.filter((r): r is GeneratedAsset => r !== null));

      setState(s => ({
        ...s,
        progress: Math.round(((i + batch.length) / requests.length) * 100),
      }));
    }

    // Emit batch complete event
    capabilityEventBus.emit('asset:batch_complete', {
      assets: results.map(a => ({ url: a.url, type: a.type })),
      totalCount: results.length,
    });

    setState(s => ({
      ...s,
      isGenerating: false,
      progress: 100,
      currentStep: 'Batch complete',
    }));

    return results;
  }, [generateAsset, config.batchSize]);

  /**
   * Generate game-specific asset packs
   */
  const generateGamePack = useCallback(async (
    gameType: 'platformer' | 'rpg' | 'puzzle' | 'card',
    theme: string,
    style?: string
  ): Promise<GeneratedAsset[]> => {
    const packRequests: Record<string, Array<{ type: AssetType; prompt: string }>> = {
      platformer: [
        { type: 'sprite', prompt: `${theme} player character, side view` },
        { type: 'sprite', prompt: `${theme} enemy character, side view` },
        { type: 'background', prompt: `${theme} level background, platformer` },
        { type: 'tileset', prompt: `${theme} ground and platform tiles` },
        { type: 'ui', prompt: `${theme} health bar and score display` },
      ],
      rpg: [
        { type: 'sprite', prompt: `${theme} hero character, RPG` },
        { type: 'sprite', prompt: `${theme} NPC character` },
        { type: 'sprite', prompt: `${theme} monster enemy` },
        { type: 'background', prompt: `${theme} world map background` },
        { type: 'icon', prompt: `${theme} sword weapon icon` },
        { type: 'icon', prompt: `${theme} potion item icon` },
      ],
      puzzle: [
        { type: 'sprite', prompt: `${theme} puzzle piece, abstract shape` },
        { type: 'background', prompt: `${theme} puzzle game background, calm` },
        { type: 'ui', prompt: `${theme} timer and score UI` },
      ],
      card: [
        { type: 'card', prompt: `${theme} warrior creature card` },
        { type: 'card', prompt: `${theme} spell magic card` },
        { type: 'card', prompt: `${theme} artifact item card` },
        { type: 'background', prompt: `${theme} card game playmat` },
        { type: 'icon', prompt: `${theme} mana symbol icon` },
      ],
    };

    const requests = (packRequests[gameType] || []).map(r => ({
      ...r,
      style,
    }));

    return generateBatch(requests);
  }, [generateBatch]);

  /**
   * Clear all generated assets
   */
  const clearAssets = useCallback(() => {
    // Revoke object URLs to free memory
    state.assets.forEach(asset => {
      if (!asset.isMock && asset.url.startsWith('blob:')) {
        URL.revokeObjectURL(asset.url);
      }
    });

    setState(s => ({
      ...s,
      assets: [],
      error: null,
    }));
  }, [state.assets]);

  /**
   * Remove a specific asset
   */
  const removeAsset = useCallback((assetId: string) => {
    const asset = state.assets.find(a => a.id === assetId);
    if (asset && !asset.isMock && asset.url.startsWith('blob:')) {
      URL.revokeObjectURL(asset.url);
    }

    setState(s => ({
      ...s,
      assets: s.assets.filter(a => a.id !== assetId),
    }));
  }, [state.assets]);

  /**
   * Export assets as JSON manifest
   */
  const exportManifest = useCallback((): string => {
    return JSON.stringify({
      version: 1,
      generatedAt: Date.now(),
      assets: state.assets.map(a => ({
        id: a.id,
        type: a.type,
        prompt: a.prompt,
        width: a.width,
        height: a.height,
        url: a.url,
        isMock: a.isMock,
      })),
    }, null, 2);
  }, [state.assets]);

  return {
    // State
    ...state,
    isEnabled: isAssetGeneratorEnabled,

    // Actions
    generateAsset,
    generateBatch,
    generateGamePack,
    clearAssets,
    removeAsset,
    exportManifest,

    // Helpers
    buildPrompt,
    getDefaultSize: (type: AssetType) => DEFAULT_SIZES[type],
    getStylePrompt: (style: string) => STYLE_PROMPTS[style],
  };
}

export default useAssetGenerator;
