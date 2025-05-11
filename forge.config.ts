import type { ForgeConfig } from "@electron-forge/shared-types";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";


const forgeConfig: ForgeConfig = {
  packagerConfig: {
    icon: "./icons/icon",
    name: "Rectron",
    asar: true,
    overwrite: true,
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "Rectron",
      },
    },
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            name: "main_window",
            html: "./src/renderer/index.html",
            js: './src/main/renderer.ts',
            preload: {
              js: "./src/main/preload.ts",
            },
          },
        ],
      },
    }),
  ],
};

export default forgeConfig;
