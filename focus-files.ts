import * as vscode from 'vscode';
import { saveFocusedFiles, upgrade } from './migrations';
import {
  FocusedItem,
  TreeNode,
  TreeNodeFile,
  TreeNodePlaceholder,
  TreeNodePosition,
  FocusProviderType,
  PositionEntry,
} from './focus-types';

// const PLACEHOLDER_LOADING = '__loading__';
// const PLACEHOLDER_EMPTY = '__empty__';
const MAX_PREVIEW = 120;
const extId = 'focusFiles';
const extViewId = 'focusFilesView';
const extCommands = {
  markFile: `${extId}.markFile`,
  removeFile: `${extId}.removeFile`,
  removePosition: `${extId}.removePosition`,
  clearFiles: `${extId}.clearFiles`,
};

const placeholderNode = {
  type: 'placeholder',
  message: 'Configure <focusFiles.markFile> in settings to add files.',
} satisfies TreeNode;

const getConfig = () => {
  // const markFileShortcut =
  //   vscode.workspace.getConfiguration(extId).get<string>('markFileShortcut') ??
  //   'ctrl+alt+f';

  const maxFocusedFiles =
    vscode.workspace.getConfiguration(extId).get<number>('maxItems') ?? 10;
  const maxPositionsPerFile =
    vscode.workspace
      .getConfiguration(extId)
      .get<number>('maxPositionsPerFile') ?? 5;

  // const placeholderString = `Use <${markFileShortcut}> to add files.`;

  return {
    // markFileShortcut,
    maxPositionsPerFile,
    maxFocusedFiles,
  };
};

const sortPositions = (positions: PositionEntry[]) => {
  return positions.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });
};

const getTreePlaceholderItem = (element: TreeNodePlaceholder) => {
  const placeholder = new vscode.TreeItem(
    element.message,
    vscode.TreeItemCollapsibleState.None,
  );
  placeholder.id = `placeholder:${element.message}`;
  placeholder.contextValue = undefined;
  placeholder.iconPath = new vscode.ThemeIcon('info');
  placeholder.tooltip = 'No focused files yet';
  placeholder.command = undefined;
  placeholder.label = {
    label: `${placeholder.label as string}`,
    // highlights: [[0, (placeholder.label as string).length]],
  };
  return placeholder;
};

const getTreePositionItem = (element: TreeNodePosition) => {
  const { filePath, data: pos } = element;

  const doc = vscode.workspace.textDocuments.find(
    (d) => d.uri.fsPath === filePath,
  );

  let safeLine = pos.line;
  let safeColumn = pos.column;

  if (doc) {
    safeLine = Math.min(pos.line, doc.lineCount - 1);
    const line = doc.lineAt(safeLine).text;
    safeColumn = Math.min(pos.column, line.length);
  }

  const label = pos.label
    ? `${pos.label} (${safeLine + 1}:${safeColumn + 1})`
    : `(${safeLine + 1}:${safeColumn + 1})`;

  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.contextValue = 'position';

  // Set some icons
  if (doc) {
    const lineText = doc.lineAt(pos.line)?.text || '';
    if (!pos.label || (pos.label && !lineText.includes(pos.label))) {
      item.iconPath = new vscode.ThemeIcon('warning');
    } else {
      item.iconPath = new vscode.ThemeIcon('code');
    }
  } else {
    // file missing
    item.iconPath = new vscode.ThemeIcon('error');
  }

  item.command = {
    command: 'vscode.open',
    title: 'Go to Position',
    arguments: [
      vscode.Uri.file(filePath),
      {
        selection: new vscode.Range(safeLine, safeColumn, safeLine, safeColumn),
      },
    ],
  };

  return item;
};

const getTreeFileItem = (element: TreeNodeFile): vscode.TreeItem => {
  const { filePath, positions } = element.data;

  const relativePath = vscode.workspace.asRelativePath(filePath, false);
  const fileName = relativePath.split('/').pop() || filePath;

  const item = new vscode.TreeItem(
    fileName,
    positions.length > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None,
  );

  item.contextValue = extId;
  item.tooltip = filePath;
  item.resourceUri = vscode.Uri.file(filePath);

  item.description =
    positions.length > 0
      ? `pins${positions.length > 1 ? 's' : ''}(${positions.length})`
      : '';

  if (positions.length === 0) {
    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(filePath)],
    };
  }
  return item;
};

const getTreeItem = (element: TreeNode): vscode.TreeItem => {
  if (element.type === 'placeholder') {
    return getTreePlaceholderItem(element);
  }

  if (element.type === 'position') {
    const item = getTreePositionItem(element);
    return item;
  }

  if (element.type === 'file') {
    const item = getTreeFileItem(element);
    return item;
  }

  throw new Error('Unknown TreeNode type');
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return true;
  } catch {
    return false;
  }
};

const loadFocusedFiles = async (
  context: vscode.ExtensionContext,
): Promise<FocusedItem[]> => {
  const raw = context.workspaceState.get('focusedFiles');
  const migrated = upgrade(raw);

  await saveFocusedFiles({
    context,
    items: migrated,
  });

  return (
    await Promise.all(
      migrated.map(async (item) =>
        (await fileExists(item.filePath)) ? item : null,
      ),
    )
  ).filter(Boolean) as FocusedItem[];
};

const createFocusFilesProvider = (
  focusedFiles: FocusedItem[],
): FocusProviderType => {
  const emitter = new vscode.EventEmitter<TreeNode | null | undefined>();
  const getChildren = (element?: TreeNode): TreeNode[] => {
    if (!element) {
      // top-level files or placeholder
      if (focusedFiles.length === 0) {
        return [placeholderNode];
      }

      return focusedFiles.map((item) => ({ type: 'file', data: item }));
    }
    if (element.type === 'file') {
      // expand positions under this file
      const { data } = element;
      return data.positions.map((pos) => ({
        type: 'position',
        filePath: data.filePath,
        data: pos,
      }));
    }
    return [];
  };
  return {
    onDidChangeTreeData: emitter.event,
    refresh: () => emitter.fire(null),
    getTreeItem: (element) => getTreeItem(element),
    getChildren,
  };
};

const addPosition = (positions: PositionEntry[], location: PositionEntry) => {
  const existing = positions.find((p) => p.line === location.line);
  if (existing) {
    // Update label if a new one is provided
    if (location.label) existing.label = location.label;
  } else {
    positions.push(location);
  }
};

export const activate = async (context: vscode.ExtensionContext) => {
  const config = getConfig();
  const focusedFiles = await loadFocusedFiles(context);
  const provider = createFocusFilesProvider(focusedFiles);

  // refresh and persist together
  const updateSession = () => {
    provider.refresh();
    saveFocusedFiles({ context, items: focusedFiles });
  };

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(extId)) {
      Object.assign(config, getConfig());

      if (focusedFiles.length > config.maxFocusedFiles) {
        focusedFiles.length = config.maxFocusedFiles;
      }
      updateSession();
    }
  });

  // vscode.window.registerTreeDataProvider(extViewId, provider);
  const _treeView = vscode.window.createTreeView(extViewId, {
    treeDataProvider: provider,
  });

  const markFile = vscode.commands.registerCommand(
    extCommands.markFile,
    (uri: vscode.Uri, uris: vscode.Uri[]) => {
      const targets = uris && uris.length > 0 ? uris : uri ? [uri] : [];
      const activeEditor = vscode.window.activeTextEditor;
      for (const u of targets) {
        const filePath = u.fsPath;
        // Check if uris is an array, it means file will be added from the explorer
        const addFromExplorer = !!uris?.length;
        const location =
          !addFromExplorer && activeEditor
            ? ({
                line: activeEditor.selection.active.line,
                column: activeEditor.selection.active.character,
                label: !activeEditor.selection.isEmpty
                  ? activeEditor.document
                      .getText(activeEditor.selection)
                      .replace(/\r?\n/g, ' ')
                      .substring(0, MAX_PREVIEW)
                  : undefined,
              } satisfies PositionEntry)
            : null;

        const index = focusedFiles.findIndex(
          (item) => item.filePath === filePath,
        );
        const newItem: FocusedItem = { filePath, positions: [] };

        if (index !== -1) {
          const orgFile = focusedFiles.splice(index, 1)[0];
          newItem.positions = orgFile.positions.slice();
        } else {
          newItem.positions = [];
        }

        if (location) {
          addPosition(newItem.positions, location);
        }
        sortPositions(newItem.positions);

        if (newItem.positions.length > config.maxPositionsPerFile) {
          newItem.positions.length = config.maxPositionsPerFile;
        }
        focusedFiles.unshift(newItem);
      }

      if (focusedFiles.length > config.maxFocusedFiles) {
        focusedFiles.length = config.maxFocusedFiles;
      }
      updateSession();
    },
  );

  const removePosition = vscode.commands.registerCommand(
    extCommands.removePosition,
    (node: TreeNodePosition) => {
      const { filePath, data } = node;

      const fileIndex = focusedFiles.findIndex((f) => f.filePath === filePath);
      if (fileIndex === -1) return;

      const file = focusedFiles[fileIndex];

      file.positions = file.positions.filter(
        (p) => !(p.line === data.line && p.column === data.column),
      );

      updateSession();
    },
  );

  const removeFile = vscode.commands.registerCommand(
    extCommands.removeFile,
    (fileNode: TreeNodeFile) => {
      const filePath = fileNode?.data?.filePath;
      if (!filePath) return;

      const index = focusedFiles.findIndex(
        (item) => item.filePath === filePath,
      );
      if (index !== -1) {
        focusedFiles.splice(index, 1);
        updateSession();
      }
    },
  );

  const clearFiles = vscode.commands.registerCommand(
    extCommands.clearFiles,
    async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all focused files?',
        { modal: true },
        'Yes',
      );

      if (confirm === 'Yes') {
        focusedFiles.length = 0;
        updateSession();
      }
    },
  );
  context.subscriptions.push(markFile);
  context.subscriptions.push(removeFile);
  context.subscriptions.push(removePosition);
  context.subscriptions.push(clearFiles);
  context.subscriptions.push(onConfigChange);
};
