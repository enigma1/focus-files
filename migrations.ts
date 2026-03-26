import * as vscode from 'vscode';
import { FocusedItem, StoredData } from './focus-types';
export const CURRENT_SCHEMA_VERSION = 2;

// Upgrade items to the latest schema version
export const upgrade = (raw: any): FocusedItem[] => {
  if (!raw) return [];

  // v2 handling
  if (
    typeof raw === 'object' &&
    raw.version === 2 &&
    Array.isArray(raw.items)
  ) {
    return raw.items;
  }

  // v1 handling
  if (Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
    return raw.map((filePath) => ({
      filePath,
      line: 0,
      column: 0,
    }));
  }
  return [];
};

type SaveFilesProps = {
  context: vscode.ExtensionContext;
  items: FocusedItem[];
};
export const saveFocusedFiles = async ({ context, items }: SaveFilesProps) => {
  const data: StoredData = {
    version: CURRENT_SCHEMA_VERSION,
    items,
  };
  // Store file data with current version
  await context.workspaceState.update('focusedFiles', data);
  return items;
};
