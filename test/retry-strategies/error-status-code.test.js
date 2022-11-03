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

const assert = require("assert");
const { importFile } = require("../test-utils");

const ErrorStatusCode = importFile("retry-strategies/error-status-code");

describe("error status code retry tests", function () {
  it("test retry error status methods", async function () {
    const errorStatus = new ErrorStatusCode();
    const retryOptions = {
      attempts: 1,
      maxAttempts: 2,
      response: { status: 200 },
    };
    assert(!(await errorStatus.shouldRetry(retryOptions)));
    retryOptions.response = {};
    assert(!(await errorStatus.shouldRetry(retryOptions)));
    retryOptions.response = { status: 500 };
    assert(await errorStatus.shouldRetry(retryOptions));
    retryOptions.attempts = 2;
    assert(await errorStatus.shouldRetry(retryOptions));
    delete retryOptions.response;
    assert(!(await errorStatus.shouldRetry(retryOptions)));
  });
});
