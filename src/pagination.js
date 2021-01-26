const Request = require("./request");

const DEFAULT_OPTIONS = {
  maxRetries: 4,
  retryTimeout: 1000,
  maxRequestTimeout: 1000,
  threshold: 200,
};

class Pagination {
  constructor(options = DEFAULT_OPTIONS) {
    this.request = new Request();

    this.maxRetries = options.maxRetries;
    this.retryTimeout = options.retryTimeout;
    this.maxRequestTimeout = options.maxRequestTimeout;
    this.threshold = options.threshold;
  }

  async handleRequest({ url, page, retries = 1 }) {}

  async getPaginated({ url, page }) {}
}

module.exports = Pagination;
