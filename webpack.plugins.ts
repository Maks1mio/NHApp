// @ts-ignore
import type IForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import NodePolyfillPlugin from "node-polyfill-webpack-plugin";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

export const plugins = [
  new HtmlWebpackPlugin({
    template: path.resolve(__dirname, "src/renderer/index.html"),
  }),
  new ForkTsCheckerWebpackPlugin({
    logger: "webpack-infrastructure",
  }),
  new CopyWebpackPlugin({
    patterns: [
      { from: "static", to: "static" },
      { from: "static", to: "main_window/static" },
      {
        from: path.resolve(__dirname, "src/utils/nhentai-tags.json"),
        to: path.resolve(__dirname, ".webpack/main/utils/nhentai-tags.json"),
      },
      {
        from: path.resolve(__dirname, "src/oauth-credentials.json"),
        to: path.resolve(__dirname, ".webpack/main/oauth-credentials.json"),
      },
    ],
  }),
  new webpack.ProvidePlugin({
    Buffer: ["buffer", "Buffer"],
    process: "process/browser",
  }),

  new NodePolyfillPlugin(),
];
