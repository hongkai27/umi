import * as fs from 'fs';
import * as path from 'path';

import { IApi, utils } from 'umi';

const { winPath, Mustache } = utils;
const BUNDLE_CONFIG_TYPE = 'ssr';
const CHUNK_NAME = 'server';
const OUTPUT_SERVER_FILENAME = 'umi.server.js';
const TMP_PLUGIN_DIR = 'plugin-ssr';
const CLIENT_EXPORTS = 'clientExports';
const DEFAULT_HTML_PLACEHOLDER = '__UMI_DEFAULT_HTML_TEMPLATE__';

export default (api: IApi) => {
  api.describe({
    key: 'ssr',
    config: {
      schema: (joi) => {
        return joi.object({
          forceInitial: joi.boolean().description('remove window.g_initialProps and window.getInitialData in html, to force execing Page getInitialProps and App getInitialData functions'),
          devServerRender: joi.boolean().description('disable serve-side render in umi dev mode.'),
          stream: joi.boolean().description('stream render, conflict with prerender'),
        });
      },
    },
    // 配置开启
    enableBy: api.EnableBy.config,
  })

  // 再加一个 webpack instance
  api.modifyBundleConfigs(async (memo, { getConfig }) => {
    return [
      ...memo,
      await getConfig({ type: BUNDLE_CONFIG_TYPE }),
    ]
  });

  api.onGenerateFiles(async () => {
    const serverTpl = path.join(winPath(__dirname), 'templates/server.tpl');
    const serverContent = fs.readFileSync(serverTpl, 'utf-8');

    api.writeTmpFile({
      path: 'core/server.ts',
      content: Mustache.render(serverContent, {
        Renderer: winPath(path.dirname(require.resolve('@umijs/renderer-react/package'))),
        Utils: winPath(require.resolve('./utils')),
        Stream: !!api.config.ssr?.stream,
        // @ts-ignore
        ForceInitial: !!api.config.ssr?.forceInitial,
        DEFAULT_HTML_PLACEHOLDER,
      })
    });

    const clientExportsContent = fs.readFileSync(path.join(winPath(__dirname), `templates/${CLIENT_EXPORTS}.tpl`), 'utf-8');
    api.writeTmpFile({
      path: `${TMP_PLUGIN_DIR}/${CLIENT_EXPORTS}.ts`,
      content: clientExportsContent,
    });
  })

  api.addPolyfillImports(() => [{ source: './core/server.ts' }]);

  api.modifyHTMLChunks(async (memo, opts) => {
    if (opts.type === BUNDLE_CONFIG_TYPE) {
      return [CHUNK_NAME];
    }
    return memo;
  })

  api.modifyConfig(config => {
    if (!config.devServer) {
      config.devServer = {};
    }
    // DISCUSS: 是否需要强行改项目配置的方式，来开启 dev 下写 umi.server.js
    // force enable writeToDisk
    config.devServer.writeToDisk = (filePath: string) => /(umi\.server\.js|index\.html)$/.test(filePath);
    return config;
  })

  // 修改
  api.chainWebpack(async (config, opts) => {
    const { paths } = api;
    const { type } = opts;
    const serverEntryPath = path.join(paths.absTmpPath || '', 'core/server.ts');
    if (type === BUNDLE_CONFIG_TYPE) {
      config.entryPoints.clear();
      config.entry(CHUNK_NAME).add(serverEntryPath);
      config.target('node');
      config.name(CHUNK_NAME);

      config.output
        .filename(OUTPUT_SERVER_FILENAME)
        .libraryExport('default')
        .chunkFilename('[name].server.js')
        .publicPath(api.config.publicPath || '/')
        .pathinfo(false)
        .libraryTarget('commonjs2');

      config.plugin('define').tap(([args]) => [{ ...args,
        'window.routerBase': JSON.stringify(api.config.base),
        'process.env.__IS_BROWSER': false,
      }]);


      if (config.plugins.has('extract-css')) {
        config.plugins.delete('extract-css')
      }
      [ 'css', 'less' ].forEach((lang) => {
        const langRule = config.module.rule(lang);
        [langRule.oneOf('css-modules').resourceQuery(/modules/), langRule.oneOf('css')].forEach(rule => {
          if (rule.uses.has('extract-css-loader')) {
            rule.uses.delete('extract-css-loader');
            rule.use('css-loader').tap((options) => ({
              ...options,
              // https://webpack.js.org/loaders/css-loader/#onlylocals
              onlyLocals: true
            }));
          }
        })
      })

      config.externals([]);

      // avoid client and server analyze conflicts
      if (process.env.ANALYZE) {
        if (config.plugins.has('bundle-analyzer')) {
          config.plugins.delete('bundle-analyzer');
        }
      }
      return config;
    }
    // avoid client and server analyze conflicts
    if (process.env.ANALYZE_SSR) {
      if (config.plugins.has('bundle-analyzer')) {
        config.plugins.delete('bundle-analyzer');
      }
    }
    return config;
  });

  // runtime ssr plugin
  api.addRuntimePluginKey(() => 'ssr');

  api.addUmiExports(() => [
    {
      exportAll: true,
      source: `../${TMP_PLUGIN_DIR}/${CLIENT_EXPORTS}`
    }
  ]);

  /**
   * replace default html string when build success
   * [WARN] must exec before prerender plugin
   */
  api.onBuildComplete(({ err }) => {
    const { absOutputPath } = api.paths;
    const serverFilePath = path.join(absOutputPath || '', OUTPUT_SERVER_FILENAME);
    const defaultHtmlTemplatePath = path.join(absOutputPath || '', 'index.html');

    if (!err) {
      const serverFile = fs.readFileSync(serverFilePath, 'utf-8');
      const defaultHtmlTemplate = fs.readFileSync(defaultHtmlTemplatePath, 'utf-8');

      if (serverFile.indexOf(DEFAULT_HTML_PLACEHOLDER)) {
        // has placeholder
        const newServerFile = serverFile.replace(DEFAULT_HTML_PLACEHOLDER, defaultHtmlTemplate);
        fs.writeFileSync(serverFilePath, newServerFile);
      }
    }
  })
};
