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
const { Cookie } = require("tough-cookie");

const { importFile } = require("./test-utils");

const HttpOptions = importFile("http-options");
const HttpResponse = importFile("http-response");
const { parseCookieHeader, buildCookieLookup } = importFile("http-utils");

describe("HTTP options tests", function () {
  it("test option accessors", function () {
    let options = new HttpOptions();
    assert.strictEqual(options.getMaxRetries(), 3);
    assert.strictEqual(options.getRetryDelay(), 1000);
    assert.strictEqual(options.getRetries(), 0);
    assert.strictEqual(options.getRetryWait(), 0);
    assert.strictEqual(options.getRetryResponses().length, 0);
    assert.strictEqual(options.getRequestTime(), 0);
    assert.strictEqual(options.getTimeout(), 60000);
    assert.strictEqual("GET", options.getMethod());

    const rawOptions = {
      cloudClient: {
        retry: {
          count: 2,
          delay: 10,
        },
        retries: 1,
        retryWait: 200,
        timeout: 3000,
      },
      url: "http://mytestunittesturl/path",
      method: "POST",
      headers: {
        header1: "value1",
      },
    };
    options = new HttpOptions(rawOptions);
    assert.strictEqual(options.getMaxRetries(), 2);
    assert.strictEqual(options.getRetryDelay(), 10);
    assert.strictEqual(options.getRetries(), 1);
    assert.strictEqual(options.getRetryWait(), 200);
    assert.strictEqual(options.getTimeout(), 3000);
    assert.strictEqual(options.getUrl(), "http://mytestunittesturl/path");
    assert.strictEqual("POST", options.getMethod());

    options.setStartTime(12345);
    assert.strictEqual(options.getRequestTime(), 0);
    options.setEndTime(12346);
    assert.strictEqual(options.getRequestTime(), 1);
    options.setStartTime(4321);
    assert.strictEqual(options.getRequestTime(), 0);
    options.setStartTime(0);
    options.setEndTime(4321);
    assert.strictEqual(options.getRequestTime(), 0);

    options.addRetry(new HttpResponse({ status: 200 }), 150);
    assert.strictEqual(options.getRetries(), 2);
    assert.deepStrictEqual(options.getRetryResponses(), [{ status: 200 }]);
    assert.strictEqual(options.getRetryWait(), 350);

    options.logDebug("test debug message");
    options.logInfo("test info message");
    options.logWarn("test warn message");
    options.logError("test error message");
  });

  /**
   * @private
   */
  function verifyLogMessage(expectedMessage, actualMessage) {
    const messageStr = String(actualMessage);
    const dateEnd = messageStr.indexOf("]");
    const datePrefix = messageStr.substr(1, dateEnd - 1);
    const date = new Date(datePrefix);
    assert.ok(date);
    assert.strictEqual(messageStr.substr(dateEnd + 1), expectedMessage);
  }

  it("test custom logger", function () {
    const requestId = "test-request";
    const method = "POST";
    const url = "http://testinglogmessagewithurl";

    let debug = "";
    let info = "";
    let warn = "";
    let error = "";
    const options = new HttpOptions(
      {
        headers: { "x-request-id": "test-request" },
        method: "POST",
        url: "http://testinglogmessagewithurl",
      },
      {
        log: {
          debug: (...theArguments) => (debug = theArguments.join(" ")),
          info: (...theArguments) => (info = theArguments.join(" ")),
          warn: (...theArguments) => (warn = theArguments.join(" ")),
          error: (...theArguments) => (error = theArguments.join(" ")),
        },
      }
    );

    options.logDebug("debug test", 0);
    verifyLogMessage(`[${requestId}] [${method}] [${url}] debug test 0`, debug);
    options.logInfo("info test", 0);
    verifyLogMessage(`[${requestId}] [${method}] [${url}] info test 0`, info);
    options.logWarn("warn test", 0);
    verifyLogMessage(`[${requestId}] [${method}] [${url}] warn test 0`, warn);
    options.logError("error test", 0);
    verifyLogMessage(`[${requestId}] [${method}] [${url}] error test 0`, error);
  });

  it("test default retry strategies", async function () {
    const options = new HttpOptions();
    const retryOnError = options.getRetryStrategies();
    assert.ok(retryOnError);

    let retry500 = false;
    let retryNetwork = false;
    const retryOptions = {
      attempts: 1,
      maxAttempts: 2,
      response: { status: 500 },
    };
    for (let i = 0; i < retryOnError.length; i++) {
      const strategy = retryOnError[i];
      retryOptions.response.status = 500;
      const curr500 = await strategy.shouldRetry(retryOptions);
      if (curr500) {
        assert(!retry500);
        retry500 = true;
      }
      retryOptions.response.status = 200;
      assert(!(await strategy.shouldRetry(retryOptions)));
      retryOptions.response = {};
      const currNetwork = await strategy.shouldRetry(retryOptions);
      if (currNetwork) {
        assert(!retryNetwork);
        retryNetwork = true;
      }
    }
    assert(retry500);
    assert(retryNetwork);
  });

  it("test custom retry strategy", async function () {
    const options = new HttpOptions({
      cloudClient: {
        retry: {
          strategies: [
            {
              shouldRetry: (retryInfo) => retryInfo.attempts === 1,
              getDelayMultiple: () => 5,
              getMaxRetries: () => 10,
            },
          ],
        },
      },
    });

    const retryOnError = options.getRetryStrategies();
    assert.strictEqual(retryOnError.length, 3);
    const retryOptions = {
      attempts: 1,
      maxAttempts: 2,
      response: { status: 500 },
    };
    assert(await retryOnError[2].shouldRetry(retryOptions));
    assert.strictEqual(await retryOnError[2].getRetryDelayMultiple(), 5);
    assert.strictEqual(await retryOnError[2].getMaxRetryCount(), 10);
    retryOptions.attempts = 2;
    assert(!(await retryOnError[2].shouldRetry(retryOptions)));
    assert.deepStrictEqual(options.toJSON().cloudClient, {
      retries: 0,
      retryResponses: [],
      retryWait: 0,
      retry: {},
    });
  });

  it("test built-in strategies", async function () {
    const options = new HttpOptions({
      cloudClient: {
        eventuallyConsistentCreate: true,
        eventuallyConsistentUpdate: true,
        eventuallyConsistentDelete: true,
      },
    });
    assert.strictEqual(options.getRetryStrategies().length, 5);
  });

  it("test to request config", async function () {
    let options = new HttpOptions({
      hello: "world!",
    });
    let config = await options.toRequestConfig();
    assert.ok(config);
    assert.strictEqual("world!", config.hello);

    options = new HttpOptions({
      timeout: 30,
    });
    config = await options.toRequestConfig();
    assert.strictEqual(30, config.timeout);

    options = new HttpOptions({
      hello: "world!",
      cloudClient: {
        log: {},
      },
      url: "http://localhost",
    });
    config = await options.toRequestConfig();
    assert.ok(config);
    assert.strictEqual(config.hello, "world!");
    assert.strictEqual(config.log, undefined);

    options = new HttpOptions({});
    config = await options.toRequestConfig();
    assert.ok(config);
    assert.strictEqual(config.url, undefined);
  });

  it("test options to json", function () {
    let options = new HttpOptions({
      hello: "world!",
      someFunc: () => false,
    });

    let json = options.toJSON();
    assert.ok(json);
    assert.strictEqual("world!", json.hello);
    assert.strictEqual(undefined, json.someFunc);

    const jsonStr = options.toString();
    json = JSON.parse(jsonStr);
    assert.strictEqual("world!", json.hello);
    assert.strictEqual(undefined, json.someFunc);

    options = new HttpOptions({
      hello: "world!",
      cloudClient: {
        retry: {
          count: 2,
        },
      },
    });
    json = options.toJSON();
    assert.deepStrictEqual(json.hello, "world!");
    assert.deepStrictEqual(json.cloudClient, {
      retries: 0,
      retry: {
        count: 2,
      },
      retryResponses: [],
      retryWait: 0,
    });

    options = new HttpOptions({
      cloudClient: {
        retry: {
          strategies: [
            {
              shouldRetry: () => false,
              getDelayMultiple: () => 1,
              getMaxRetries: () => 1,
            },
          ],
        },
      },
    });
    json = options.toJSON();
    assert.ok(!json.cloudClient.retry.strategies);
  });

  /**
   * @private
   */
  async function getCookies(cookieHeader = "", options = {}) {
    const {
      cookieHeaderName = "cookie",
      cookieHost = "",
      headers = {},
    } = options;
    const rawOptions = {
      url: "http://testcookiehostthatdoesnotexist.com/testpath",
    };
    if (cookieHeader) {
      rawOptions.headers = headers;
      rawOptions.headers[cookieHeaderName] = cookieHeader;
    }
    const httpOptions = new HttpOptions(rawOptions);
    const cookieJar = await httpOptions.getCookieJar();
    return cookieJar.getCookies(cookieHost || httpOptions.getUrl());
  }

  /**
   * @private
   */
  function getCookieValue(cookies, cookieName) {
    const lookup = buildCookieLookup(cookies);

    if (lookup[cookieName]) {
      return lookup[cookieName].value;
    }

    return false;
  }

  it("test get no headers or cookies", async function () {
    const cookies = await getCookies();
    assert.strictEqual(cookies.length, 0);
  });

  it("test get no cookies headers", async function () {
    const cookies = await getCookies("", {
      headers: { hello: "world" },
    });
    assert.strictEqual(cookies.length, 0);
  });

  it("test get single cookie", async function () {
    const cookies = await getCookies("cookie1=value1");
    assert.strictEqual(cookies.length, 1);

    assert.strictEqual(getCookieValue(cookies, "cookie1"), "value1");
  });

  it("test get multiple cookies", async function () {
    const cookies = await getCookies("cookie1=value1; cookie2=value2", {
      cookieHeaderName: "Cookie",
    });
    assert.strictEqual(cookies.length, 2);
    assert.strictEqual(getCookieValue(cookies, "cookie1"), "value1");
    assert.strictEqual(getCookieValue(cookies, "cookie2"), "value2");
  });

  it("test get wrong host cookies", async function () {
    const cookies = await getCookies("cookie1=value1", {
      cookieHeaderName: "COOKIE",
      cookieHost: "http://verywronghostforthistest",
    });
    assert.strictEqual(cookies.length, 0);
  });

  it("test no options header add cookies", async function () {
    const options = new HttpOptions({
      url: "http://mytesturlforcookies",
    });
    options.setAdditionalCookies([
      Cookie.parse("cookie1=value1"),
      Cookie.parse("cookie2=value2"),
    ]);
    const config = await options.toRequestConfig();
    const { headers = {} } = config;
    const { cookie = "" } = headers;
    const cookieStr = String(cookie);
    assert.ok(cookieStr.includes("cookie1=value1"));
    assert.ok(cookieStr.includes("cookie2=value2"));
  });

  it("test with options header and add cookies", async function () {
    const options = new HttpOptions({
      url: "http://mytesturlforcookies",
      headers: {
        cookie: "cookie1=value1; cookie2=value2",
      },
    });
    options.setAdditionalCookies([
      Cookie.parse("cookie1=modified"),
      Cookie.parse("cookie3=value3"),
    ]);
    const config = await options.toRequestConfig();
    const { headers = {} } = config;
    const { cookie = "" } = headers;
    const cookieStr = String(cookie);
    assert.ok(cookieStr.includes("cookie1=value1"));
    assert.ok(cookieStr.includes("cookie2=value2"));
    assert.ok(cookieStr.includes("cookie3=value3"));
  });

  it("test handling cookies to request config", async function () {
    const httpOptions = new HttpOptions({
      url: "http://somereallyfakeunittestdomain",
      headers: {
        cookie: "cookie1=value1; cookie2=value2",
      },
    });
    httpOptions.setAdditionalCookies([Cookie.parse("cookie3=value3")]);

    const options = await httpOptions.toRequestConfig();
    const cookies = parseCookieHeader(options.headers.cookie);
    assert.strictEqual(getCookieValue(cookies, "cookie1"), "value1");
    assert.strictEqual(getCookieValue(cookies, "cookie2"), "value2");
    assert.strictEqual(getCookieValue(cookies, "cookie3"), "value3");
  });

  it("test merge client options empty", function () {
    const options = new HttpOptions();
    options.mergeClientOptions({});
    assert.deepStrictEqual(options.getClientOptions(), {});
  });

  it("test merge client options with retry", function () {
    const options = new HttpOptions({
      cloudClient: {
        timeout: 1000,
        eventuallyConsistentCreate: true,
        retry: {
          count: 3,
          delayMultiple: 4,
        },
      },
    });
    options.mergeClientOptions({
      timeout: 2000,
      eventuallyConsistentDelete: true,
      retry: {
        count: 4,
        delay: 200,
      },
    });
    assert.deepStrictEqual(options.getClientOptions(), {
      timeout: 1000,
      eventuallyConsistentCreate: true,
      eventuallyConsistentDelete: true,
      retry: {
        count: 3,
        delay: 200,
        delayMultiple: 4,
      },
    });
  });

  it("test merge client options with retry strategies", function () {
    const options = new HttpOptions({
      cloudClient: {
        retry: {
          strategies: [{ strategy: 1 }],
        },
      },
    });
    options.mergeClientOptions({
      retry: {
        strategies: [{ strategy: 2 }],
      },
    });
    assert.deepStrictEqual(options.getClientOptions(), {
      retry: {
        strategies: [{ strategy: 1 }, { strategy: 2 }],
      },
    });
  });

  it("test merge client options with only merge retry strategies", function () {
    const options = new HttpOptions({
      cloudClient: {
        timeout: 1000,
      },
    });
    options.mergeClientOptions({
      retry: {
        count: 4,
        strategies: [{ strategy: 2 }],
      },
    });
    assert.deepStrictEqual(options.getClientOptions(), {
      timeout: 1000,
      retry: {
        count: 4,
        strategies: [{ strategy: 2 }],
      },
    });
  });

  it("test merge client options with only options retry strategies", function () {
    const options = new HttpOptions({
      cloudClient: {
        retry: {
          count: 4,
          strategies: [{ strategy: 1 }],
        },
      },
    });
    options.mergeClientOptions({
      timeout: 2000,
    });
    assert.deepStrictEqual(options.getClientOptions(), {
      timeout: 2000,
      retry: {
        count: 4,
        strategies: [{ strategy: 1 }],
      },
    });
  });

  it("test set request options", function () {
    const options = new HttpOptions({});
    options.setRequestOptions({ hello: "world!" });
    assert.deepStrictEqual(options.getOptions(), { hello: "world!" });
    options.setRequestOptions({ hello: "goodbye!", foo: "bar" });
    assert.deepStrictEqual(options.getOptions(), {
      hello: "goodbye!",
      foo: "bar",
    });
  });
});
