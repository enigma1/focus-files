import * as vscode from 'vscode';

export type PositionType = {
  line: number;
  column: number;
  label?: string;
};

export type FocusedItem = {
  filePath: string;
  positions: PositionType[];
};

export type StoredData = {
  version: number;
  items: FocusedItem[];
};

export type TreeNodePlaceholder = {
  type: 'placeholder';
  message: string;
};
export type TreeNodeFile = {
  type: 'file';
  data: FocusedItem;
};
export type TreeNodePosition = {
  type: 'position';
  filePath: string;
  data: PositionType;
};

export type TreeNode = TreeNodeFile | TreeNodePosition | TreeNodePlaceholder;

export type FocusProviderType = {
  onDidChangeTreeData: vscode.Event<TreeNode | null | undefined>;
  refresh: (node?: TreeNode) => void;
  getTreeItem: (element: TreeNode) => vscode.TreeItem;
  getChildren: (element?: TreeNode) => TreeNode[];
};
