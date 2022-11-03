/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

require("core-js");
require("regenerator-runtime");

const Path = require("path");

/**
 * Imports a file from the HTTP client's source by its relative path from the root
 * source directory. For example, assuming the desired import is "src/http-client",
 * the correct usage of the method would be "importFile('http-client')".
 *
 * @param {string} filePath Path of the file to import.
 * @returns {*} Result of the import.
 */
function importFile(filePath) {
  const requirePath = Path.join(__dirname, "../src", filePath);
  let required = require(requirePath);
  if (required && required.default) {
    return required.default;
  }
  return required;
}

module.exports = {
  importFile,
};
