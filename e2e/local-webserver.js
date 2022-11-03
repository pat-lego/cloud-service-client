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

const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();

app.use(express.json());
app.use(cookieParser());

let server = false;
const port = 3001;
let data = {};
let requests = [];
let responses = [];
const URL = require("url");

/**
 * Retrieves the data that has been created in the webserver for the url in the given request.
 * Will throw a 404 error if no data has been created at the url.
 *
 * @param {express.HttpRequest} req Request as provided by express.
 * @returns {*} The data that was registered for the url.
 */
function getData(req) {
  const { url } = req;
  const { pathname } = URL.parse(url);

  if (!data[pathname]) {
    throw new Error("404");
  }
  return data[pathname];
}

/**
 * Sets the data in the webserver for the url in the given request.
 *
 * @param {express.HttpRequest} req Request as provided by express.
 */
function setData(req) {
  const { url, body } = req;
  const { pathname } = URL.parse(url);
  data[pathname] = body;
}

/**
 * Deletes the data in the webserver for the url in the given request. Will
 * throw a 404 error if no data has been created at the url.
 *
 * @param {express.HttpRequest} req Request as provided by express.
 */
function deleteData(req) {
  const { url } = req;
  const { pathname } = URL.parse(url);

  if (!data[pathname]) {
    throw new Error("404");
  }
  delete data[pathname];
}

/**
 * Handles an incoming request by performing common operations on the request, such as
 * logging information about the request, overriding normal behavior using registered
 * requests, and handling errors.
 *
 * @param {express.HttpRequest} req Request as provided by express.
 * @param {express.HttpResponse} res Response as provided by express.
 * @param {Function} toRun Function to run to handle the request, assuming the
 *  server doesn't override the normal behavior.
 */
function handleRequest(req, res, toRun) {
  logRequest(req);
  if (responses.length) {
    const response = responses.shift();
    const { statusCode = 200, headers = {}, body = "" } = response;
    Object.keys(headers).forEach((header) => {
      res.append(header, headers[header]);
    });
    if (body) {
      res.send(body);
    }
    res.status(statusCode).end();
  } else {
    try {
      toRun();
    } catch (e) {
      res.status(parseInt(e.message, 10)).end();
    }
  }
}

/**
 * Logs information about the request with the webserver.
 *
 * @param {express.HttpRequest} req Request as provided by express.
 */
function logRequest(req) {
  req.timestamp = new Date().getTime();
  requests.push(req);
}

/**
 * Starts the local webserver and returns information about the host where it's running.
 *
 * @returns {string} URL of the host where the server is listening.
 */
module.exports = function () {
  return new Promise((res) => {
    app.get("/timeout/*", (req, res) => {
      const urlStr = String(req.url);
      const timeout = parseInt(urlStr.substr(urlStr.lastIndexOf("/") + 1));
      setTimeout(() => {
        res.end();
      }, timeout);
    });

    app.get("*", (req, res) => {
      handleRequest(req, res, () => {
        const data = getData(req);
        res.send(data);
      });
    });

    app.options("*", (req, res) => {
      handleRequest(req, res, () => {
        const data = getData(req);
        res.send(data);
      });
    });

    app.put("*", (req, res) => {
      handleRequest(req, res, () => {
        try {
          getData(req);
          res.status(409).end();
        } catch (e) {
          setData(req);
          res.status(201).end();
        }
      });
    });

    app.post("*", (req, res) => {
      handleRequest(req, res, () => {
        getData(req);
        setData(req);
        res.status(200).end();
      });
    });

    app.patch("*", (req, res) => {
      handleRequest(req, res, () => {
        getData(req);
        setData(req);
        res.status(200).end();
      });
    });

    app.delete("*", (req, res) => {
      handleRequest(req, res, () => {
        getData(req);
        deleteData(req);
        res.status(200).end();
      });
    });

    server = app.listen(port, () => {
      res(`http://localhost:${port}`);
    });
  });
};

/**
 * @typedef {object} RequestInfo
 * @property {number} [statusCode] HTTP status code that should be returned in the response. Default: 200.
 * @property {object} [headers] Headers to include in the response, where keys are header names
 *  and values are each header's value. Default: no headers.
 * @property {string} [body] Value to send as the body of the response. Default: empty.
 */

/**
 * Registers a raw response that should be returned by the web server on the next request(s).
 *
 * @param {Array<RequestInfo>} responsesToAdd Responses for the server to return.
 */
function addResponses(responsesToAdd) {
  responses = responses.concat(responsesToAdd);
}

module.exports.addResponses = addResponses;

/**
 * Convenience method that registers the status codes (only) that should be returned by the web server
 * on the next request(s).
 *
 * @param {Array<number>} codes Status codes for the server to return.
 */
module.exports.addStatusCodes = (codes) => {
  addResponses(
    codes.map((statusCode) => {
      return { statusCode };
    })
  );
};

/**
 * Retrieves all requests that have been received by the server.
 *
 * @returns {Array<express.HttpRequest>} Raw express requests.
 */
module.exports.getRequests = () => {
  return requests;
};

/**
 * Resets the state of the server by clearing all registered data, requests, and logged responses.
 */
module.exports.reset = () => {
  data = {};
  requests = [];
  responses = [];
};

/**
 * Informs the webserver to stop listening.
 */
module.exports.close = () => {
  if (server) {
    server.close();
  }
};
