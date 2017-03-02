import path from 'path';

/**
 * Identifier Naming Util class.
 */
export default class NamingUtil
{
   /**
    * Instantiates NamingUtil.
    */
   constructor()
   {
      /**
       * File path
       * @type {{}}
       * @private
       */
      this._filePathMap = {};
   }

   /**
    * naming with file path.
    *
    * @param {string} filePath - target file path.
    *
    * @returns {string} name
    */
   filePathToName(filePath)
   {
      let basename = path.basename(filePath).split('.')[0];
      basename = basename.replace(/[^a-zA-Z0-9_$]/g, '');

      this._filePathMap[filePath] = this._filePathMap[filePath] || 0;

      const count = this._filePathMap[filePath];

      if (count > 0) { basename += count; }

      this._filePathMap[filePath]++;

      return basename;
   }

   /**
    * Wires up NamingUtil on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onPluginLoad(ev)
   {
      const eventbus = ev.eventbus;

      eventbus.on('tjsdoc:filepath:to:name', this.filePathToName, this);
   }
}
