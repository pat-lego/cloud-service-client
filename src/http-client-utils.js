/*************************************************************************
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 * Copyright 2022 Adobe
 * All Rights Reserved.
 *
 * NOTICE: All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.
 **************************************************************************/

const HttpOptions = require("./http-options");
const HttpResponse = require("./http-response");
const HttpBackend = require("./http-backends/http-backend");

/**
 * Uses the strategies defined in HTTP options to determine whether a request needs to
 * be retried based on its response.
 *
 * @param {HttpOptions} httpOptions Options whose strategies will be used.
 * @param {HttpBackend} backend Backend processing the request.
 * @param {HttpResponse} response Response that will be given to each strategy.
 * @param {number} attempts Number of times the current request has been retried.
 * @returns {number|boolean} If false, indicates that the request should _not_
 *  be retried. If not false, the amount of time in milliseconds that should
 *  elapse before retrying.
 */
async function retryWithStrategies(httpOptions, backend, response, attempts) {
  const retryStrategies = httpOptions.getRetryStrategies();
  const options = await backend.getRequestConfig(httpOptions);
  const rawResponse = response.getRawResponse();
  for (let i = 0; i < retryStrategies.length; i++) {
    const strategy = retryStrategies[i];
    const retryOptions = {
      url: httpOptions.getUrl(),
      options,
      response: rawResponse,
      attempts,
      maxAttempts: httpOptions.getMaxRetries(),
      delayMultiple: httpOptions.getRetryDelayMultiple(),
      delay: httpOptions.getRetryDelay(),
    };
    const shouldRetry = await strategy.shouldRetry(retryOptions);
    if (strategy.constructor) {
      httpOptions.logDebug(
        `${strategy.constructor.name} answered with ${shouldRetry} for retry`
      );
    }
    if (shouldRetry) {
      const delayMultiple = await strategy.getRetryDelayMultiple(retryOptions);
      const maxRetries = await strategy.getMaxRetryCount(retryOptions);
      const delay = await strategy.getRetryDelay(retryOptions);

      if (attempts >= maxRetries && maxRetries >= 0) {
        return false;
      }

      let retryDelay = delay * Math.pow(delayMultiple, attempts - 1);
      return retryDelay;
    }
  }
  return false;
}

module.exports = {
  retryWithStrategies,
};
