require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const rspack = require("@rspack/core");
const ReactRefreshPlugin = require("@rspack/plugin-react-refresh");
const path = require("path");

/** @type {import("@rspack/core").Configuration} */
module.exports = {
  context: __dirname,
  entry: {
    main: "./src/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    clean: true,
    publicPath: "/",
    filename: process.env.NODE_ENV === "production" 
      ? "js/[name].[contenthash:8].js" 
      : "js/[name].js",
    chunkFilename: process.env.NODE_ENV === "production"
      ? "js/[name].[contenthash:8].chunk.js"
      : "js/[name].chunk.js",
    assetModuleFilename: process.env.NODE_ENV === "production"
      ? "assets/[name].[contenthash:8][ext]"
      : "assets/[name][ext]",
  },
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "builtin:swc-loader",
            options: {
              jsc: {
                parser: {
                  syntax: "typescript",
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: "automatic",
                    development: process.env.NODE_ENV === "development",
                    refresh: process.env.NODE_ENV === "development",
                  },
                },
              },
            },
          },
        ],
        type: "javascript/auto",
      },
      {
        test: /\.module\.css$/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[name]__[local]__[hash:base64:5]",
                exportLocalsConvention: "camelCase",
              },
              esModule: true,
            },
          },
        ],
        type: "javascript/auto",
      },
      {
        test: /\.css$/,
        exclude: /\.module\.css$/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
            options: {
              esModule: true,
            },
          },
        ],
        type: "javascript/auto",
      },
    ],
  },
  plugins: [
    new rspack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
      // Переопределяем API URL только если явно указана переменная окружения
      // Иначе используется автоматическое определение в api.ts
      ...(process.env.VITE_API_URL 
        ? { "__API_BASE_URL__": JSON.stringify(process.env.VITE_API_URL) }
        : {}),
      "__TELEGRAM_BOT_USERNAME__": JSON.stringify(process.env.VITE_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || ""),
      "__VK_ID_APP_ID__": JSON.stringify(process.env.VITE_VK_ID_APP_ID || process.env.VK_ID_APP_ID || ""),
    }),
    new rspack.ProgressPlugin({}),
    new rspack.HtmlRspackPlugin({
      template: "./index.html",
      minify: process.env.NODE_ENV === "production",
    }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: "public", to: "." },
        { from: "manifest.json", to: "." },
      ],
    }),
    ...(process.env.NODE_ENV === "development"
      ? [new ReactRefreshPlugin()]
      : []),
  ],
  optimization: {
    minimize: process.env.NODE_ENV === "production",
    moduleIds: process.env.NODE_ENV === "production" ? "deterministic" : "named",
    chunkIds: process.env.NODE_ENV === "production" ? "deterministic" : "named",
  },
  devServer: {
    // Порт 443 — для https://127.0.0.1 (на Windows может потребоваться запуск от имени администратора)
    port: 443,
    host: "127.0.0.1",
    server: "https",
    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    ],
    historyApiFallback: {
      index: "/index.html",
      disableDotRule: true,
    },
    static: {
      directory: "./public",
    },
  },
};
