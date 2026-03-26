import * as vscode from 'vscode';
import { saveFocusedFiles, upgrade } from './migrations';
import { FocusedItem, TreeNode, FocusProviderType } from './focus-types';

// const PLACEHOLDER_LOADING = '__loading__';
// const PLACEHOLDER_EMPTY = '__empty__';
const extId = 'focusFiles';
const extViewId = 'focusFilesView';
const extCommands = {
  markFile: `${extId}.markFile`,
  removeFile: `${extId}.removeFile`,
  clearFiles: `${extId}.clearFiles`,
};

const getConfig = () => {
  // const markFileShortcut =
  //   vscode.workspace.getConfiguration(extId).get<string>('markFileShortcut') ??
  //   'ctrl+alt+f';

  const maxFocusedFiles =
    vscode.workspace.getConfiguration(extId).get<number>('maxItems') ?? 10;

  // const placeholderString = `Use <${markFileShortcut}> to add files.`;
  const placeholderString = `Use <focusFiles.markFile> to add files.`;

  return {
    // markFileShortcut,
    maxFocusedFiles,
    placeholderString,
  };
};

const createPlaceholder = (notice: string) => {
  const placeholder = new vscode.TreeItem(
    notice,
    vscode.TreeItemCollapsibleState.None,
  );
  placeholder.id = `placeholder:${notice}`;
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

const getTreeItem = (element: TreeNode): vscode.TreeItem => {
  if (element.type === 'placeholder') {
    return createPlaceholder(element.message);
  }
  const { filePath, line, column } = element.data;
  const relativePath = vscode.workspace.asRelativePath(filePath, false);
  const fileName = relativePath.split('/').pop() || filePath;
  const dir = relativePath.slice(0, relativePath.lastIndexOf('/') + 1);
  const item = new vscode.TreeItem(fileName);
  const doc = vscode.workspace.textDocuments.find(
    (d) => d.uri.fsPath === filePath,
  );

  if (doc) {
    const lineText = doc.lineAt(line).text.trim();
    item.description = `${lineText} (${line + 1}:${column + 1})`;
  } else {
    item.description = `${dir} (${line + 1}:${column + 1})`;
  }
  item.contextValue = extId;
  item.tooltip = `${filePath}:${line + 1}:${column + 1}`;
  item.resourceUri = vscode.Uri.file(filePath);

  item.command = {
    command: 'vscode.open',
    title: 'Open File',
    arguments: [
      vscode.Uri.file(filePath),
      {
        selection: new vscode.Range(line, column, line, column),
      },
    ],
  };

  return item;
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
  return {
    onDidChangeTreeData: emitter.event,
    refresh: () => emitter.fire(null),
    getTreeItem: (element) => getTreeItem(element),
    getChildren: (): TreeNode[] => {
      if (focusedFiles.length === 0) {
        return [
          {
            type: 'placeholder',
            message: 'Use <focusFiles.markFile> binding to add files.',
          },
        ];
      }

      return focusedFiles.map((item) => ({
        type: 'item',
        data: item,
      }));
    },
  };
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
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const targets = uris && uris.length > 0 ? uris : uri ? [uri] : [];
      for (const u of targets) {
        const filePath = u.fsPath;

        let line = 0;
        let column = 0;
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.fsPath === filePath) {
          const pos = activeEditor.selection.active;
          line = pos.line;
          column = pos.character;
        }

        const index = focusedFiles.findIndex(
          (item) => item.filePath === filePath,
        );
        const newItem: FocusedItem = {
          filePath,
          line,
          column,
        };
        if (index !== -1) {
          focusedFiles.splice(index, 1);
        }

        focusedFiles.unshift(newItem);
      }

      if (focusedFiles.length > config.maxFocusedFiles) {
        focusedFiles.length = config.maxFocusedFiles;
      }

      updateSession();
    },
  );

  const removeFile = vscode.commands.registerCommand(
    extCommands.removeFile,
    (file: string | vscode.Uri) => {
      const filePath = typeof file === 'string' ? file : file.fsPath;
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
  context.subscriptions.push(clearFiles);
  context.subscriptions.push(onConfigChange);
};
