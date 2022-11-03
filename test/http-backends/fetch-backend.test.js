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

const fetch = require("node-fetch");
const assert = require("assert");
const nock = require("nock");

const { importFile } = require("../test-utils");
const HttpOptions = require("../../src/http-options");

const FetchBackend = importFile("http-backends/fetch-backend");
const MockHttpInterceptor = require("../mock-http-interceptor");

describe("fetch backend tests", function () {
  it("test register intercept response", async function () {
    const backend = new FetchBackend({}, fetch);

    const fetchIntercept = backend.registerInterceptors(
      new MockHttpInterceptor()
    );
    nock("http://testfetchbackendinterceptors.com").get("/").reply(200);
    const response = await fetchIntercept(
      "http://testfetchbackendinterceptors.com"
    );
    assert.ok(response.ok);
    assert.strictEqual(response.status, 200);
    assert.ok(response.intercepted);
  });

  it("test register intercept error", async function () {
    const HOST = "http://testfetchbackendinterceptors.com";
    const backend = new FetchBackend({}, fetch);

    const fetchIntercept = backend.registerInterceptors(
      new MockHttpInterceptor()
    );

    nock(HOST).get("/").replyWithError("really bad error");
    return assert.rejects(
      () => {
        return fetchIntercept(HOST);
      },
      {
        intercepted: true,
      }
    );
  });

  it("test get request config", async function () {
    const backend = new FetchBackend({}, fetch);
    let config = await backend.getRequestConfig(
      new HttpOptions({ url: "testing" })
    );
    assert.deepStrictEqual(config, {
      url: "testing",
    });
  });

  it("test submit request", async function () {
    const host = "http://somereallynotfoundunittestdomain.com";
    const backend = new FetchBackend({}, fetch);
    backend.registerInterceptors(new MockHttpInterceptor());
    nock(host)
      .get("/testing")
      .reply(200, { hello: "world" }, { "x-request-id": "id" });
    const response = await backend.submitRequest({
      url: `${host}/testing`,
    });
    const { status, headers } = response;
    const data = await response.json();
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(data, { hello: "world" });
    assert.strictEqual(headers.get("x-request-id"), "id");
  });

  it("test fetch set cookies", function () {
    const backend = new FetchBackend({}, fetch);
    assert.deepStrictEqual(backend.getSetCookies({}), []);
    assert.deepStrictEqual(
      backend.getSetCookies({
        headers: {
          has: () => false,
        },
      }),
      []
    );
    assert.deepStrictEqual(
      backend.getSetCookies({
        headers: {
          has: (header) => header === "set-cookie",
          get: (header) =>
            header === "set-cookie" ? "cookie1=value, cookie2=value2" : "",
        },
      }),
      ["cookie1=value", "cookie2=value2"]
    );
  });

  it("test create http options", function () {
    const backend = new FetchBackend({}, fetch);
    const options = backend.createHttpOptions();
    assert.ok(options);
    assert.strictEqual(options.constructor.name, "FetchHttpOptions");
  });
});
