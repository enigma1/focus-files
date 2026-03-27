import * as vscode from 'vscode';
import { FocusedItem, StoredData } from './focus-types';
import { hasObjectProps } from './utils';

export const CURRENT_SCHEMA_VERSION = 2;

type V2DataSchema = FocusedItem[];
const isV2Data = (data: any): data is V2DataSchema => {
  if (!Array.isArray(data)) return false;

  return data.every((item) => {
    const hasProps = hasObjectProps(item, ['filePath', 'positions']);
    if (!hasProps) return false;
    const filePath = (item as any).filePath;
    const positions = (item as any).positions;
    return (
      typeof filePath === 'string' &&
      Array.isArray(positions) &&
      (positions.length === 0 ||
        positions.every(
          (pos: any) =>
            hasObjectProps(pos, ['line', 'column']) &&
            typeof pos.line === 'number' &&
            typeof pos.column === 'number',
        ))
    );
  });
};

// Upgrade items to the latest schema version
export const upgrade = (raw: any): FocusedItem[] => {
  if (!raw) return [];

  // v2 handling
  if (
    hasObjectProps(raw, ['version', 'items']) &&
    raw.version === 2 &&
    isV2Data(raw.items)
  ) {
    return raw.items;
  }

  // v1 handling
  if (Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
    return raw.map((filePath) => ({
      filePath,
      positions: [],
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
