const config = { reactStrictMode: true, serverExternalPackages: ["@rome-protocol/registry"], webpack(config) { config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false }; return config; } };
export default config;
