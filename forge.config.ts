import type { ForgeConfig } from "@electron-forge/shared-types";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
import path from "path";
import fs from "fs-extra";
import { execSync } from "child_process";

const forgeConfig: ForgeConfig = {
  packagerConfig: {
    icon: "./icons/win/icon.ico",
    name: "NHApp",
    executableName: "NHApp",
    appCopyright: "Copyright (C) 2024 NHApp",
    asar: true,
    win32metadata: {
      CompanyName: "NHApp",
    },
    extendInfo: "Info.plist",
    extraResource: ["./app-update.yml"],
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "NHApp",
        authors: "Maks1mio",
        description: "A modern nHentai client",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
      config: {},
    },
    {
      name: "@electron-forge/maker-deb",
      config: {},
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        format: "ULFO",
        overwrite: true,
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
            js: "./src/main/renderer.ts",
            preload: { js: "./src/main/preload.ts" },
          },
          {
            name: "viewer",
            html: "./src/renderer/viewer.html",
            js: "./src/main/viewerRenderer.ts",
            preload: { js: "./src/main/preload.ts" },
          },
        ],
      },
    }),
  ],
  hooks: {
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      const packageJsonPath = path.resolve(buildPath, "package.json");
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      Object.keys(pkg).forEach((key) => {
        switch (key) {
          case "name":
          case "version":
          case "main":
          case "author":
          case "devDependencies":
          case "homepage":
            break;
          default:
            delete pkg[key];
        }
      });

      let branch = "unknown";
      try {
        branch = execSync("git rev-parse --short HEAD", { cwd: process.cwd() })
          .toString()
          .trim();
      } catch (err) {
        console.warn("Bruh:", err);
      }

      pkg.buildInfo = {
        VERSION: pkg.version,
        DATE: new Date().toISOString(),
        BRANCH: branch,
      };

      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, "\t"));
    },

    packageAfterCopy: async (
      _forgeConfig,
      buildPath,
      electronVersion,
      platform,
      arch
    ) => {
      console.log(
        `Built app ${platform}-${arch} with Electron ${electronVersion}`
      );
    },
  },
};

export default forgeConfig;
