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

const { importFile } = require("../test-utils");

const AxiosHttpOptions = importFile("http-backends/axios-http-options");

describe("axios http options tests", function () {
  it("test to json", function () {
    let options = new AxiosHttpOptions({});
    let json = options.toJSON();
    assert.ok(json.headers["x-request-id"]);
    assert.strictEqual(Object.keys(json).length, 2);
    assert.strictEqual(Object.keys(json.headers).length, 1);

    options = new AxiosHttpOptions({
      env: {},
      transformRequest: {},
      transformResponse: {},
      funcProp: () => {},
      test: "property",
    });
    json = options.toJSON();
    assert.strictEqual(json.test, "property");
    assert.strictEqual(Object.keys(json).length, 3);
    assert.ok(json.headers["x-request-id"]);
  });
});
