import { createCache } from './cache';
import * as vscode from 'vscode';

const configCache = createCache<ReturnType<typeof getConfig>>();

export const getConfig = (): {
  // markFileShortcut: string;
  maxPositionsPerFile: number;
  maxFocusedFiles: number;
  minPreviewSize: number;
  maxPreviewSize: number;
  parentPathLevels: number;
} => {
  const cached = configCache.get();
  if (cached) return cached;

  // const markFileShortcut =
  //   vscode.workspace.getConfiguration(extId).get<string>('markFileShortcut') ??
  //   'ctrl+alt+f';

  const maxFocusedFiles =
    vscode.workspace.getConfiguration('focusFiles').get<number>('maxItems') ??
    30;
  const maxPositionsPerFile =
    vscode.workspace
      .getConfiguration('focusFiles')
      .get<number>('maxPositionsPerFile') ?? 5;
  const minPreviewSize =
    vscode.workspace
      .getConfiguration('focusFiles')
      .get<number>('minPreviewSize') ?? 10;
  const maxPreviewSize =
    vscode.workspace
      .getConfiguration('focusFiles')
      .get<number>('maxPreviewSize') ?? 120;
  const parentPathLevels =
    vscode.workspace
      .getConfiguration('focusFiles')
      .get<number>('parentPathLevels') ?? 3;
  // const placeholderString = `Use <${markFileShortcut}> to add files.`;
  const config = {
    maxFocusedFiles,
    maxPositionsPerFile,
    minPreviewSize,
    maxPreviewSize,
    parentPathLevels,
  };
  configCache.set(config);
  return config;
};

export const clearConfigCache = () => configCache.clear();
