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

const webserver = require("./local-webserver");
const AxiosVerifier = require("./axios-verifier");
const FetchVerifier = require("./fetch-verifier");

const clientExports = require("../");

/*
These tests verify the contract of the HTTP client. They also provide several practical
examples of how to use the client. The relevant example code will be flagged with *EXAMPLE*
*/

[new AxiosVerifier(), new FetchVerifier()].forEach((verifier) => {
  const verifierName = verifier.constructor.name;
  const client = verifier.getExport(clientExports);
  describe(`${verifierName}: All Methods Tests`, function () {
    this.timeout(10 * 1000);
    let HOST = "";

    before(async () => {
      HOST = await webserver();
    });

    beforeEach(() => {
      webserver.reset();
      return clientExports.clearCookies();
    });

    after(() => {
      webserver.close();
    });

    it(`${verifierName}: all method smoke test`, async () => {
      const URL = `${HOST}/testput`;
      /* *EXAMPLE* PUT request in the style of axios */
      let response = await client.put(
        URL,
        {
          hello: "world!",
        },
        { headers: { "Content-Type": "application/json" } }
      );
      verifier.verifySuccess(response, 201);

      /* *EXAMPLE* GET request in the style of axios */
      response = await client.get(URL);
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world!" });

      /* *EXAMPLE* HEAD request in the style of axios */
      response = await client.head(URL);
      verifier.verifySuccess(response);
      verifier.verifyEmptyBody(response);

      /* *EXAMPLE* POST request in the style of axios */
      response = await client.post(URL, {
        foo: "bar",
      });
      verifier.verifySuccess(response);

      /* *EXAMPLE* GET request in the style of fetch or axios (no options) */
      response = await client(URL);
      verifier.verifySuccess(response);
      verifier.verifyBody(response, { foo: "bar" });

      /* *EXAMPLE* PATCH request in the style of axios */
      response = await client.patch(URL, {
        goodbye: "world",
      });
      verifier.verifySuccess(response);

      /* *EXAMPLE* OPTIONS request in the style of axios */
      response = await client.options(URL);
      verifier.verifySuccess(response);
      verifier.verifyBody(response, { goodbye: "world" });

      /* *EXAMPLE* DELETE request in the style of axios */
      response = await client.delete(URL);
      const requestCount = webserver.getRequests().length;
      await verifier.verifyFailure(() => {
        return client.get(URL);
      }, 404);
      assert.strictEqual(webserver.getRequests().length, requestCount + 1);

      /* *EXAMPLE* PUT request in the style of fetch (with options) */
      response = await client(URL, {
        method: "put",
        data: {
          hello: "world!",
        },
      });
      verifier.verifySuccess(response, 201);
      response = await client(URL);
      verifier.verifySuccess(response);
      verifier.verifyBody(response, { hello: "world!" });
    });

    it(`${verifierName}: test failure retries`, async function () {
      webserver.addStatusCodes([500, 500, 500, 500]);
      await verifier.verifyFailure(
        () => {
          /* *EXAMPLE* GET request in the style of axios (options object) */
          return client({
            url: HOST,
            cloudClient: {
              retry: {
                count: 4,
              },
            },
          });
        },
        500,
        {
          retries: 3,
          retryWait: 7000,
        }
      );
      assert.strictEqual(webserver.getRequests().length, 4);
      assert.strictEqual("/", webserver.getRequests()[0].url);
      assert.strictEqual("/", webserver.getRequests()[1].url);
      assert.strictEqual("/", webserver.getRequests()[2].url);
      assert.strictEqual("/", webserver.getRequests()[3].url);

      const timestamp1 = webserver.getRequests()[0].timestamp;
      const timestamp2 = webserver.getRequests()[1].timestamp;
      const timestamp3 = webserver.getRequests()[2].timestamp;
      const timestamp4 = webserver.getRequests()[3].timestamp;
      assert.ok(
        timestamp2 - timestamp1 >= 1000 && timestamp2 - timestamp1 < 2000
      );
      assert.ok(
        timestamp3 - timestamp2 >= 2000 && timestamp3 - timestamp2 < 3000
      );
      assert.ok(
        timestamp4 - timestamp3 >= 4000 && timestamp4 - timestamp3 < 5000
      );
    });

    it(`${verifierName}: test retry recovery`, async () => {
      webserver.addStatusCodes([500]);
      const testUrl = `${HOST}/test-recovery`;
      /* *EXAMPLE* PUT request in the style of axios (options object) */
      let response = await client({
        method: "put",
        url: testUrl,
        data: { hello: "world" },
      });
      verifier.verifySuccess(response, 201);

      verifier.verifyOptionsClientProperties(response, {
        retries: 1,
        retryWait: 1000,
      });
      assert.strictEqual(webserver.getRequests().length, 2);

      const timestamp1 = webserver.getRequests()[0].timestamp;
      const timestamp2 = webserver.getRequests()[1].timestamp;
      assert.ok(
        timestamp2 - timestamp1 >= 1000 && timestamp2 - timestamp1 < 2000
      );
    });

    it(`${verifierName}: test set-cookie`, async () => {
      const cookieClient = verifier.getExport(clientExports, {
        handleCookies: true,
      });
      const responseBody = JSON.stringify({ hello: "world" });
      const setCookieResponse = {
        headers: {
          "Set-Cookie": "foo=bar; Path=/; HttpOnly",
          "Content-Type": "application/json",
          "Content-Length": responseBody.length,
          Date: new Date().toUTCString(),
        },
        body: responseBody,
      };
      const noCookieResponse = {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": responseBody.length,
          Date: new Date().toUTCString(),
        },
        body: responseBody,
      };
      webserver.addResponses([
        setCookieResponse,
        noCookieResponse,
        setCookieResponse,
        noCookieResponse,
      ]);

      let response = await client(HOST, {
        headers: {
          cookie: "cookie1=value1",
        },
      });
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world" });
      assert.ok(!webserver.getRequests()[0].cookies.foo);
      assert.ok(webserver.getRequests()[0].cookies.cookie1);
      assert.strictEqual(webserver.getRequests()[0].cookies.cookie1, "value1");

      /*
      *EXAMPLE* GET request in the style of fetch (options object)
      HTTP client will process Set-Cookie response header from the server
      */
      response = await client(HOST, {
        headers: {
          cookie: "cookie1=value1",
        },
      });
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world" });
      assert.ok(!webserver.getRequests()[1].cookies.foo);
      assert.ok(webserver.getRequests()[1].cookies.cookie1);
      assert.strictEqual(webserver.getRequests()[1].cookies.cookie1, "value1");

      response = await cookieClient(HOST, {
        headers: {
          cookie: "cookie1=value1",
        },
      });
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world" });
      assert.ok(!webserver.getRequests()[2].cookies.foo);
      assert.ok(webserver.getRequests()[2].cookies.cookie1);
      assert.strictEqual(webserver.getRequests()[2].cookies.cookie1, "value1");

      response = await cookieClient(HOST, {
        headers: {
          cookie: "cookie1=value1",
        },
      });
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world" });
      assert.strictEqual(webserver.getRequests()[3].cookies.foo, "bar");
      assert.ok(webserver.getRequests()[3].cookies.cookie1);
      assert.strictEqual(webserver.getRequests()[3].cookies.cookie1, "value1");
    });

    it(`${verifierName}: eventually consistent create`, async () => {
      let response = await client.put(
        HOST,
        {
          hello: "world!",
        },
        { headers: { "Content-Type": "application/json" } }
      );
      verifier.verifySuccess(response, 201);

      webserver.addStatusCodes([404]);
      /*
      *EXAMPLE* GET in the style of axios (options object only)
      Client will perform retries consistent with a new item created in an eventually consistent system
      */
      response = await client({
        url: HOST,
        cloudClient: {
          eventuallyConsistentCreate: true,
        },
      });
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world!" });
      assert.strictEqual(webserver.getRequests().length, 3);
      verifier.verifyOptionsClientProperties(response, {
        retries: 1,
      });
    });

    it(`${verifierName}: never consistent create`, async () => {
      await verifier.verifyFailure(
        () =>
          client({
            url: HOST,
            cloudClient: {
              eventuallyConsistentCreate: true,
            },
          }),
        404,
        {
          retries: 2,
          retryWait: 3000,
        }
      );
      assert.strictEqual(webserver.getRequests().length, 3);
    });

    it(`${verifierName}: eventually consistent update`, async () => {
      let response = await client.put(
        HOST,
        {
          hello: "world!",
        },
        { headers: { "Content-Type": "application/json" } }
      );
      verifier.verifySuccess(response, 201);

      webserver.addStatusCodes([412]);

      /*
      *EXAMPLE* GET in the style of axios (options object only)
      Client will perform retries consistent with an updated item in an eventually consistent system
      */
      response = await client({
        url: HOST,
        cloudClient: {
          eventuallyConsistentUpdate: true,
        },
        headers: {
          "If-Match": "tag-2",
        },
      });
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world!" });
      assert.strictEqual(webserver.getRequests().length, 3);
      verifier.verifyOptionsClientProperties(response, {
        retries: 1,
      });
    });

    it(`${verifierName}: never consistent update`, async () => {
      webserver.addStatusCodes([412, 412, 412]);

      await verifier.verifyFailure(
        () => {
          return client({
            url: HOST,
            cloudClient: {
              eventuallyConsistentUpdate: true,
            },
          });
        },
        412,
        {
          retries: 2,
          retryWait: 3000,
        }
      );
      assert.strictEqual(webserver.getRequests().length, 3);
    });

    it(`${verifierName}: eventually consistent delete`, async () => {
      const deletedBody = JSON.stringify({ hello: "world!" });
      webserver.addResponses([
        {
          headers: {
            Date: new Date().toUTCString(),
            "Content-Type": "application/json",
            "Content-Length": deletedBody.length,
          },
          body: deletedBody,
        },
      ]);
      /*
      *EXAMPLE* GET in the style of axios (options object only)
      Client will perform retries consistent with a deleted item in an eventually consistent system
      */
      await verifier.verifyFailure(
        () => {
          return client({
            url: HOST,
            cloudClient: {
              eventuallyConsistentDelete: true,
            },
          });
        },
        404,
        {
          retries: 1,
          retryWait: 1000,
        }
      );
      assert.strictEqual(webserver.getRequests().length, 2);
    });

    it(`${verifierName}: never consistent delete`, async () => {
      let response = await client.put(
        HOST,
        {
          hello: "world!",
        },
        { headers: { "Content-Type": "application/json" } }
      );
      verifier.verifySuccess(response, 201);

      response = await client({
        url: HOST,
        cloudClient: {
          eventuallyConsistentDelete: true,
        },
      });
      verifier.verifySuccess(response);
      verifier.verifyOptionsClientProperties(response, {
        retries: 2,
        retryWait: 3000,
      });
      assert.strictEqual(webserver.getRequests().length, 4);
    });

    it(`${verifierName}: polling retry strategy`, async () => {
      let response = await client.put(
        HOST,
        {
          hello: "world!",
        },
        { headers: { "Content-Type": "application/json" } }
      );
      verifier.verifySuccess(response, 201);

      webserver.addStatusCodes([202, 202, 202]);

      let attemptCount = 1;
      /*
      *EXAMPLE* GET in the style of axios (options object only)
      Example of a custom retry strategy, which will continue to poll an endpoint every
      second as long as the response code is 202.
      */
      response = await client({
        url: HOST,
        cloudClient: {
          retry: {
            strategies: [
              {
                // function that determines whether to retry a response
                shouldRetry: (retryInfo) => {
                  const {
                    attempts,
                    maxAttempts,
                    delayMultiple,
                    url,
                    response,
                    options,
                  } = retryInfo;
                  assert.strictEqual(attempts, attemptCount);
                  assert.strictEqual(maxAttempts, 3);
                  assert.strictEqual(delayMultiple, 2);
                  assert.strictEqual(url, HOST);
                  assert.ok(options);
                  attemptCount++;
                  const { status } = response;
                  return status === 202;
                },
                getDelayMultiple: () => 1, // retry duration should remain the same after each retry
                getMaxRetries: () => 10, // increased maximum number of retries
              },
            ],
          },
        },
      });
      verifier.verifySuccess(response);
      await verifier.verifyBody(response, { hello: "world!" });
      verifier.verifyOptionsClientProperties(response, {
        retries: 3,
        retryWait: 3000,
      });
      assert.strictEqual(webserver.getRequests().length, 5);

      for (let i = 2; i < webserver.getRequests().length; i++) {
        const prevTime = webserver.getRequests()[i - 1].timestamp;
        const currTime = webserver.getRequests()[i].timestamp;
        assert.ok(currTime - prevTime >= 1000 && currTime - prevTime < 2000);
      }
    });

    it(`${verifierName}: timeout verification`, async () => {
      return assert.rejects(
        async () => {
          await client({
            url: `${HOST}/timeout/1000`,
            cloudClient: {
              timeout: 500,
            },
          });
        },
        (e) => {
          verifier.verifyOptionsClientProperties(e, {
            retries: 2,
            retryWait: 3000,
            retryResponses: (retryResponses) => {
              assert.strictEqual(retryResponses.length, 2);
              retryResponses.forEach((retryResponse) => {
                const { error = {} } = retryResponse;
                assert.ok(error.name);
                assert.ok(error.message);
              });
              return true;
            },
          });
          verifier.verifyCloudClientProperties(e, {
            requestTime: (time) => time !== undefined,
          });
          return true;
        }
      );
    });
  });
});
