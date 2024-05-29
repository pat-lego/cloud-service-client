/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const fetch = require("minipass-fetch");
const assert = require("assert");

const Verifier = require("./verifier");

/**
 * Implementation of a verifier that assumes the underlying HTTP library is fetch.
 */
class FetchVerifier extends Verifier {
  getExport(clientExports, options = { handleCookies: false }) {
    const { fetchClient } = clientExports;
    const fetchToUse = fetchClient(fetch, options);

    // "faking" axios-like methods so that the e2e tests will work with either
    // backend library
    const exportFunc = async (url, options) => {
      if (url instanceof String || typeof url === "string") {
        return fetchToUse(url, options);
      }

      // first argument is an object containing everything (like axios)
      const { url: fetchUrl } = url;
      const fetchOptions = {
        ...url,
      };
      delete fetchOptions.url;
      return fetchToUse(fetchUrl, fetchOptions);
    };
    exportFunc.put = (url, body, config) =>
      this.sendBodyRequest(fetchToUse, url, body, "PUT", config);
    exportFunc.get = (url) => fetchToUse(url);
    exportFunc.head = (url) =>
      fetchToUse(url, {
        method: "HEAD",
      });
    exportFunc.post = (url, body, config) =>
      this.sendBodyRequest(fetchToUse, url, body, "POST", config);
    exportFunc.patch = (url, body) =>
      this.sendBodyRequest(fetchToUse, url, body, "PATCH");
    exportFunc.options = (url) =>
      fetchToUse(url, {
        method: "OPTIONS",
      });
    exportFunc.delete = (url) =>
      fetchToUse(url, {
        method: "DELETE",
      });
    return exportFunc;
  }

  /**
   * Does the work of sending a request with fetch, given axios-like options.
   *
   * @param {*} requestFetch Fetch function to use to send request.
   * @param {string} url URL of the request to send.
   * @param {*} body Body to use in the request. Will be stringified before sending.
   * @param {string} method HTTP method to use in the request.
   * @param {*} [config] Additional configuration values to send.
   * @returns {Promise<*>} Will be resolved with fetch's response to the request.
   */
  sendBodyRequest(requestFetch, url, body, method, config = {}) {
    return requestFetch(url, {
      ...config,
      body: JSON.stringify(body),
      method: method,
    });
  }

  verifySpecificSuccess(res) {
    assert.ok(res.ok);
  }

  getHeader(res, header) {
    return res.headers.get(header);
  }

  async getBody(res) {
    return res.json();
  }

  async verifyFailure(toRun, expectedStatus, additionalResponseValues = {}) {
    const res = await toRun();
    assert.ok(!res.ok);
    assert.strictEqual(res.status, expectedStatus);
    this.verifyOptionsClientProperties(res, additionalResponseValues);
  }
}

module.exports = FetchVerifier;
