import * as vscode from 'vscode';
import { clearConfigCache, getConfig } from './config';
import { saveFocusedFiles, upgrade } from './migrations';
import { sortPositions, fileExists } from './utils';
import {
  FocusedItem,
  TreeNode,
  TreeNodeFile,
  TreeNodePlaceholder,
  TreeNodePosition,
  FocusProviderType,
  PositionType,
} from './focus-types';
import { getDisplayPath } from './utils';

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

const fileNodes = new Map<string, TreeNodeFile>();

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
  const { minPreviewSize } = getConfig();
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
    const lineText = doc.lineAt(safeLine)?.text.trim() || '';
    if (!pos.label || !lineText.includes(pos.label)) {
      item.iconPath = new vscode.ThemeIcon('warning');
    } else if (lineText.length < minPreviewSize) {
      item.iconPath = new vscode.ThemeIcon('eye');
    } else {
      item.iconPath = new vscode.ThemeIcon('code');
    }
  } else {
    // file missing
    item.iconPath = new vscode.ThemeIcon('eye-closed');
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
  const { parentPathLevels } = getConfig();
  const { filePath, positions } = element.data;
  const { fileName, parentPath, isExternal } = getDisplayPath(
    filePath,
    parentPathLevels,
  );

  const label = `${positions.length ? `[${positions.length}] ` : ''}${fileName}`;
  const item = new vscode.TreeItem(
    label,
    positions.length > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None,
  );
  item.description = parentPath;

  if (isExternal) {
    item.iconPath = new vscode.ThemeIcon('file-symlink-file');
  }

  item.id = filePath;
  item.contextValue = extId;
  item.tooltip = filePath;
  item.resourceUri = vscode.Uri.file(filePath);

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

type GetChildrenProps = {
  focusedFiles: FocusedItem[];
  element?: TreeNode;
};

const getChildren = ({
  focusedFiles,
  element,
}: GetChildrenProps): TreeNode[] => {
  if (!element) {
    // top-level files or placeholder
    if (focusedFiles.length === 0) {
      return [placeholderNode];
    }

    return focusedFiles.map((item) => {
      let node = fileNodes.get(item.filePath);

      if (!node) {
        node = { type: 'file', data: item };
        fileNodes.set(item.filePath, node);
      } else {
        node.data = item; // keep updated reference
      }
      return node;
    });
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

const createFocusFilesProvider = (
  focusedFiles: FocusedItem[],
): FocusProviderType => {
  const emitter = new vscode.EventEmitter<TreeNode | null | undefined>();
  return {
    onDidChangeTreeData: emitter.event,
    refresh: (node?: TreeNode) => emitter.fire(node),
    getTreeItem: (element) => getTreeItem(element),
    getChildren: (element) => getChildren({ focusedFiles, element }),
  };
};

const addPosition = (positions: PositionType[], location: PositionType) => {
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
  const updateSession = (options?: { node?: TreeNode }) => {
    if (options?.node) {
      provider.refresh(options.node);
    } else {
      provider.refresh();
    }

    saveFocusedFiles({ context, items: focusedFiles });
  };

  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(extId)) {
      clearConfigCache();
      Object.assign(config, getConfig());
      focusedFiles.length = Math.min(
        focusedFiles.length,
        config.maxFocusedFiles,
      );

      focusedFiles.forEach((file) => {
        if (file.positions.length > config.maxPositionsPerFile) {
          file.positions.length = config.maxPositionsPerFile;
        }
        file.positions.forEach((pos) => {
          if (pos.label && pos.label.length > config.maxPreviewSize) {
            pos.label = pos.label.substring(0, config.maxPreviewSize);
          }
        });
      });
      updateSession();
    }
  });

  // vscode.window.registerTreeDataProvider(extViewId, provider);
  const _treeView = vscode.window.createTreeView(extViewId, {
    treeDataProvider: provider,
  });

  type MarkFileInput = {
    filePath: string;
    source: 'explorer' | 'editor' | 'tree';
  };

  const resolveMarkFileInput = (
    arg: unknown,
    uris?: vscode.Uri[],
  ): MarkFileInput[] => {
    // multi-select (explorer)
    if (uris?.length) {
      return uris.map((u) => ({
        filePath: u.fsPath,
        source: 'explorer',
      }));
    }

    // single URI
    if (arg instanceof vscode.Uri) {
      return [
        {
          filePath: arg.fsPath,
          source: 'editor', // or 'explorer' depending on your intent
        },
      ];
    }

    // tree node
    if (
      typeof arg === 'object' &&
      arg !== null &&
      (arg as any).type === 'file'
    ) {
      return [
        {
          filePath: (arg as any).data.filePath,
          source: 'tree',
        },
      ];
    }

    return [];
  };

  const markFile = vscode.commands.registerCommand(
    extCommands.markFile,
    (arg: vscode.Uri | TreeNodeFile, uris: vscode.Uri[]) => {
      const inputs = resolveMarkFileInput(arg, uris);

      if (!inputs.length) {
        console.warn('[focusFiles] Invalid markFile call', arg);
        return;
      }
      const { maxPreviewSize } = getConfig();
      const activeEditor = vscode.window.activeTextEditor;
      for (const input of inputs) {
        const { filePath, source } = input;
        const location =
          source === 'editor' && activeEditor
            ? {
                line: activeEditor.selection.active.line,
                column: activeEditor.selection.start.character,
                label: !activeEditor.selection.isEmpty
                  ? activeEditor.document
                      .getText(activeEditor.selection)
                      .replace(/\r?\n/g, ' ')
                      .substring(0, maxPreviewSize)
                  : undefined,
              }
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
      const fileNode = fileNodes.get(filePath);

      file.positions = file.positions.filter((p) => !(p.line === data.line));
      updateSession(fileNode ? { node: fileNode } : undefined);
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
