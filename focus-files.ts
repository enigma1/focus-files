import * as vscode from 'vscode';

const PLACEHOLDER_LOADING = '__loading__';
const PLACEHOLDER_EMPTY = '__empty__';
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
  placeholder.id = 'placeholder';
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

const getTreeItem = (
  element: string,
  config: ReturnType<typeof getConfig>,
): vscode.TreeItem => {
  switch (element) {
    case PLACEHOLDER_LOADING:
      return createPlaceholder('Loading focused files…');
    case PLACEHOLDER_EMPTY:
      return createPlaceholder(
        // `Use <${config.markFileShortcut}> to add files.`,
        `Use <focusFiles.markFile> binding to add files.`,
      );
  }

  const relativePath = vscode.workspace.asRelativePath(element, false);
  const fileName = relativePath.split('/').pop() || element;
  const dir = relativePath.slice(0, relativePath.lastIndexOf('/') + 1);
  const item = new vscode.TreeItem(
    fileName,
    vscode.TreeItemCollapsibleState.None,
  );

  item.contextValue = extId;
  item.description = dir;
  item.tooltip = element; // complete path on hover
  item.resourceUri = vscode.Uri.file(element); // show file icon
  item.command = {
    command: 'vscode.open',
    title: 'Open File',
    arguments: [vscode.Uri.file(element)],
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
): Promise<string[]> => {
  const saved = context.workspaceState.get<string[]>('focusedFiles') ?? [];
  const result: string[] = [];
  for (const filePath of saved) {
    if (await fileExists(filePath)) {
      result.push(filePath);
    }
  }
  return result;
};

type FocusProviderType = {
  onDidChangeTreeData: vscode.Event<string | null | undefined>;
  refresh: () => void;
  getTreeItem: (element: string) => vscode.TreeItem;
  getChildren: (element?: string) => string[];
};
const createFocusFilesProvider = (
  focusedFiles: string[],
  config: ReturnType<typeof getConfig>,
): FocusProviderType => {
  const emitter = new vscode.EventEmitter<string | null | undefined>();
  return {
    onDidChangeTreeData: emitter.event,
    refresh: () => emitter.fire(null),
    getTreeItem: (element) => getTreeItem(element, config),
    getChildren: (): string[] => {
      return focusedFiles.length === 0 ? [PLACEHOLDER_EMPTY] : focusedFiles;
    },
  };
};

const saveFocusedFiles = (
  context: vscode.ExtensionContext,
  files: string[],
) => {
  context.workspaceState.update('focusedFiles', files);
};

export const activate = async (context: vscode.ExtensionContext) => {
  const config = getConfig();
  const focusedFiles = await loadFocusedFiles(context);
  const provider = createFocusFilesProvider(focusedFiles, config);

  // refresh and persist together
  const updateSession = () => {
    provider.refresh();
    saveFocusedFiles(context, focusedFiles);
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

        const index = focusedFiles.indexOf(filePath);
        if (index !== -1) {
          focusedFiles.splice(index, 1);
        }

        focusedFiles.unshift(filePath);
      }

      // const filePath = editor.document.uri.fsPath;
      // const index = focusedFiles.indexOf(filePath);

      // if (index !== -1) {
      //   focusedFiles.splice(index, 1);
      // }

      // focusedFiles.unshift(filePath);

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
      const index = focusedFiles.indexOf(filePath);
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
