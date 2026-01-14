import { useState, useCallback, useEffect } from "react";
import * as tauri from "../lib/tauri";
import type { Space, CreateSpaceInput, UpdateSpaceInput } from "../types";

export interface UseSpacesReturn {
  spaces: Space[];
  currentSpaceId: string | null;
  isLoading: boolean;
  selectSpace: (spaceId: string | null) => void;
  createSpace: (input: CreateSpaceInput) => Promise<Space>;
  updateSpace: (input: UpdateSpaceInput) => Promise<Space>;
  deleteSpace: (id: string) => Promise<boolean>;
  addItemToSpace: (spaceId: string, itemId: string) => Promise<void>;
  removeItemFromSpace: (spaceId: string, itemId: string) => Promise<boolean>;
  getItemSpaces: (itemId: string) => Promise<string[]>;
  setItemSpaces: (itemId: string, spaceIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSpaces(): UseSpacesReturn {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load spaces on mount
  useEffect(() => {
    const loadSpaces = async () => {
      try {
        const loaded = await tauri.getAllSpaces();
        setSpaces(loaded);
      } catch (err) {
        console.error("Failed to load spaces:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSpaces();
  }, []);

  const selectSpace = useCallback((spaceId: string | null) => {
    setCurrentSpaceId(spaceId);
  }, []);

  const createSpace = useCallback(async (input: CreateSpaceInput) => {
    const space = await tauri.createSpace(input);
    setSpaces((prev) => [...prev, space]);
    return space;
  }, []);

  const updateSpace = useCallback(async (input: UpdateSpaceInput) => {
    const space = await tauri.updateSpace(input);
    setSpaces((prev) => prev.map((s) => (s.id === space.id ? space : s)));
    return space;
  }, []);

  const deleteSpace = useCallback(
    async (id: string) => {
      const result = await tauri.deleteSpace(id);
      if (result) {
        setSpaces((prev) => prev.filter((s) => s.id !== id));
        // If we deleted the current space, reset to "All Spaces"
        if (currentSpaceId === id) {
          setCurrentSpaceId(null);
        }
      }
      return result;
    },
    [currentSpaceId]
  );

  const addItemToSpace = useCallback(
    async (spaceId: string, itemId: string) => {
      await tauri.addItemToSpace(spaceId, itemId);
    },
    []
  );

  const removeItemFromSpace = useCallback(
    async (spaceId: string, itemId: string) => {
      return tauri.removeItemFromSpace(spaceId, itemId);
    },
    []
  );

  const getItemSpaces = useCallback(async (itemId: string) => {
    return tauri.getItemSpaces(itemId);
  }, []);

  const setItemSpaces = useCallback(
    async (itemId: string, spaceIds: string[]) => {
      await tauri.setItemSpaces(itemId, spaceIds);
    },
    []
  );

  const refresh = useCallback(async () => {
    try {
      const loaded = await tauri.getAllSpaces();
      setSpaces(loaded);
    } catch (err) {
      console.error("Failed to refresh spaces:", err);
    }
  }, []);

  return {
    spaces,
    currentSpaceId,
    isLoading,
    selectSpace,
    createSpace,
    updateSpace,
    deleteSpace,
    addItemToSpace,
    removeItemFromSpace,
    getItemSpaces,
    setItemSpaces,
    refresh,
  };
}
