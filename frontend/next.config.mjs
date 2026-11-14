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

  // The forgot password page now lives under the locale folder. Send the old URL to the
  // English page so existing links and bookmarks keep working.
  async redirects() {
    return [
      { source: '/forgot-password', destination: '/en/forgot-password', permanent: false },
      { source: '/reset-password', destination: '/en/reset-password', permanent: false },
    ];
  },

  //enables images from external storage server
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'msscc-storage.uahomeserver.net',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/msscc-media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '9000',
        pathname: '/msscc-media/**',
      },
    ],
  },

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
