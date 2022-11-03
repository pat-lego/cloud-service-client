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
const nock = require("nock");

const { importFile } = require("../test-utils");
const HttpOptions = importFile("http-options");
const HttpBackendInterceptor = importFile("http-backend-interceptor");

const HttpBackend = importFile("http-backends/http-backend");

describe("http backend tests", function () {
  it("test register interceptors", function () {
    const backend = new HttpBackend();
    assert.throws(() => {
      backend.registerInterceptors(new HttpBackendInterceptor());
    });
  });

  it("test get request config", async function () {
    const backend = new HttpBackend();
    const options = new HttpOptions({ url: "testing" });
    let config = await backend.getRequestConfig(options);
    assert.deepStrictEqual(config, {
      url: "testing",
    });
  });

  it("test submit request", async function () {
    const backend = new HttpBackend();
    return assert.rejects(() => {
      return backend.submitRequest({});
    });
  });

  it("test set cookies", function () {
    const backend = new HttpBackend();
    assert.throws(() => {
      backend.getSetCookies({});
    });
  });

  it("test get error response", function () {
    const backend = new HttpBackend();
    assert.ok(
      !backend.getErrorResponse(new HttpOptions(), new Error("unit test error"))
    );
  });

  it("test create http response", function () {
    const backend = new HttpBackend();
    const response = backend.createHttpResponse({
      status: 200,
      statusText: "OK",
    });
    assert.ok(response);
    assert.strictEqual(response.getStatus(), 200);
    assert.strictEqual(response.getStatusText(), "OK");
  });

  it("test create http error response", function () {
    const backend = new HttpBackend();
    const response = backend.createHttpResponse(
      {
        status: 404,
      },
      new Error("unit test error")
    );

    assert.throws(
      () => {
        response.toClientResponse();
      },
      {
        message: "unit test error",
      }
    );
  });

  it("test create http options", function () {
    const backend = new HttpBackend();
    const options = backend.createHttpOptions({ url: "testing" });
    assert.ok(options);
    assert.strictEqual(options.getUrl(), "testing");
  });

  it("test should handle cookies", function () {
    let backend = new HttpBackend();
    assert.ok(!backend.shouldHandleCookies());
    backend = new HttpBackend({ handleCookies: false });
    assert.ok(!backend.shouldHandleCookies());
    backend = new HttpBackend({ handleCookies: true });
    assert.ok(backend.shouldHandleCookies());
  });
});
