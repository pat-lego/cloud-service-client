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

const EventuallyConsistentDelete = importFile(
  "retry-strategies/eventually-consistent-delete"
);

describe("retry eventually consistent delete tests", function () {
  it("test retry eventually consistent delete methods", async function () {
    const retryStrategy = new EventuallyConsistentDelete();
    const retryOptions = {
      attempts: 1,
      maxAttempts: 2,
      response: {},
    };
    assert(!(await retryStrategy.shouldRetry(retryOptions)));
    retryOptions.response = { status: 200 };
    assert(await retryStrategy.shouldRetry(retryOptions));
    retryOptions.response = { status: 404 };
    assert(!(await retryStrategy.shouldRetry(retryOptions)));
    retryOptions.attempts = 2;
    assert(!(await retryStrategy.shouldRetry(retryOptions)));
    delete retryOptions.response;
    assert(!(await retryStrategy.shouldRetry(retryOptions)));
  });
});
