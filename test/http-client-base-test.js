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

const nock = require("nock");
const assert = require("assert");
const URL = require("url");

const { importFile } = require("./test-utils");

const HttpOptions = importFile("http-options");
const HttpClient = importFile("http-client");

const HOST = "http://mockunittestingurl.com";

module.exports = ({ createBackend, label }) => {
  describe(`HTTP ${label} client tests`, function () {
    afterEach(function () {
      nock.cleanAll();
      nock.enableNetConnect();
    });

    /**
     * @private
     */
    function registerRetryResponseNetworkFailure() {
      nock(HOST).get("/").once().replyWithError("nice network error");
    }

    /**
     * @private
     */
    function registerRetryResponseStatusCode() {
      nock(HOST).get("/").once().reply(500);
    }

    /**
     * @private
     */
    function registerSuccessResponse(addlOptions = {}) {
      const { response = {} } = addlOptions;
      const { headers = {} } = response;
      nock(HOST)
        .get("/")
        .once()
        .reply(
          200,
          { hello: "world!" },
          {
            header1: "value1",
            ...headers,
          }
        );
    }

    /**
     * @private
     */
    function getOptions(addlOptions = {}) {
      const { cloudClient = {} } = addlOptions;
      return {
        url: HOST,
        headers: {
          "x-request-id": "testing",
        },
        ...addlOptions,
        cloudClient: {
          retry: {
            delay: 10,
          },
          ...cloudClient,
        },
      };
    }

    /**
     * @private
     */
    async function getTextBody(response) {
      if (response.text) {
        return response.text();
      } else {
        return response.data;
      }
    }

    it(`test ${label} begin backend request`, async function () {
      const client = new HttpClient();
      const config = await client.beginBackendRequest(createBackend(), {
        url: "testing",
      });
      assert.ok(config);
      assert.strictEqual(config.url, "testing");

      const { cloudClient = {} } = config;
      const { startTime, endTime } = cloudClient;
      assert.ok(startTime > 0);
      assert.strictEqual(endTime, 0);
    });

    it(`test ${label} begin backend request with cookies but not handling`, async function () {
      const URL = "http://beginbackendrequesturl.com";
      const client = new HttpClient();
      await client.setCookies(URL, ["cookie1=value1"]);
      const config = await client.beginBackendRequest(
        createBackend({ handleCookies: false }),
        {
          url: URL,
          headers: {
            cookie: "cookie2=value2",
          },
        }
      );
      assert.ok(config);
      assert.strictEqual(config.headers.cookie, "cookie2=value2");
    });

    it(`test ${label} begin backend request with only option cookies while handling`, async function () {
      const URL = "http://beginbackendrequesturl.com";
      const client = new HttpClient();
      const config = await client.beginBackendRequest(createBackend(), {
        url: URL,
        headers: {
          cookie: "cookie2=value2",
        },
      });
      assert.ok(config);
      assert.strictEqual(config.headers.cookie, "cookie2=value2");
    });

    it(`test ${label} begin backend request with cookies while handling`, async function () {
      const URL = "http://beginbackendrequesturl.com";
      const client = new HttpClient();
      await client.setCookies(URL, ["cookie1=value1"]);
      const config = await client.beginBackendRequest(createBackend(), {
        url: URL,
        headers: {
          cookie: "cookie2=value2",
        },
      });
      assert.ok(config);

      const { headers = {} } = config;
      const { cookie } = headers;
      const cookieStr = String(cookie);
      assert.ok(cookieStr.includes("cookie2=value2"));
      assert.ok(cookieStr.includes("cookie1=value1"));
    });

    it(`test ${label} begin backend request with global options`, async function () {
      const URL = "http://beginbackendrequesturl.com";
      const client = new HttpClient();
      client.setGlobalOptions({
        timeout: 2000,
        eventuallyConsistentCreate: true,
      });
      const config = await client.beginBackendRequest(createBackend(), {
        url: URL,
        cloudClient: {
          timeout: 1000,
        },
      });

      const { cloudClient = {} } = config;
      const { timeout, eventuallyConsistentCreate } = cloudClient;
      assert.strictEqual(timeout, 1000);
      assert.strictEqual(eventuallyConsistentCreate, true);
    });

    it(`test ${label} end backend request with response`, function () {
      const client = new HttpClient();
      return client.endBackendRequestWithResponse(
        createBackend(),
        { url: "testing" },
        { status: 200 }
      );
    });

    it(`test ${label} end backend request with response and cookies but not handling`, async function () {
      const URL = "http://testbackendrequestend.com";

      nock(URL).get("/").reply(200, "", {
        "set-cookie": "cookie1=value1",
      });

      const client = new HttpClient();
      const options = { url: URL };
      const backend = createBackend({ handleCookies: false });
      const response = await backend.submitRequest(options);
      await client.endBackendRequestWithResponse(backend, options, response);
      const cookies = await client.getCookies(URL);
      assert.strictEqual(cookies.length, 0);
      assert.ok(nock.isDone());
    });

    it(`test ${label} end backend request with response and cookies with handling`, async function () {
      const URL = "http://testbackendrequestend.com";

      nock(URL).get("/").once().reply(200, "", {
        "set-cookie": "cookie1=value1",
      });

      nock(URL, {
        reqHeaders: {
          cookie: "cookie1=value1",
        },
      })
        .get("/")
        .once()
        .reply(200);

      nock(URL, {
        badHeaders: ["cookie"],
      })
        .get("/")
        .once()
        .reply(200);
      const client = new HttpClient();
      const options = {
        url: URL,
      };
      const backend = createBackend();
      let response = await backend.submitRequest(options);
      await client.endBackendRequestWithResponse(backend, options, response);
      let cookies = await client.getCookies(URL);
      assert.strictEqual(cookies.length, 1);
      assert.ok(String(cookies[0]).includes("cookie1=value1"));

      // this request will include the headers
      response = await backend.submitRequest(options);
      await client.endBackendRequestWithResponse(backend, options, response);

      // cookies should be cleared
      await client.clearCookies();
      response = await backend.submitRequest(options);
      await client.endBackendRequestWithResponse(backend, options, response);
      cookies = await client.getCookies(URL);
      assert.strictEqual(cookies.length, 0);
      assert.ok(nock.isDone());
    });

    it(`test ${label} end backend request with error`, function () {
      const client = new HttpClient();
      return client.endBackendRequestWithError(
        createBackend(),
        { url: "testing" },
        {
          name: "UnitTest",
          message: "unit test error",
        }
      );
    });

    it(`test ${label} end backend request with only name error`, function () {
      const client = new HttpClient();
      return client.endBackendRequestWithError(
        createBackend(),
        { url: "testing" },
        {
          name: "UnitTest",
        }
      );
    });

    it(`test ${label} end backend request with only message error`, function () {
      const client = new HttpClient();
      return client.endBackendRequestWithError(
        createBackend(),
        { url: "testing" },
        {
          message: "unit test error",
        }
      );
    });

    it(`test ${label} end backend request with no name or message error`, function () {
      const client = new HttpClient();
      return client.endBackendRequestWithError(
        createBackend(),
        { url: "testing" },
        {}
      );
    });

    it(`test ${label} accessors`, function () {
      const client = new HttpClient();
      assert.deepStrictEqual(client.getGlobalOptions(), {});
      client.setGlobalOptions({ hello: "world" });
      assert.deepStrictEqual(client.getGlobalOptions(), { hello: "world" });
    });

    it(`test ${label} get client response`, async function () {
      registerSuccessResponse();
      const client = new HttpClient();
      const config = getOptions();
      const backend = createBackend();
      const response = await backend.submitRequest(config);
      const clientResponse = client.getClientResponse(
        backend,
        config,
        response
      );
      assert.ok(clientResponse.cloudClient.requestTime !== undefined);
    });

    it(`test ${label} get client response with error`, async function () {
      registerSuccessResponse();
      const client = new HttpClient();
      const config = getOptions();
      const backend = createBackend();
      const response = await backend.submitRequest(config);
      assert.throws(
        () => {
          client.getClientResponse(
            backend,
            config,
            response,
            new Error("there was a problem")
          );
        },
        (error) => {
          assert.deepEqual(error.cloudClient.error, {
            message: "there was a problem",
            name: "Error",
          });
          assert.deepStrictEqual(error.cloudClient.options, {
            headers: {
              "x-request-id": "testing",
            },
            cloudClient: {
              retry: {
                delay: 10,
              },
              retries: 0,
              retryWait: 0,
              retryResponses: [],
            },
            url: "http://mockunittestingurl.com",
          });
          return true;
        }
      );
    });

    it(`test ${label} get client error`, function () {
      const client = new HttpClient();
      const config = getOptions({
        cloudClient: {
          eventuallyConsistentDelete: true,
        },
      });
      assert.throws(
        () => {
          client.getClientError(
            createBackend(),
            config,
            new Error("there was a problem")
          );
        },
        (error) => {
          assert.deepStrictEqual(error.cloudClient, {
            options: {
              headers: {
                "x-request-id": "testing",
              },
              url: "http://mockunittestingurl.com",
              cloudClient: {
                eventuallyConsistentDelete: true,
                retry: {
                  delay: 10,
                },
                retries: 0,
                retryWait: 0,
                retryResponses: [],
              },
            },
            error: {
              name: "Error",
              message: "there was a problem",
            },
            requestTime: 0,
          });
          return true;
        }
      );
    });

    it(`test ${label} get retry options on success`, async function () {
      registerSuccessResponse();
      const client = new HttpClient();
      const options = getOptions();
      const backend = createBackend();
      const response = await backend.submitRequest(options);
      const retry = await client.getRetryOptionsFromResponse(
        backend,
        options,
        response
      );
      assert.ok(!retry);
      assert.ok(nock.isDone());
    });

    /**
     * @private
     */
    async function verifyRetry(
      client,
      options,
      expectedRetries,
      expectedRetryWait
    ) {
      const backend = createBackend();
      let response;
      let error;
      try {
        response = await backend.submitRequest(options);
      } catch (e) {
        error = e;
        response = backend.getErrorResponse(new HttpOptions(options), error);
      }
      const retry = await client.getRetryOptionsFromResponse(
        backend,
        options,
        response,
        error
      );

      const { url, headers = {}, cloudClient = {} } = retry;
      assert.strictEqual(url, HOST);
      assert.strictEqual(headers.cookie, undefined);

      const { retries, retryWait, retryResponses = [] } = cloudClient;
      assert.strictEqual(retries, expectedRetries);
      assert.strictEqual(retryWait, expectedRetryWait);
      assert.strictEqual(retryResponses.length, expectedRetries);

      return retry;
    }

    it(`test ${label} get retry options on failure response`, async function () {
      registerRetryResponseStatusCode();
      registerRetryResponseNetworkFailure();
      const client = new HttpClient();
      const options = getOptions();
      const retryOptions = await verifyRetry(client, options, 1, 10);
      await verifyRetry(client, retryOptions, 2, 30);
      assert.ok(nock.isDone());
    });

    /**
     * @private
     */
    async function getCookies(client, url) {
      const options = getOptions({ url });
      const backend = createBackend();
      const backendOptions = await client.beginBackendRequest(backend, options);
      const response = await backend.submitRequest(backendOptions);
      await client.endBackendRequestWithResponse(
        backend,
        backendOptions,
        response
      );
      return getTextBody(response);
    }

    /**
     * @private
     */
    async function runSetCookieTest(setCookieValue, options) {
      const { hostname } = URL.parse(HOST);
      registerSuccessResponse({
        response: {
          headers: {
            "set-cookie": [setCookieValue],
          },
        },
      });

      // set cookie with first request
      const client = new HttpClient();
      const firstOptions = getOptions();
      const backend = createBackend();
      const response = await backend.submitRequest(firstOptions);
      await client.endBackendRequestWithResponse(
        backend,
        firstOptions,
        response
      );

      const nocks = [
        HOST,
        `https://${hostname}`,
        "http://totallydifferentdomain.com",
        "https://totallydifferentdomain.com",
      ];

      // all requests to all domains in the array above will respond with a 200
      // status code, and the request's cookie header as the body
      nocks.forEach((nockDomain) => {
        nock(nockDomain)
          .get(() => true)
          .twice()
          .reply(function () {
            let cookie = this.req.headers.cookie;
            if (Array.isArray(this.req.headers.cookie)) {
              cookie = cookie[0];
            }
            return [200, cookie];
          });
      });

      const { insecureDomain, secureDomain, insecurePath, securePath } =
        options;

      // the following URLs may have the set-cookie in the request, depending on the
      // set-cookie configuration
      let cookies = await getCookies(client, HOST);
      assert.ok(cookies || !insecureDomain);
      cookies = await getCookies(client, `https://${hostname}`);
      assert.ok(cookies || !secureDomain);
      cookies = await getCookies(client, `${HOST}/cookiepath`);
      assert.ok(cookies || !insecurePath);
      cookies = await getCookies(client, `https://${hostname}/cookiepath`);
      assert.ok(cookies || !securePath);

      // these URLs are to a different domain, and should never have the cookie
      cookies = await getCookies(client, "http://totallydifferentdomain.com");
      assert.ok(!cookies);
      cookies = await getCookies(client, "https://totallydifferentdomain.com");
      assert.ok(!cookies);
      cookies = await getCookies(
        client,
        "http://totallydifferentdomain.com/cookiepath"
      );
      assert.ok(!cookies);
      cookies = await getCookies(
        client,
        "https://totallydifferentdomain.com/cookiepath"
      );
      assert.ok(!cookies);
    }

    it(`test ${label} set cookie with all attributes`, () => {
      const { hostname } = URL.parse(HOST);
      const expires = new Date(new Date().getTime() + 10000).toISOString();

      // this test uses a Set-Cookie header that specifies the cookie should only be used for SSL requests
      // to the HOST's domain, when requesting anything containing /cookiepath
      return runSetCookieTest(
        `mycookie=value1; Expires=${expires}; Max-Age=60; Domain=${hostname}; Path=/cookiepath; Secure; HttpOnly; SameSite=Strict`,
        {
          insecureDomain: false,
          secureDomain: false,
          insecurePath: false,
          securePath: true,
        }
      );
    });

    it(`test ${label} set cookie with basic attributes`, () => {
      // this test uses a Set-Cookie header that specifies the cookie will be used for all
      // requests to HOST's domain
      return runSetCookieTest("mycookie=value1", {
        insecureDomain: true,
        secureDomain: true,
        insecurePath: true,
        securePath: true,
      });
    });

    it(`test ${label} set cookie with secure attribute`, () => {
      // this test uses a Set-Cookie header that specifies the cookie will be used for all SSL
      // requests to HOST's domain
      return runSetCookieTest("mycookie=value1; Secure", {
        insecureDomain: false,
        secureDomain: true,
        insecurePath: false,
        securePath: true,
      });
    });

    it(`test ${label} set cookie with expired cookie`, () => {
      // this test uses a Set-Cookie header that specifies an expired cookie,
      // which shouldn't be used at all
      return runSetCookieTest("mycookie=value1; Max-Age=0", {
        insecureDomain: false,
        secureDomain: false,
        insecurePath: false,
        securePath: false,
      });
    });
  });
};
