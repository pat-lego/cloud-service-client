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
const nock = require("nock");

const { importFile } = require("../test-utils");
const MockHttpInterceptor = require("../mock-http-interceptor");

const AxiosBackend = importFile("http-backends/axios-backend");
const HttpOptions = importFile("http-options");

describe("axios backend tests", async function () {
  it("test register intercept response", async function () {
    const backend = new AxiosBackend({}, axios);
    const axiosIntercepted = backend.registerInterceptors(
      new MockHttpInterceptor()
    );
    nock("http://axiosinterceptorstesting.com").get("/").reply(200);
    const response = await axiosIntercepted(
      "http://axiosinterceptorstesting.com"
    );
    assert.ok(response);
    assert.ok(response.intercepted);
  });

  it("test register intercept error response", async function () {
    const HOST = "http://axiosinterceptorstesting.com";
    const backend = new AxiosBackend({}, axios);
    const axiosIntercepted = backend.registerInterceptors(
      new MockHttpInterceptor()
    );

    nock(HOST).get("/").reply(404);

    return assert.rejects(
      () => {
        return axiosIntercepted("http://axiosinterceptorstesting.com");
      },
      {
        intercepted: true,
      }
    );
  });

  it("test get error config", function () {
    const backend = new AxiosBackend({}, axios);
    const error = {
      config: { hello: "world" },
    };
    assert.deepStrictEqual(backend.getErrorConfig(error), { hello: "world" });
  });

  it("test get missing error config", function () {
    const backend = new AxiosBackend({}, axios);
    assert.throws(() => {
      backend.getErrorConfig({});
    });
  });

  it("test get response config", function () {
    const backend = new AxiosBackend({}, axios);
    const response = {
      config: { hello: "world" },
    };
    assert.deepStrictEqual(backend.getResponseConfig(response), {
      hello: "world",
    });
  });

  it("test get missing response config", function () {
    const backend = new AxiosBackend({}, axios);
    assert.throws(() => {
      backend.getResponseConfig({});
    });
  });

  it("test get request config", async function () {
    const backend = new AxiosBackend({}, axios);
    let config = await backend.getRequestConfig(
      new HttpOptions({ url: "testing" })
    );
    assert.deepStrictEqual(config, {
      url: "testing",
      timeout: 60000,
    });

    config = await backend.getRequestConfig(
      new HttpOptions({
        url: "testing",
        timeout: 1000,
      })
    );
    assert.deepStrictEqual(config, {
      url: "testing",
      timeout: 1000,
    });

    config = await backend.getRequestConfig(
      new HttpOptions({
        url: "testing",
        cloudClient: {
          timeout: 1000,
        },
      })
    );
    assert.deepStrictEqual(config, {
      url: "testing",
      timeout: 1000,
      cloudClient: {
        timeout: 1000,
      },
    });

    config = await backend.getRequestConfig(
      new HttpOptions({
        url: "testing",
        timeout: 2000,
        cloudClient: {
          timeout: 1000,
        },
      })
    );
    assert.deepStrictEqual(config, {
      url: "testing",
      timeout: 2000,
      cloudClient: {
        timeout: 1000,
      },
    });
  });

  it("test submit request", async function () {
    const host = "http://somereallynotfoundunittestdomain.com";
    const backend = new AxiosBackend({}, axios);
    nock(host)
      .get("/testing")
      .reply(200, { hello: "world" }, { "x-request-id": "id" });
    const response = await backend.submitRequest({
      url: `${host}/testing`,
    });
    const { status, data, headers } = response;
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(data, { hello: "world" });
    assert.strictEqual(headers["x-request-id"], "id");
  });

  it("test set cookies", function () {
    const backend = new AxiosBackend({}, axios);
    assert.deepStrictEqual(backend.getSetCookies({}), []);
    assert.deepStrictEqual(
      backend.getSetCookies({
        headers: {
          "set-cookie": ["cookie1", "cookie2"],
        },
      }),
      ["cookie1", "cookie2"]
    );
  });

  it("test get error response", function () {
    const backend = new AxiosBackend({}, axios);
    const httpOptions = new HttpOptions();
    const error = new Error("unit test error");
    const notAxiosResponse = backend.getErrorResponse(httpOptions, error);
    assert.ok(!notAxiosResponse);
    error.response = { status: 404 };

    const axiosResponse = backend.getErrorResponse(httpOptions, error);
    assert.strictEqual(axiosResponse.status, 404);
  });

  it("test create http options", function () {
    const backend = new AxiosBackend({}, axios);
    const options = backend.createHttpOptions({ url: "testing" });
    assert.ok(options);
    assert.strictEqual(options.constructor.name, "AxiosHttpOptions");
    assert.strictEqual(options.getUrl(), "testing");
  });
});
