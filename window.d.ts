declare global {
  interface Window {
    electron: {
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
        checkForUpdates: () => void;
        downloadUpdate: () => void;
        installUpdate: () => void;
        onUpdateStatus: (
          callback: (
            event: any,
            status: {
              status: string;
              message: string;
              version?: string;
              percent?: number;
            }
          ) => void
        ) => void;
        removeUpdateListeners: () => void;
      };
      dialog: {
        showOpenDialog: (
          options: Electron.OpenDialogOptions
        ) => Promise<Electron.OpenDialogReturnValue>;
      };
      booru: {
        search(
          tags: string,
          page?: number
        ): Promise<
          {
            id: string;
            fileUrl: string | null;
            tags: string[];
          }[]
        >;
        suggest(query: string): Promise<
          {
            tag: string;
            count: number;
          }[]
        >;
        proxy(url: string): Promise<{
          base64: string;
          contentType: string;
        } | null>;
      };
      viewer: {
        open(bookId: number, index: number, title?: string): Promise<void>;
      };
    };
  }
}

export {};
