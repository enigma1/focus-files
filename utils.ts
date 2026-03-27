import * as vscode from 'vscode';
import { PositionType } from './focus-types';

export const getDisplayPath = (filePath: string, levels: number) => {
  const uri = vscode.Uri.file(filePath);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

  const isExternal = !workspaceFolder;

  const fullPath = isExternal
    ? filePath
    : vscode.workspace.asRelativePath(filePath, false);

  const parts = fullPath.split(/[\\/]/);
  const fileName = parts.pop() || filePath;

  if (levels <= 0 || parts.length === 0) {
    return { fileName, parentPath: '', isExternal };
  }

  const parentParts = parts.slice(-levels);
  let parentPath = parentParts.join('/');

  if (isExternal) {
    parentPath = `…/${parentPath}`;
  }

  return { fileName, parentPath, isExternal };
};

export const hasObjectProps = <K extends string>(
  obj: unknown,
  props: K[],
): obj is Record<K, unknown> => {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  return props.every((key) => key in obj);
};

export const sortPositions = (positions: PositionType[]) => {
  return positions.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return true;
  } catch {
    return false;
  }
};
