/**
 * Please refer to the following files in the root directory:
 * 
 * README.md        For information about the package.
 * LICENSE          For license details, copyrights and restrictions.
 */
'use strict';

const path = require('path');
const GAError = require('./gaError');
const syslog = require('../logger/syslog');

/**
 * Sanitize an extension check regex string.
 * 
 * @param   {string}  s     String to sanitize.
 * @return  {string}        Sanitized string.
 */
function sanitizeExtRegex(s)
{
    let ap = '';

    s.forEach((p) => {
        if (p[0] != '.') {
            p = '.' + p;
        }
        if (ap != '') {
            ap += '|';
        }
        ap += regexEscape(p);
    });

    return ap;
}

/**
 * Sanitize a file check regex string.
 * 
 * @param   {string}   s    String to sanitize.
 * @return  {string}        Sanitized string.
 */
function sanitizeFileRegex(s)
{
    let ap = '';

    s.forEach((p) => {
        if (p[0] == path.sep) {
            p = p.substring(1);
        }
        if (ap != '') {
            ap += '|';
        }
        ap += regexEscape(p);
    });

    return ap;
}

/**
 * Sanitize a path check regex string.
 * 
 * @param   {string}    s   String array to sanitize.
 * @return  {string}        Sanitized string.
 */
function sanitizePathRegex(s)
{
    let ap = '';

    s.forEach((p) => {
        if (p[0] != path.sep) {
            p = path.sep + p;
        }
        if (ap != '') {
            ap += '|';
        }
        ap += regexEscape(p);
    });

    return ap;
}

/**
 * Escape a regex string.
 * 
 * @param   {string}    s   String to escape.
 * @return  {string}        Escaped string.
 */
function regexEscape(s)
{
    if (typeof s != "string") {
        syslog.inspect(s);
        throw new GAError(`regexEscape requires a string, we got a ${typeof(s)}.`);
    }
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

exports.sanitizeExtRegex = sanitizeExtRegex;
exports.sanitizeFileRegex = sanitizeFileRegex;
exports.sanitizePathRegex = sanitizePathRegex;
exports.regexEscape = regexEscape;
