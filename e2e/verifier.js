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

const assert = require("assert");
const typedefs = require("../src/typedefs");

/**
 * A verifier is used as a way for the e2e tests to reuse test cases with different
 * underlying clients. For example, the same tests can be run with both Axios
 * and Fetch even though their interfaces are different.
 */
class Verifier {
  /**
   * Constructs a new verifier that uses its default settings.
   */
  constructor() {}

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Retrieves the export that should be used in conjunction with the verifier.
   * @param {*} clientExports Exports from the HTTP client.
   * @param {typedefs.ClientOptions} options Options to use with the backend.
   * @returns {*} Export for the verifier.
   */
  getExport(clientExports, options) {
    throw new Error("Calling verifier getExport() method");
  }

  /**
   * Verifies that a given object contains the custom properties expected in client
   * responses.
   * @param {*} toVerify Item to be verified.
   */
  verifyClientProperties(toVerify) {
    const { cloudClient = {} } = toVerify;
    const { options = {} } = cloudClient;
    const { cloudClient: optionsCloudClient = {} } = options;
    const { retries, retryWait, startTime, endTime, retryResponses } =
      optionsCloudClient;
    assert.ok(retries !== undefined);
    assert.ok(retryWait !== undefined);
    assert.ok(startTime !== undefined);
    assert.ok(endTime !== undefined);
    assert.ok(retryResponses !== undefined);
    assert.ok(retryResponses.length !== undefined);
    assert.ok(cloudClient.requestTime !== undefined);
  }

  /**
   * Verifies that a given object contains specific custom properties expected in
   * client responses.
   *
   * This function will look for client-specific values within an "options"
   * property on the target.
   * @param {*} toVerify Item to be verified.
   * @param {*} expected Simple object whose keys and values will be verified
   *  on the target. The value of the key may be a function; if so, the function
   *  will be called with a single argument (the actual value), and should
   *  return true if valid, false otherwise.
   */
  verifyOptionsClientProperties(toVerify, expected) {
    const { cloudClient = {} } = toVerify;
    const { options = {} } = cloudClient;
    this.verifyCloudClientProperties(options, expected);
  }

  /**
   * Verifies that a given object contains specific custom properties expected in
   * client responses.
   * @param {*} toVerify Item to be verified.
   * @param {*} expected Simple object whose keys and values will be verified
   *  on the target. The value of the key may be a function; if so, the function
   *  will be called with a single argument (the actual value), and should
   *  return true if valid, false otherwise.
   */
  verifyCloudClientProperties(toVerify, expected) {
    const { cloudClient = {} } = toVerify;
    Object.keys(expected).forEach((expectedProperty) => {
      const actualValue = cloudClient[expectedProperty];
      const expectedValue = expected[expectedProperty];
      const message = `expected options.cloudClient.${expectedProperty} to be "${expectedValue}", but it's ${actualValue}`;
      if (typeof expectedValue === "function") {
        assert.ok(expectedValue(actualValue), message);
      } else {
        assert.strictEqual(actualValue, expectedValue, message);
      }
    });
  }

  /**
   * Ensures that a given response indicates success.
   * @param {*} res Response received from an underlying HTTP library.
   * @param {number} [expectedStatus] Expected status code of the response. Default: 200.
   */
  verifySuccess(res, expectedStatus = 200) {
    const { status } = res;
    this.verifyClientProperties(res);
    assert.strictEqual(status, expectedStatus);
    assert.ok(this.getHeader(res, "date"));
    this.verifySpecificSuccess(res);
  }

  /**
   * Ensures that a given response indicates failure.
   * @param {Function} toRun Function to run that will generate an HTTP response. It will receive
   *  no arguments, and should return a Promise that resolves to an HTTP response from the
   *  underlying HTTP library.
   * @param {number} expectedStatus The expected status code of the response.
   * @param {object} [additionalResponseValues] Key value pairs of any additional items to
   *  verify on the response object.
   * @returns {Promise} Should resolve when the verification is complete.
   */
  async verifyFailure(toRun, expectedStatus, additionalResponseValues = {}) {
    throw new Error("Cannot use Verifier directly");
  }

  /**
   * Not intended to be called directly. Can be implemented by child classes to perform any
   * additional library-specific verification on success responses.
   * @param {*} res Response received from an underlying HTTP library.
   */
  verifySpecificSuccess(res) {
    throw new Error("Cannot use Verifier directly");
  }

  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Retrieves the value of an HTTP header from a response.
   * @param {*} res Response received from an underlying HTTP library.
   * @param {string} header Name of the header to retrieve.
   * @returns {string} Value of the given header.
   */
  getHeader(res, header) {
    throw new Error("Cannot use Verifier directly");
  }

  /**
   * Verifies that the body of an HTTP response is an expected value.
   * @param {*} res Response received from an underlying HTTP library.
   * @param {object} expectedBody Expected value of the body, typically a simple
   *  javascript object.
   * @returns {Promise} Should resolve when the verification is complete.
   */
  async verifyBody(res, expectedBody) {
    const body = await this.getBody(res);
    assert.deepStrictEqual(body, expectedBody);
  }

  /**
   * Verifies that the body of an HTTP request is empty.
   * @param {*} res Response received from an underlying HTTP library.
   * @returns {Promise} Should resolve when the verification is complete.
   */
  async verifyEmptyBody(res) {
    const body = await this.getBody(res);
    assert.ok(!body);
  }

  /**
   * Retrieves the body of an HTTP response.
   * @param {*} res Response received from an underlying HTTP library.
   * @returns {Promise<object>} The body of the response as a simple javascript object.
   */
  async getBody(res) {
    throw new Error("Cannot use Verifier directly");
  }
}

module.exports = Verifier;
