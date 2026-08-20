export { default as codeSplitPlugin } from './plugins/codeSplit';
export type { CodeSplitPluginOptions, CodeSplitGroup } from './plugins/codeSplit';

export { default as envLoaderPlugin } from './plugins/envLoader';
export type { EnvLoaderOptions } from './plugins/envLoader';

export { default as imageToCdnPlugin } from './plugins/imageToCdn';
export type { ImageToCdnOptions } from './plugins/imageToCdn';

export { default as jsAsJsxPlugin } from './plugins/jsAsJsx';
export type { JsAsJsxOptions } from './plugins/jsAsJsx';

export { default as postcssShadowDomPlugin, default as postcssShadowDomTailwindPlugin } from './plugins/postcssShadowDom';
export type { PostcssShadowDomOptions } from './plugins/postcssShadowDom';

export { default as convertCssRootToHostPlugin } from './plugins/convertCssRootToHost';
export type { ConvertCssRootToHostOptions } from './plugins/convertCssRootToHost';

export { default as publicCssManagePlugin } from './plugins/publicCssManage';
export type { PublicCssManageOptions } from './plugins/publicCssManage';

export { default as buildLogModifierPlugin } from './plugins/buildLogModifier';
export type { BuildLogModifierOptions } from './plugins/buildLogModifier';

export { default as customConfigPlugin } from './plugins/customConfig';
export type { CustomConfigOptions } from './plugins/customConfig';

export { default as legacyConfigPlugin } from './plugins/legacyConfig';

export { default as proxyRedirectsPlugin } from './plugins/proxyRedirects';
export type { ProxyRedirectsOptions, DeployPlatform } from './plugins/proxyRedirects';

export { default as envValidatorPlugin } from './plugins/envValidator';
export type { EnvValidatorOptions, EnvValidationRule } from './plugins/envValidator';

export { default as compressionPlugin } from './plugins/compression';
export type { CompressionPluginOptions } from './plugins/compression';

export { default as htmlMetaPlugin } from './plugins/htmlMeta';
export type { HtmlMetaOptions, OpenGraphMetaOptions, TwitterCardMetaOptions } from './plugins/htmlMeta';

export { default as apiMockPlugin } from './plugins/apiMock';
export type { ApiMockPluginOptions, MockEndpoint } from './plugins/apiMock';

export { default as autoAliasPlugin } from './plugins/autoAlias';
export type { AutoAliasOptions } from './plugins/autoAlias';

export { default as deadCodeScannerPlugin } from './plugins/deadCodeScanner';
export type { DeadCodeScannerOptions } from './plugins/deadCodeScanner';

export { default as fontLocalizerPlugin } from './plugins/fontLocalizer';
export type { FontLocalizerOptions } from './plugins/fontLocalizer';

export { default as devFallbackPlugin } from './plugins/devFallback';
export type { DevFallbackOptions, DevFallbackRule } from './plugins/devFallback';

export { default as licenseNoticePlugin } from './plugins/licenseNotice';
export type { LicenseNoticeOptions } from './plugins/licenseNotice';

export { default as securityHeadersPlugin } from './plugins/securityHeaders';
export type { SecurityHeadersOptions } from './plugins/securityHeaders';

export { default as bannerNoticePlugin } from './plugins/bannerNotice';
export type { BannerNoticeOptions } from './plugins/bannerNotice';

export { default as svgSpritePlugin } from './plugins/svgSprite';
export type { SvgSpriteOptions } from './plugins/svgSprite';

export { default as resourceHintsPlugin } from './plugins/resourceHints';
export type { ResourceHintsOptions } from './plugins/resourceHints';

export { default as cacheCleanerPlugin } from './plugins/cacheCleaner';
export type { CacheCleanerOptions } from './plugins/cacheCleaner';

export { default as buildScorerPlugin } from './plugins/buildScorer';
export type { BuildScorerOptions, BuildScoreReport, ScoreCategory } from './plugins/buildScorer';

export { default as logger, colors, logBox, logStep } from './utils/logger';
export type { LogType } from './utils/logger';


