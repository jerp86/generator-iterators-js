const assert = require('assert');

const { describe, it, before, afterEach } = require('mocha');
const { createSandbox } = require('sinon');

describe('Pagination tests', () => {
  let sandbox;

  before(() => {
    sandbox = createSandbox();
  });

  afterEach(() => sandbox.restore());

  describe('#Pagination', () => {
    it('should retry an request twice before throing an exception and validate request params and flow');

    it('should return data from request when succeded');
  });
});
