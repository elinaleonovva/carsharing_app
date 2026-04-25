const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const dotenv = require("dotenv");

const projectRoot = __dirname;
const repositoryRoot = path.resolve(projectRoot, "..");

loadEnv(path.resolve(repositoryRoot, ".env"));
loadEnv(path.resolve(projectRoot, ".env"));

module.exports = (_, argv) => {
  const isProduction = argv.mode === "production";

  return {
    entry: path.resolve(projectRoot, "src/main.tsx"),
    output: {
      path: path.resolve(projectRoot, "dist"),
      filename: isProduction ? "assets/[name].[contenthash:8].js" : "assets/[name].js",
      publicPath: "/",
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(projectRoot, "index.html"),
      }),
      new webpack.DefinePlugin({
        "process.env.APP_API_BASE_URL": JSON.stringify(process.env.APP_API_BASE_URL || "/api"),
        "process.env.APP_YANDEX_MAPS_API_KEY": JSON.stringify(process.env.APP_YANDEX_MAPS_API_KEY || ""),
        "process.env.APP_YANDEX_MAPS_LANG": JSON.stringify(process.env.APP_YANDEX_MAPS_LANG || "ru_RU"),
      }),
    ],
    devtool: isProduction ? "source-map" : "eval-cheap-module-source-map",
    devServer: {
      static: {
        directory: path.resolve(projectRoot, "dist"),
      },
      historyApiFallback: true,
      proxy: [
        {
          context: ["/api"],
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      ],
      hot: true,
      host: "0.0.0.0",
      port: 5173,
    },
  };
};

function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
}
