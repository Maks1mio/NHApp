declare global {
  interface Window {
    electron: {
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
      dialog: {
        showOpenDialog: (
          options: Electron.OpenDialogOptions
        ) => Promise<Electron.OpenDialogReturnValue>;
      };
    };
  }
}

export {};

/// This file is used to define the structure of the items in the tree
/// and the types of the props used in the components.