/**
 * Adds custom event bindings for overridden file utility methods from `typhonjs-file-util`.
 */
export default class FileUtil
{
   /**
    * Wires up FileUtil to the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      eventbus.trigger('plugins:add', { name: `typhonjs-file-util`, instance: require('typhonjs-file-util') });

      /**
       * Helper event binding to output a file relative to the output destination in addition to allowing plugins to
       * process any file data before it is written.
       *
       * @param {object}   fileData - The data to write.
       * @param {string}   fileName - A relative file path and name to `config.destination`.
       * @param {boolean}  [silent=false] - When true `output: <destPath>` is logged.
       * @param {encoding} [encoding=utf8] - The encoding type.
       */
      eventbus.on('tjsdoc:system:file:write', (fileData, fileName, silent = false, encoding = 'utf8') =>
      {
         fileData = eventbus.triggerSync('plugins:invoke:sync:event', 'onHandleWriteFile', void 0,
            { fileData, fileName }).fileData;

         eventbus.trigger('typhonjs:util:file:write', fileData, fileName, silent, encoding);
      });

      /**
       * Helper event binding to create a compressed archive relative to the output destination via `typhonjs-file-util`.
       * This event binding allows `addToParent` to be overridden by `config.separateDataArchives`.
       *
       * @param {string}   destPath - Destination path and file name; the compress format extension will be appended.
       *
       * @param {boolean}  [addToParent=true] - If a parent archiver exists then add child archive to it and delete local
       *                                        file.
       *
       * @param {boolean}  [silent=false] - When true `output: <destPath>` is logged.
       */
      eventbus.on('tjsdoc:system:file:archive:create', (destPath, addToParent = true, silent = false) =>
      {
         const config = eventbus.triggerSync('tjsdoc:data:config:get');

         // Allow config parameter `separateDataArchives` to override addToParent.
         addToParent = addToParent && !config.separateDataArchives;

         eventbus.trigger('typhonjs:util:file:archive:create', destPath, addToParent, silent);
      });
   }
}
