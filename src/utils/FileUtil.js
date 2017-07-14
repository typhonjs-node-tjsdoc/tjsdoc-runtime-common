/**
 * Adds custom event bindings for overridden file utility methods from `typhonjs-file-util`.
 */
export default class FileUtil
{
   /**
    * Store the TJSDocConfig object and other relevant data for generating doc data.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onRuntimePreGenerateAsync(ev)
   {
      /**
       * @type {TJSDocConfig}
       * @private
       */
      this._mainConfig = ev.data.mainConfig;
   }

   /**
    * Wires up FileUtil to the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   async onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      await eventbus.triggerAsync('plugins:add:async',
       { name: `typhonjs-file-util`, instance: require('typhonjs-file-util') });

      /**
       * Helper event binding to output a file relative to the output destination in addition to allowing plugins to
       * process any file data before it is written.
       *
       * @param {object}   fileData - The data to write.
       * @param {string}   fileName - A relative file path and name to `config.destination`.
       * @param {boolean}  [silent=false] - When false `output: <destPath>` is logged.
       * @param {encoding} [encoding=utf8] - The encoding type.
       */
      eventbus.on('tjsdoc:system:file:write',
       ({ fileData, filePath, logPrepend = '', silent = false, encoding = 'utf8' } = {}) =>
      {
         fileData = eventbus.triggerSync('plugins:invoke:sync:event', 'onHandleWriteFile', void 0,
          { fileData, filePath }).fileData;

         eventbus.trigger('typhonjs:util:file:write', { fileData, filePath, logPrepend, silent, encoding });
      });

      /**
       * Helper event binding to create a compressed archive relative to the output destination via `typhonjs-file-util`.
       * This event binding allows `addToParent` to be overridden by `config.separateDataArchives`.
       *
       * @param {string}   filePath - Destination file path; the compression format extension will be appended.
       *
       * @param {boolean}  [addToParent=true] - If a parent archiver exists then add child archive to it and delete
       *                                        local file.
       *
       * @param {string}   [logPrepend=''] - A string to prepend any logged output.
       *
       * @param {boolean}  [silent=false] - When false `output: <destPath>` is logged.
       */
      eventbus.on('tjsdoc:system:file:archive:create',
       ({ filePath, addToParent = true, logPrepend = '', silent = false } = {}) =>
      {
         // Allow config parameter `separateDataArchives` to override addToParent.
         addToParent = addToParent && !this._mainConfig.separateDataArchives;

         eventbus.trigger('typhonjs:util:file:archive:create', { filePath, addToParent, logPrepend, silent });
      });
   }
}
