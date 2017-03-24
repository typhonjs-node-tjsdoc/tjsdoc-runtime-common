import fs   from 'fs';
import path from 'path';

/**
 * Defines the data used by typhonjs-config-resolver to validate TJSDocConfig files including loading extended configs.
 */
export default class ConfigData
{
   /**
    * Creates the common TJSDoc config resolver data for default values and pre / post validation in addition to
    * mixing in any data from the callee.
    *
    * @param {EventProxy}           eventbus - An eventbus proxy.
    *
    * @param {ConfigResolverData}   mixin - An object structured as ConfigResolverData.
    *
    * @returns {ConfigResolverData}
    */
   static createResolverData(eventbus, mixin = {})
   {
      if (typeof mixin !== 'object') { throw new TypeError(`'mixin' is not an 'object'.`); }

      const defaultValues = ConfigData.defaultValues(eventbus);
      const preValidate = ConfigData.preValidate(eventbus);
      const postValidate = ConfigData.postValidate(eventbus);
      const upgradeMergeList = ConfigData.upgradeMergeList();

      return {
         defaultValues: typeof mixin.defaultValues === 'object' ? Object.assign(defaultValues, mixin.defaultValues) :
          defaultValues,

         preValidate: typeof mixin.preValidate === 'object' ? Object.assign(preValidate, mixin.preValidate) :
          preValidate,

         postValidate: typeof mixin.postValidate === 'object' ? Object.assign(postValidate, mixin.postValidate) :
          postValidate,

         upgradeMergeList: Array.isArray(mixin.upgradeMergeList) ? [...upgradeMergeList, ...mixin.upgradeMergeList] :
          upgradeMergeList
      };
   }

   /**
    * Generates the default values data structure set to a TJSDocConfig object after extended config files are resolved.
    * Any fields not already set will be set to the default values defined before.
    *
    * @returns {object}
    */
   static defaultValues()
   {
      return {
         'access': ['public', 'protected', 'private'],

         'autoPrivate': true,

         'builtinVirtual': true,

         'compactData': false,

         'compressData': false,

         'compressOutput': false,

         'compressFormat': 'tar.gz',

         'copyPackage': true,

         'debug': false,

         'docCoverage': true,

         'docLint': true,

         'emptyDestination': false,

         'excludes': [],

         'fullStackTrace': false,

         'includeSource': false,

         'index': './README.md',

         'logLevel': 'info',

         'outputASTData': false,

         'outputDocData': false,

         'package': './package.json',

         'plugins': [],

         'removeCommonPath': false,

         'separateDataArchives': false,

         'test.excludes': [],

         'undocumentIdentifier': true,

         'unexportIdentifier': false
      };
   }

   /**
    * Generates the post-validation data structure for bulk checking a TJSDocConfig object. If a field is present it will
    * be validated otherwise no particular fields are checked.
    *
    * @param {EventProxy}  eventbus - The plugin manager eventbus proxy.
    *
    * @returns {object}
    */
   static postValidate(eventbus)
   {
      const preValidateData = ConfigData.preValidate(eventbus);

      return Object.assign({}, preValidateData,
      {
         // Ensures that destination when resolved is a directory or that the parent directory exists and destination
         // doesn't exist.
         destination: { required: true, test: 'entry', type: 'string', expected: (entry) =>
         {
            const resolvedPath = path.resolve(entry);

            let resolvedParentPath = path.dirname(resolvedPath);

            // If the resolved path directory exists then destination is valid.
            try { if (fs.statSync(resolvedPath).isDirectory()) { return true; } }
            catch (err) { /* nop */ }

               // Allow parent depth of 3 levels back from top level parent.
               for (let cntr = 3; --cntr >= 0;)
               {
                  try
                  {
                     if (fs.statSync(resolvedParentPath).isDirectory())
                     {
                        if (!fs.existsSync(resolvedPath)) { return true; }
                     }
                  }
                  catch (err) { /* nop */ }

                  resolvedParentPath = path.dirname(resolvedParentPath);
               }

            return false;
         }, message: 'invalid directory' },

         publisher: { required: false, test: 'entry', expected:
          (entry) => (typeof entry === 'string' || typeof entry === 'object') }
      });
   }

   /**
    * Generates the pre-validation data structure for bulk checking a TJSDocConfig object. If a field is present it will
    * be validated otherwise no particular fields are checked.
    *
    * @param {EventProxy}  eventbus - The plugin manager eventbus proxy.
    *
    * @returns {object}
    */
   static preValidate(eventbus)
   {
      return {
         'access': { required: false, test: 'array', expected: ['private', 'protected', 'public'] },

         'autoPrivate': { required: false, test: 'entry', type: 'boolean' },

         'builtinVirtual': { required: false, test: 'entry', type: 'boolean' },

         'compactData': { required: false, test: 'entry', type: 'boolean' },

         'compressData': { required: false, test: 'entry', type: 'boolean' },

         'compressFormat': { required: false, test: 'entry', expected: ['tar.gz', 'zip'] },

         'compressOutput': { required: false, test: 'entry', type: 'boolean' },

         'copyPackage': { required: false, test: 'entry', type: 'boolean' },

         'debug': { required: false, test: 'entry', type: 'boolean' },

         'destination': { required: false, test: 'entry|array', type: 'string' },

         'docCoverage': { required: false, test: 'entry', type: 'boolean' },

         'docLint': { required: false, test: 'entry', type: 'boolean' },

         'excludes': { required: false, test: 'array', expected: (entry) => new RegExp(entry) },

         'emptyDestination': { required: false, test: 'entry', type: 'boolean' },

         'extends': { required: false, test: 'entry|array', expected: 'string' },

         'fullStackTrace': { required: false, test: 'entry', type: 'boolean' },

         'includeSource': { required: false, test: 'entry', type: 'boolean' },

         'index': { required: false, test: 'entry', type: 'string' },

         'logLevel': { required: false, test: 'entry', expected:
          (entry) => eventbus.triggerSync('log:level:is:valid', entry), message: 'invalid log level' },

         'outputASTData': { required: false, test: 'entry', type: 'boolean' },

         'outputDocData': { required: false, test: 'entry', type: 'boolean' },

         'package': { required: false, test: 'entry', type: 'string' },

         'plugins': { required: false, test: 'array', expected:
          (entry) => eventbus.triggerSync('plugins:is:valid:config', entry), message: 'invalid plugin config' },

         'publisher': { required: false, test: 'entry', expected:
          (entry) => (typeof entry === 'string' || typeof entry === 'object') && entry !== null },

         'scripts': { required: false, test: 'array', type: 'string' },

         'separateDataArchives': { required: false, test: 'entry', type: 'boolean' },

         'source': { required: false, test: 'entry|array', type: 'string' },

         'sourceFiles': { required: false, test: 'array', type: 'string' },

         'styles': { required: false, test: 'array', type: 'string' },

         'test': { required: false, test: 'entry', expected: (entry) => entry !== null && typeof entry === 'object' },

         'test.excludes': { required: false, test: 'array', expected: (entry) => new RegExp(entry) },

         'test.includes': { required: false, test: 'array', expected: (entry) => new RegExp(entry) },

         'test.source': { required: false, test: 'entry|array', type: 'string' },

         'test.sourceFiles': { required: false, test: 'array', type: 'string' },

         'test.type': { required: false, test: 'entry', expected: new Set(['mocha']) },

         'undocumentIdentifier': { required: false, test: 'entry', type: 'boolean' },

         'unexportIdentifier': { required: false, test: 'entry', type: 'boolean' }
      };
   }

   /**
    * Returns config keys that are a string and are upgraded to an array or are already an array to be merged.
    *
    * @returns {Array<string>}
    */
   static upgradeMergeList()
   {
      return [
         'access',
         'excludes',
         'extends',
         'includes',
         'pathExtensions',
         'plugins',
         'scripts',
         'source',
         'sourceFiles',
         'styles'
      ];
   }
}

