import * as vscode from 'vscode';

export type FocusedItem = {
  filePath: string;
  line: number;
  column: number;
};

export type StoredData = {
  version: number;
  items: FocusedItem[];
};

export type TreeNode =
  | { type: 'item'; data: FocusedItem }
  | { type: 'placeholder'; message: string };

export type FocusProviderType = {
  onDidChangeTreeData: vscode.Event<TreeNode | null | undefined>;
  refresh: () => void;
  getTreeItem: (element: TreeNode) => vscode.TreeItem;
  getChildren: () => TreeNode[];
};
