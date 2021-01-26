const assert = require('assert');
const Events = require('events');

const { describe, it, before, afterEach } = require('mocha');
const { createSandbox } = require('sinon');

const Request = require('../src/request');

describe('Request helpers', () => {
  const timeout = 15;
  const urlRequest = 'https://testing.com';
  let sandbox, request;

  before(() => {
    sandbox = createSandbox();
    request = new Request();
  });

  afterEach(() => sandbox.restore());

  it(`should throw a timeout error when the function has spent more than ${timeout}ms`, async () => {
    const exceededTimeout = timeout + 10;
    sandbox.stub(request, request.get.name).callsFake(() => new Promise(r => setTimeout(r, exceededTimeout)));

    const call = request.makeRequest({ url: urlRequest, method: 'get', timeout });
    await assert.rejects(call, { message: `timeout at [${urlRequest}] :(` });
  });

  it('should return ok when promise time is ok', async () => {
    const expected = { ok: 'ok' };
    sandbox.stub(request, request.get.name)
      .callsFake(async () => {
        await new Promise(r => setTimeout(r));
        
        return expected;
      });

    const call = () => request.makeRequest({ url: urlRequest, method: 'get', timeout });
    
    await assert.doesNotReject(call());
    assert.deepStrictEqual(await call(), expected);
  });

  it('should return a JSON object after a request', async () => {
    const data = [
      Buffer.from('{ '),
      Buffer.from(' "ok"'),
      Buffer.from(' :'),
      Buffer.from(' "ok"'),
      Buffer.from(' }'),
    ];

    const responseEvent = new Events();
    const httpEvent = new Events();

    const https = require('https');
    sandbox.stub(https, https.get.name)
      .yields(responseEvent)
      .returns(httpEvent);

    const expected = { ok: 'ok' };
    const pendingPromise = request.get(urlRequest);

    data.map(d => responseEvent.emit('data', d));

    responseEvent.emit('end');

    const result = await pendingPromise;
    assert.deepStrictEqual(result, expected);
  });
});
