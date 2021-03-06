/**
 * Please refer to the following files in the root directory:
 * 
 * README.md        For information about the package.
 * LICENSE          For license details, copyrights and restrictions.
 */
'use strict';
const path = require('path');
const fs = require('fs');

const { sanitizeExtRegex, sanitizeFileRegex, sanitizePathRegex } = require('../utils/regex');
const syslog = require('../logger/syslog');
const arr = require('../utils/array');

/**
 * Filesystem parser.
 */
class FsParser 
{
    // Private fields.
    #startPath = null;
    #absPath = null;
    #opts = {};
    #regex = {};
    #log = [];
    #results = [];
    
    /**
     * Constructor.
     * 
     * @param   {string}                startPath   Path to start parsing at.
     * @param   {string}                absPath     Absolute path (used for getting relative paths).
     * @param   {object}                opts        Options. 
     * @param   {FsParserFilters|null}  filters     Filters or null.
     */
    constructor(startPath, absPath, opts = {}, filters = null)
    {
        this.#startPath = startPath;
        this.#absPath = absPath;
        this.#opts = opts;

        this.#log = [];

        this.#regex = {
            allowPaths: undefined,
            ignorePaths: undefined,
            ignoreDirs: undefined,
            onlyFiles: undefined,
            allowFiles: undefined,
            ignoreFiles: undefined,
            ignoreFilesFirst: undefined,
            ignoreExts: undefined,
        };


        if (opts) {
            this._configureRegex();
        }
    }

    /**
     * Configure the regex from the options.
     */
    _configureRegex()
    {
        let opts = this.#opts;

        for (let item of ['allowPaths', 'ignorePaths']) {
            if (opts[item]) {
                opts[item] = arr.makeArray(opts[item]);
                let ap = sanitizePathRegex(opts[item]);
                if (ap != '') {
                    this.#regex[item] = new RegExp("^(" + ap + ")", 'i');
                }
            }
        }

        for (let item of ['onlyFiles', 'allowFiles', 'ignoreFiles', 'ignoreFilesFirst', 'ignoreDirs']) {
            if (opts[item]) {
                opts[item] = arr.makeArray(opts[item]);
                let ap = sanitizeFileRegex(opts[item]);
                if (ap != '') {
                    this.#regex[item] = new RegExp("^(" + ap + ")", 'i');
                }
            }
        }

        if (opts.ignoreExts) {
            opts.ignoreExts = arr.makeArray(opts.ignoreExts);
            let ap = sanitizeExtRegex(opts.ignoreExts);
            if (ap != '') {
                this.#regex.ignoreExts = new RegExp("^(" + ap + ")", 'i');
            }
        }

    }

    /**
     * Start parsing.
     * 
     * @return  {string[]}  Parsed results.
     */
    async parse()
    {
        this.#results = [];
        await this._parseDir(this.#startPath);
        return this.#results;
    }

    /**
     * Parse a directory.
     * 
     * @param   {string}    dir     Directory to parse.
     */
    async _parseDir(dir)
    {
        let entries = fs.readdirSync(dir);
        await Promise.all(entries.map(async entry => {

            let filePath = path.join(dir, entry);
            let stats = fs.statSync(filePath);

            if (stats.isFile() && this.doWeProcessFile(filePath)) {
                this.#results.push(filePath);
            } else if (stats.isDirectory() && this.doWeProcessDir(filePath, entry)) {
                this._parseDir(filePath);
            }
    
        }));

    }

    /**
     * Do we process a file?
     * 
     * @param   {string}    filePath    File to check.
     * @return  {boolean}               True if we do, else false.
     */
    doWeProcessFile(filePath)
    {
        let rel = filePath.replace(this.#absPath, '');
        if (path.sep != rel[0]) {
            rel = path.sep + rel;
        }
        let base = path.basename(filePath);
        let ext = path.extname(filePath);

        this._logMsg('FsParser:_doWeProcessFile', `Processing file: ${rel}`);

        // If only files is set, literally just get those.
        if (this.#regex.onlyFiles) {
            let result = this.#regex.onlyFiles.exec(base);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessFile', `   => only file first via: ${result[0]}`);
                return true;
            } else {
                return false;
            }
        }
    
        // Ignore files first.
        if (this.#regex.ignoreFilesFirst) {
            let result = this.#regex.ignoreFilesFirst.exec(base);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessFile', `   => ignore file first via: ${result[0]}`);
                return false;
            }
        }

        // Allow files?
        if (this.#regex.allowFiles) {
            let result = this.#regex.allowFiles.exec(base);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessFile', `   => allow file via: ${result[0]}`);
                return true;
            }
        }

        // Ignore files.
        if (this.#regex.ignoreFiles) {
            let result = this.#regex.ignoreFiles.exec(base);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessFile', `   => ignore file via: ${result[0]}`);
                return false;
            }
        }

        // Ignore extensions.
        if (this.#regex.ignoreExts) {
            let result = this.#regex.ignoreExts.exec(ext);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessFile', `   => ignore file extension via: ${result[0]}`);
                return false;
            }
        }

        if (this.#opts.ignoreFilesByDefault && this.#opts.ignoreFilesByDefault === true) {
            this._logMsg('FsParser:_doWeProcessFile', `   => ignore file by default`);
            return false;
        } else {
            this._logMsg('FsParser:_doWeProcessFile', `   => allow file by default`);
            return true;
        }
    }

    /**
     * Do we process a directory?
     * 
     * @param   {string}    filePath    File to check.
     * @param   {string}    entry       The actual entry, not prefixed with full root.
     * @return  {boolean}               True if we do, else false.
     */
    doWeProcessDir(filePath, entry)
    {
        let rel = filePath.replace(this.#absPath, '');
        if (path.sep != rel[0]) {
            rel = path.sep + rel;
        }
        this._logMsg('FsParser:_doWeProcessDir', `Processing directory: ${rel}`);

        // Allow paths?
        if (this.#regex.allowPaths) {
            let result = this.#regex.allowPaths.exec(rel);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessDir', `   => allow path via: ${result[0]}`);
                return true;
            }
        }

        // Ignore paths.
        if (this.#regex.ignorePaths) {
            let result = this.#regex.ignorePaths.exec(rel);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessDir', `   => ignore path via: ${result[0]}`);
                return false;
            }
        }
        
        // Ignore dirs.
        if (this.#regex.ignoreDirs) {
            let result = this.#regex.ignoreDirs.exec(entry);            
            if (null !== result) {
                this._logMsg('FsParser:_doWeProcessDir', `   => ignore dir via: ${result[0]}`);
                return false;
            }
        }

        if (this.#opts.ignorePathsByDefault && this.#opts.ignorePathsByDefault === true) {
            this._logMsg('FsParser:_doWeProcessDir', `   => ignore dir by default`);
            return false;
        } else {
            this._logMsg('FsParser:_doWeProcessDir', `   => allow dir by default`);
            return true;
        }

    }

    /**
     * Freeform check to see if a passed file needs processing.
     * 
     * @param   {string}    file    File to check.
     * @return  {boolean}           True if we have to process it, else false.
     */
    freeformCheckFile(file)
    {
        let sp = file.split('/');
        sp.pop();
        let entry = sp.pop();

        if (!this.doWeProcessDir(path.join(sp, entry), entry)) {
            return false;
        }

        if (!this.doWeProcessFile(file)) {
            return false;
        }

        return true;
    }

    /**
     * Log a message.
     * 
     * @param   {string}    func    Function name.
     * @param   {string}    msg     Message.
     */
    _logMsg(func, msg)
    {
        syslog.trace(func, msg);
        this.#log.push({func: func, msg: msg});
    }

    /**
     * Get the message log.
     * 
     * @return  {object[]}          Array of message objects.
     */
    get log()
    {
        return this.#log;
    }
}

module.exports = FsParser;
