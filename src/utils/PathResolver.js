import Resolver from 'typhonjs-path-resolver';

/**
 * Wraps `typhonjs-path-resolver` as a plugin providing an event binding `tjsdoc:system:path:resolver:create` which sets
 * the NPM package name and main file path from the target project `package.json`.
 */
export default class PathResolver
{
   /**
    * Wires up PathResolver on the plugin eventbus.
    *
    * @param {PluginEvent} ev - The plugin event.
    *
    * @ignore
    */
   onPluginLoad(ev)
   {
      ev.eventbus.on('tjsdoc:system:path:resolver:create',
       (filePath, rootPath = this._rootPath, packageName = this._packageName, mainFilePath = this._mainFilePath) =>
      {
         return new Resolver(rootPath, filePath, packageName, mainFilePath);
      });
   }

   /**
    * Store runtime data. Attempt to determine the name of the target project module name and any main file path.
    *
    * @param {PluginEvent} ev - The plugin event.
    */
   onStart(ev)
   {
      /**
       * The target project current working directory.
       * @type {string}
       */
      this._rootPath = ev.data.config._dirPath;

      /**
       * The target project NPM package name.
       * @type {string}
       */
      this._packageName = ev.data.packageObj.name || void 0;

      /**
       * The target project NPM main file path.
       * @type {string}
       */
      this._mainFilePath = ev.data.packageObj.main || void 0;
   }
}
