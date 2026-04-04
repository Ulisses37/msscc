import createNextIntlPlugin from 'next-intl/plugin';

/**
 * next-intl configuration:
 * The plugin creates an alias to provide the i18n configuration for the
 * configuration file located in the i18n directory.
 */
const withNextIntl = createNextIntlPlugin(
  './i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Used to make it so that Webpack only outputs errors when needed
  webpack: (config, { dev }) => {
    if (dev) {
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    return config;
  },
};

// Wrap the existing configuration with the i18n plugin
export default withNextIntl(nextConfig);
