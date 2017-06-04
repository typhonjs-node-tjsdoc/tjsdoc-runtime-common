/**
 * Provides orchestration for publishing.
 *
 * If you are creating an alternate publisher you must use tjsdoc-runtime-common and the same `PublisherRuntime` class
 * defined here to ensure orchestration works with all 1st & 3rd party plugins.
 */
export default class PublisherRuntime
{
   /**
    * Wires up publisher to plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    *
    * @ignore
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      this._eventbus = eventbus;

      eventbus.on('tjsdoc:system:publisher:publish', this.publish, this);
   }

   /**
    * Stores the main TJSDoc config, main DocDB, and package data.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPreGenerate(ev)
   {
      /**
       * The TJSDoc config.
       * @type {TJSDocConfig}
       * @private
       */
      this._mainConfig = ev.data.config;

      this._pubConfig = ev.data.pubConfig;

      /**
       * The main DocDB.
       * @type {DocDB}
       * @private
       */
      this._mainDocDB = ev.data.docDB;

      /**
       * The formatted target project `package.json` object.
       */
      this._packageInfo = ev.data.packageInfo;

      /**
       * The target project `package.json` object.
       */
      this._packageObj = ev.data.packageObj;
   }

   /**
    * Publish documentation as static HTML + resources.
    *
    * An eventbus proxy must be passed in so that the default publish action can be overridden for instance when running
    * tests. This publisher registers several event bindings on the eventbus; please see {@link PublisherEvents}.
    *
    * @param {object}   [options] - Configuration data for the publish action.
    *
    */
   publish(options = {})
   {
      if (typeof options !== 'object')
      {
         throw new TypeError(`tjsdoc-runtime-publisher error: 'options' is not an 'object'.`);
      }

      let pubOptions;

      if (typeof options.incremental === 'boolean' && options.incremental)
      {
         pubOptions = Object.assign({
            docDB: this._mainDocDB,
            eventbus: this._eventbus,
            fileAction: void 0,
            filePath: void 0,
            fileType: void 0,
            incremental: true,
            mainConfig: this._mainConfig,
            minimal: false,
            packageInfo: this._packageInfo,
            packageObj: this._packageObj,
            pubConfig: this._pubConfig,
            silent: false,
         }, options);

         if (typeof pubOptions.minimal === 'boolean' && !pubOptions.minimal)
         {
            pubOptions.sourceCoverage = pubOptions.docDB.getSourceCoverage({ includeFiles: true });
         }
      }
      else
      {
         pubOptions = Object.assign({
            docDB: this._mainDocDB,
            eventbus: this._eventbus,
            incremental: false,
            mainConfig: this._mainConfig,
            packageInfo: this._packageInfo,
            packageObj: this._packageObj,
            pubConfig: this._pubConfig,
            silent: false
         }, options);

         pubOptions.sourceCoverage = pubOptions.docDB.getSourceCoverage({ includeFiles: true });
      }

      this._eventbus.trigger('plugins:invoke:sync:event', 'onHandlePrePublish', void 0, pubOptions);
      this._eventbus.trigger('plugins:invoke:sync:event', 'onHandlePublish', void 0, pubOptions);
      this._eventbus.trigger('plugins:invoke:sync:event', 'onHandlePostPublish', void 0, pubOptions);
   }
}