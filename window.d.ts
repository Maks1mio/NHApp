declare global {
  interface Window {
    electron: {
      window: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      updateMessage: (callback: (event: any, message: string) => void) => void;
      checkForUpdates: () => void;
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
    };
  }
}

export {};
