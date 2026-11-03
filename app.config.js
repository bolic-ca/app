const IS_DEVELOPMENT = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEVELOPMENT ? 'Bolic Dev' : config.name,
  scheme: IS_DEVELOPMENT ? 'bolicapp-dev' : config.scheme,
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEVELOPMENT
      ? 'com.anonymous.Bolic.dev'
      : config.ios?.bundleIdentifier,
  },
  android: {
    ...config.android,
    package: IS_DEVELOPMENT
      ? 'com.anonymous.Bolic.dev'
      : config.android?.package,
  },
});
