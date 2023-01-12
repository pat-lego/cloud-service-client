/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const assert = require("assert");

const { retryWithStrategies } = require("../src/http-client-utils");
const HttpBackend = require("../src/http-backends/http-backend");
const HttpOptions = require("../src/http-options");
const HttpResponse = require("../src/http-response");

describe("http client utils tests", function () {
  it("test retry with no strategies", async function () {
    const backend = new HttpBackend();
    const options = new HttpOptions();
    const response = new HttpResponse({ status: 200 });
    const delay = await retryWithStrategies(options, backend, response, 1);
    assert.ok(!delay);
  });

  it("test retry with 500 error", async function () {
    const backend = new HttpBackend();
    const options = new HttpOptions();
    const response = new HttpResponse({ status: 500 });
    const delay = await retryWithStrategies(options, backend, response, 1);
    assert.strictEqual(delay, 1000);
  });

  it("test retry with custom strategy", async function () {
    const backend = new HttpBackend();
    const options = new HttpOptions({
      cloudClient: {
        retry: {
          strategies: [
            {
              shouldRetry: () => true,
            },
          ],
        },
      },
    });
    const response = new HttpResponse({ status: 200 });
    const delay = await retryWithStrategies(options, backend, response, 1);
    assert.strictEqual(delay, 1000);
  });

  it("test retry with custom delay multiple strategy", async function () {
    const backend = new HttpBackend();
    const options = new HttpOptions({
      cloudClient: {
        retry: {
          strategies: [
            {
              shouldRetry: () => true,
              getDelayMultiple: () => 10,
            },
          ],
        },
      },
    });
    const response = new HttpResponse({ status: 200 });
    const delay = await retryWithStrategies(options, backend, response, 2);
    assert.strictEqual(delay, 10000);
  });

  it("test retry with custom max retries strategy", async function () {
    const backend = new HttpBackend();
    const options = new HttpOptions({
      cloudClient: {
        retry: {
          strategies: [
            {
              shouldRetry: () => true,
              getMaxRetries: () => 1,
            },
          ],
        },
      },
    });
    const response = new HttpResponse({ status: 200 });
    const delay = await retryWithStrategies(options, backend, response, 2);
    assert.strictEqual(delay, false);
  });

  it("test retry with custom delay duration strategy", async function () {
    const backend = new HttpBackend();
    const options = new HttpOptions({
      cloudClient: {
        retry: {
          strategies: [
            {
              shouldRetry: () => true,
              getDelay: () => 1,
            },
          ],
        },
      },
    });
    const response = new HttpResponse({ status: 200 });
    const delay = await retryWithStrategies(options, backend, response, 1);
    assert.strictEqual(delay, 1);
  });
});
