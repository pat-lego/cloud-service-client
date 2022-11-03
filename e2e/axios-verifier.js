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

const axios = require("axios");
const assert = require("assert");

const Verifier = require("./verifier");

/**
 * Implementation of a verifier that assumes the underlying HTTP library is axios.
 */
class AxiosVerifier extends Verifier {
  getExport(clientExports, options = { handleCookies: false }) {
    return clientExports.axiosClient(axios, options);
  }

  verifySpecificSuccess(res) {
    // nothing extra for axios
  }

  getHeader(res, header) {
    return res.headers[header];
  }

  getBody(res) {
    return res.data;
  }

  async verifyFailure(toRun, expectedStatus, additionalResponseValues = {}) {
    return assert.rejects(
      () => {
        return toRun();
      },
      (err) => {
        const { response = {} } = err;
        const { status } = response;
        this.verifyClientProperties(response);
        this.verifyClientProperties(err);
        assert.strictEqual(status, expectedStatus);

        const { cloudClient = {} } = response;
        const { options = {} } = cloudClient;
        const { cloudClient: optionsCloudClient = {} } = options;
        Object.keys(additionalResponseValues).forEach((key) => {
          assert.strictEqual(
            optionsCloudClient[key],
            additionalResponseValues[key]
          );
        });
        return true;
      }
    );
  }
}

module.exports = AxiosVerifier;
