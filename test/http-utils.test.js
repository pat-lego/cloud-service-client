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

const { importFile } = require("./test-utils");

const HttpUtils = importFile("http-utils");

describe("HTTP utils tests", function () {
  it("test object to json", function () {
    const toConvert = {
      falsyValue: false,
      jsonValue: {
        toJSON: () => {
          return { hello: "world!" };
        },
      },
      stringValue: "hello",
      someFunction: () => {},
      undefinedValue: undefined,
    };
    assert.deepStrictEqual(HttpUtils.objectToJson(toConvert), {
      falsyValue: false,
      jsonValue: { hello: "world!" },
      stringValue: "hello",
    });
  });

  it("test parse fetch set-cookie header", function () {
    let cookieValue = "";
    let converted = HttpUtils.parseMultipleFetchSetCookieHeaders(cookieValue);
    assert.strictEqual(converted.length, 0);

    cookieValue = "cookie=value";
    converted = HttpUtils.parseMultipleFetchSetCookieHeaders(cookieValue);
    assert.strictEqual(converted.length, 1);
    assert.strictEqual(converted[0], cookieValue);

    cookieValue = "cookie=value; Expires=Wed, 12345";
    converted = HttpUtils.parseMultipleFetchSetCookieHeaders(cookieValue);
    assert.strictEqual(converted.length, 1);
    assert.strictEqual(converted[0], cookieValue);

    cookieValue = "cookie=value; Expires=Wed, 12345, cookie2=value2";
    converted = HttpUtils.parseMultipleFetchSetCookieHeaders(cookieValue);
    assert.strictEqual(converted.length, 2);
    assert.strictEqual(converted[0], "cookie=value; Expires=Wed, 12345");
    assert.strictEqual(converted[1], "cookie2=value2");

    cookieValue =
      "cookie=value, cookie2=value2; Expires=Wed, 12345; Expires2=Wed, 6789";
    converted = HttpUtils.parseMultipleFetchSetCookieHeaders(cookieValue);
    assert.strictEqual(converted.length, 2);
    assert.strictEqual(converted[0], "cookie=value");
    assert.strictEqual(
      converted[1],
      "cookie2=value2; Expires=Wed, 12345; Expires2=Wed, 6789"
    );

    cookieValue = "cookie=value, cookie2=value2";
    converted = HttpUtils.parseMultipleFetchSetCookieHeaders(cookieValue);
    assert.strictEqual(converted.length, 2);
    assert.strictEqual(converted[0], "cookie=value");
    assert.strictEqual(converted[1], "cookie2=value2");
  });

  it("test redact headers", () => {
    const redacted = HttpUtils.redactHeaders({
      Authorization: "capitalized",
      authorization: "lower-case",
      Cookie: "capital cookie",
      cookie: "lower cookie",
      "x-request-id": "id",
    });
    assert.deepStrictEqual(redacted, {
      Authorization: "<redacted>",
      authorization: "<redacted>",
      Cookie: "<redacted>",
      cookie: "<redacted>",
      "x-request-id": "id",
    });
  });

  it("test parse cookie header", () => {
    let cookies = HttpUtils.parseCookieHeader("cookie1=value1");
    assert.strictEqual(cookies.length, 1);
    assert.strictEqual(cookies[0].key, "cookie1");
    assert.strictEqual(cookies[0].value, "value1");

    cookies = HttpUtils.parseCookieHeader("cookie1=value1; cookie2=value2");
    const lookup = HttpUtils.buildCookieLookup(cookies);
    assert.strictEqual(cookies.length, 2);
    assert.strictEqual(lookup["cookie1"].value, "value1");
    assert.strictEqual(lookup["cookie2"].value, "value2");
  });
});
