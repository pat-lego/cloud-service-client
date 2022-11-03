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

const { importFile } = require("./test-utils");

const HttpBackendInterceptor = importFile("http-backend-interceptor");
const HttpBackend = importFile("http-backends/http-backend");

describe("http backend interceptor tests", function () {
  /**
   * @private
   */
  function getMockClient(retryOptions = false) {
    return {
      beginBackendRequest: (backend, config) => {
        return {
          ...config,
          intercepted: true,
        };
      },
      endBackendRequestWithError: (backend, config, error) => {
        error.intercepted = true;
        return error;
      },
      endBackendRequestWithResponse: (backend, config, response) => {
        response.intercepted = true;
        return response;
      },
      getRetryOptionsFromResponse: (backend, config, response) => retryOptions,
      getClientResponse: (backend, config, response, error) => {
        if (error) {
          error.interceptedResponseError = true;
        }
        response.interceptedResponse = true;
        return response;
      },
      getClientError: (backend, config, error) => {
        error.interceptedError = true;
        return error;
      },
    };
  }

  it("test intercept request", async function () {
    const interceptor = new HttpBackendInterceptor(getMockClient());
    const backend = new HttpBackend();
    const options = { test: "value" };
    const result = await interceptor.interceptRequest(backend, options);
    assert.ok(result.intercepted);
  });

  it("test intercept request error", async function () {
    const interceptor = new HttpBackendInterceptor(getMockClient());
    const backend = new HttpBackend();
    const options = { test: "value" };
    const error = new Error("unit test error");
    const result = await interceptor.interceptRequestError(
      backend,
      options,
      error
    );
    assert.ok(result.intercepted);
  });

  it("test intercept response success", async function () {
    const interceptor = new HttpBackendInterceptor(getMockClient());
    const backend = new HttpBackend();
    const options = { test: "value" };
    const result = await interceptor.interceptResponse(backend, options, {});
    assert.ok(result.intercepted);
  });

  it("test intercept response retry", async function () {
    const interceptor = new HttpBackendInterceptor(
      getMockClient({ retry: true })
    );
    const backend = new HttpBackend();
    backend.submitRequest = (options) => {
      const { retries = 0 } = options;
      options.retries = retries + 1;
      return options;
    };
    const options = { test: "value" };
    const result = await interceptor.interceptResponse(backend, options, {});
    assert.deepEqual(result, {
      retry: true,
      retries: 1,
    });
  });

  it("test intercept response error no retry", async function () {
    const interceptor = new HttpBackendInterceptor(getMockClient());
    const response = {};
    const backend = new HttpBackend();
    backend.getErrorResponse = () => response;

    const options = { test: "value" };
    const error = new Error("unit test error");
    const result = await interceptor.interceptResponseError(
      backend,
      options,
      error
    );
    assert.ok(result);
    assert.strictEqual(result, response);
    assert.ok(response.intercepted);
    assert.ok(response.interceptedResponse);
    assert.ok(error.interceptedResponseError);
    assert.ok(!error.intercepted);
  });

  it("test intercept response error retry", async function () {
    const interceptor = new HttpBackendInterceptor(
      getMockClient({ retry: true })
    );
    const backend = new HttpBackend();
    backend.getErrorResponse = () => false;
    backend.submitRequest = (options) => {
      const { retries = 0 } = options;
      options.retries = retries + 1;
      return options;
    };

    const options = { test: "value" };
    const error = new Error("unit test error");
    const result = await interceptor.interceptResponseError(
      backend,
      options,
      error
    );
    assert.ok(result);
    assert.ok(error.intercepted);
    assert.ok(!error.interceptedError);
    assert.deepEqual(result, {
      retry: true,
      retries: 1,
    });
  });

  it("test intercept response error only no retry", async function () {
    const interceptor = new HttpBackendInterceptor(getMockClient());
    const backend = new HttpBackend();
    backend.getErrorResponse = () => false;

    const options = { test: "value" };
    const error = new Error("unit test error");
    const result = await interceptor.interceptResponseError(
      backend,
      options,
      error
    );
    assert.ok(result);
    assert.strictEqual(result, error);
    assert.ok(error.intercepted);
    assert.ok(error.interceptedError);
  });
});
