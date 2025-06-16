// src/renderer/global.d.ts
export {};

declare global {
  interface Window {
    electron: {
      window: {
        minimize(): void;
        maximize(): void;
        close(): void;
        checkForUpdates(): void;
        downloadUpdate(): void;
        installUpdate(): void;
        onUpdateStatus(
          cb: (
            e: any,
            status: {
              status: string;
              message: string;
              version?: string;
              percent?: number;
            }
          ) => void
        ): void;
        removeUpdateListeners(): void;
      };
      config: {
        export(configData: Record<string, unknown>): Promise<string>;
        import(file: string): Promise<void>;
      };
      dialog: {
        showOpenDialog(
          opts: Electron.OpenDialogOptions
        ): Promise<Electron.OpenDialogReturnValue>;
      };
      booru: {
        search(
          tags: string,
          page?: number
        ): Promise<{ id: string; fileUrl: string | null; tags: string[] }[]>;
        suggest(q: string): Promise<{ tag: string; count: number }[]>;
        proxy(
          url: string
        ): Promise<{ base64: string; contentType: string } | null>;
      };
      viewer: {
        open(bookId: number, idx: number, title?: string): Promise<void>;
      };
      googleDrive: {
        checkAuth(): Promise<boolean>;
        getUserInfo(): Promise<{
          name?: string;
          email?: string;
          picture?: string;
        }>;
        authorize(): Promise<void>;
        upload(data: string): Promise<{ id: string; name: string }>;
        download(fileId: string, saveTo: string): Promise<string>;
        logout(): Promise<boolean>;
        listFiles(): Promise<
          {
            id: string;
            name: string;
            createdTime: string;
            size: number;
          }[]
        >;
        importFile(fileId: string): Promise<Record<string, unknown>>;
        deleteFile(fileId: string): Promise<void>;
      };
    };
  }
}
