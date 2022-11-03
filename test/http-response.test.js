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

const HttpOptions = importFile("http-options");
const HttpResponse = importFile("http-response");

describe("HTTP response tests", function () {
  /**
   * @private
   */
  function createResponse(rawResponse) {
    return new HttpResponse(rawResponse);
  }

  it("test accessors", function () {
    const response = createResponse({
      status: 302,
      statusText: "Not Modified",
      headers: {
        header1: "value1",
      },
      data: {
        hello: "world!",
      },
    });
    assert.strictEqual(response.getStatus(), 302);
    assert.strictEqual(response.getStatusText(), "Not Modified");
    assert.deepStrictEqual(response.getHeaders(), { header1: "value1" });
  });

  it("test extend raw response", async function () {
    const rawOptions = {
      url: "http://www.reallyfakeunittesturl.com",
      headers: {
        "content-length": 1234,
      },
      cloudClient: {
        retries: 1,
        retryWait: 1000,
      },
    };

    const httpResponse = new HttpResponse({
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "application/json",
      },
      data: { hello: "world!" },
      json: async () => "hello!",
    });

    let response = httpResponse.getRawResponse();
    assert.ok(response.json);
    assert.ok(!response.toJSON);
    assert.ok(!response.retries);
    assert.strictEqual(await response.json(), "hello!");

    response = httpResponse.toClientResponse({
      options: new HttpOptions(rawOptions).toJSON(),
    });
    const { cloudClient } = response;
    assert.ok(cloudClient);
    const { options } = cloudClient;
    assert.ok(options);
    const { cloudClient: optionsCloudClient } = options;
    assert.ok(optionsCloudClient);
    assert.strictEqual(optionsCloudClient.retries, 1);
    assert.strictEqual(optionsCloudClient.retryWait, 1000);

    const simpleJson = httpResponse.toJSON();
    assert.ok(simpleJson);
    assert.ok(!simpleJson.options);
    assert.strictEqual(simpleJson.status, 200);
    assert.strictEqual(simpleJson.statusText, "OK");
    assert.strictEqual(simpleJson.headers["content-type"], "application/json");
  });

  it("test http fetch response to json", function () {
    const httpResponse = new HttpResponse({
      status: 200,
      statusText: "OK",
      headers: {
        keys: () => {
          return ["content-type"];
        },
        get: (headerName) => {
          assert.strictEqual(headerName, "content-type");
          return "application/json";
        },
      },
    });
    const response = httpResponse.toClientResponse({
      options: new HttpOptions().toJSON(),
    });
    const { cloudClient } = response;
    assert.ok(cloudClient);
    const { options } = cloudClient;
    assert.ok(options);
    const { cloudClient: optionsCloudClient } = options;
    assert.deepStrictEqual(optionsCloudClient, {
      retries: 0,
      retryWait: 0,
      retryResponses: [],
    });

    const json = httpResponse.toJSON();
    assert.strictEqual(json.status, 200);
    assert.strictEqual(json.statusText, "OK");
  });

  it("test to client response error", function () {
    const httpResponse = new HttpResponse(
      {
        status: 404,
      },
      new Error("unit test error")
    );

    assert.throws(
      () => {
        httpResponse.toClientResponse();
      },
      {
        message: "unit test error",
      }
    );
  });

  it("test error json", function () {
    const options = new HttpOptions();
    const response = {};
    const errorInfo = {
      name: "TestError",
      message: "This is a message",
      hello: "world",
    };
    let httpResponse = new HttpResponse(response, errorInfo);
    assert.deepStrictEqual(httpResponse.toJSON().error, {
      name: "TestError",
      message: "This is a message",
    });
    delete errorInfo.name;

    httpResponse = new HttpResponse(response, errorInfo);
    assert.deepStrictEqual(httpResponse.toJSON().error, {
      message: "This is a message",
    });
    delete errorInfo.message;

    httpResponse = new HttpResponse(response, errorInfo);
    assert.deepStrictEqual(httpResponse.toJSON().error, {
      hello: "world",
    });
    errorInfo.name = "TestError";

    httpResponse = new HttpResponse(response, errorInfo);
    assert.deepStrictEqual(httpResponse.toJSON().error, {
      name: "TestError",
    });
  });

  it("test to client response with retry info", function () {
    const options = new HttpOptions();
    const retriedResponse = new HttpResponse({
      status: 202,
      statusText: "Check Back Later",
      headers: {
        header1: "value1",
      },
    });
    options.setStartTime(1234);
    options.setEndTime(1235);
    options.addRetry(retriedResponse, 10);
    const retriedError = new HttpResponse({}, new Error("unit test error"));
    options.setStartTime(1236);
    options.setEndTime(1237);
    options.addRetry(retriedError, 20);
    const retriedResponseError = new HttpResponse(
      {
        status: 404,
        statusText: "Not Found",
      },
      new Error("not found error")
    );
    options.setStartTime(1238);
    options.setEndTime(1239);
    options.addRetry(retriedResponseError, 40);

    const finalResponse = new HttpResponse({
      status: 200,
      statusText: "OK",
    });
    const optionsJson = options.toJSON();
    const clientResponse = finalResponse.toClientResponse({
      options: optionsJson,
    });
    const { cloudClient = {} } = clientResponse;
    assert.deepStrictEqual(cloudClient.options, optionsJson);
    assert.strictEqual(cloudClient.status, 200);
    assert.strictEqual(cloudClient.statusText, "OK");

    const { cloudClient: optionsCloudClient = {} } = cloudClient.options;
    assert.strictEqual(3, optionsCloudClient.retries);
    assert.strictEqual(70, optionsCloudClient.retryWait);

    const { retryResponses = [] } = optionsCloudClient;
    assert.strictEqual(retryResponses.length, 3);
    assert.deepStrictEqual(retryResponses[0], {
      headers: {
        header1: "value1",
      },
      status: 202,
      statusText: "Check Back Later",
    });
    assert.deepStrictEqual(retryResponses[1], {
      error: {
        name: "Error",
        message: "unit test error",
      },
    });
    assert.deepStrictEqual(retryResponses[2], {
      status: 404,
      statusText: "Not Found",
      error: {
        name: "Error",
        message: "not found error",
      },
    });
  });
});
