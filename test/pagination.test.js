const assert = require('assert');

const { describe, it, before, afterEach } = require('mocha');
const { createSandbox } = require('sinon');
const Pagination = require('../src/pagination');
const Request = require('../src/request');

describe('Pagination tests', () => {
  let sandbox;

  before(() => {
    sandbox = createSandbox();
  });

  afterEach(() => sandbox.restore());

  describe('#Pagination', () => {
    it('should have default options on Pagination instance', () => {
      const pagination = new Pagination();
      const expectedProperties = {
        maxRetries: 4,
        retryTimeout: 1000,
        maxRequestTimeout: 1000,
        threshold: 200,
      };

      assert.ok(pagination.request instanceof Request);

      Reflect.deleteProperty(pagination, "request");
      const getEntries = item => Object.entries(item);
      assert.deepStrictEqual(getEntries(pagination), getEntries(expectedProperties));
    });

    it('should set default options on Pagination instance', () => {
      const params = {
        maxRetries: 2,
        retryTimeout: 100,
        maxRequestTimeout: 100,
        threshold: 10,
      };

      const pagination = new Pagination(params);
      const expectedProperties = {
        request: {},
        ...params
      };

      assert.ok(pagination.request instanceof Request);
      assert.deepStrictEqual(JSON.stringify(pagination), JSON.stringify(expectedProperties));
    });

    describe('#sleep', () => {
      it('should be a Promise object and not return values', async () => {
        const clock = sandbox.useFakeTimers();
        const time = 1;
        const pendingPromise = Pagination.sleep(time);

        clock.tick(time);
        assert.ok(pendingPromise instanceof Promise);

        const result = await pendingPromise;
        assert.ok(result === undefined);
      });
    });

    describe('#handleRequest', () => {
      it('should retry a request twice before throwing an exception and validate request params and flow', async () => {
        const expectedCallCount = 2;
        const expectedTimeout = 2;
        
        const pagination = new Pagination();
        pagination.maxRetries = expectedCallCount;
        pagination.retryTimeout = expectedTimeout;
        pagination.maxRequestTimeout = expectedTimeout;
  
        const error = new Error("timeout");
        
        // mostra quantas vezes o método é rodado
        sandbox.spy(pagination, pagination.handleRequest.name);
        sandbox.stub(
          Pagination,
          Pagination.sleep.name,
        ).resolves();
  
        sandbox.stub(
          pagination.request,
          pagination.request.makeRequest.name,
        ).rejects(error);
  
        const dataRequest = { url: 'https://google.com', page: 0 };
        await assert.rejects(pagination.handleRequest(dataRequest), error);
        assert.deepStrictEqual(pagination.handleRequest.callCount, expectedCallCount);
  
        const lastCall = expectedCallCount - 1;
        const lastCallArg = pagination.handleRequest.getCall(lastCall).lastArg;
        const lastCallRetries = lastCallArg.retries;
        assert.deepStrictEqual(lastCallRetries, expectedCallCount);
  
        const expectedArgs = {
          url: `${dataRequest.url}?tid=${dataRequest.page}`,
          method: 'get',
          timeout: expectedTimeout,
        };
        const firstCallArgs = pagination.request.makeRequest.getCall(0).args;
        assert.deepStrictEqual(firstCallArgs, [expectedArgs]);
  
        assert.ok(Pagination.sleep.calledWithExactly(expectedTimeout));
      });
  
      it('should return data from request when succeeded', async () => {
        const data = { result: 'ok' };
        const pagination = new Pagination();
        
        // deu certo a requisição, e a resposta foi ok
        sandbox.stub(
          pagination.request,
          pagination.request.makeRequest.name,
        ).resolves(data);
  
        const result = await pagination.handleRequest({ url: 'https://google.com', page: 1 });
        assert.deepStrictEqual(result, data)
      });
    });

    describe('#getPaginated', () => {
      const responseMock = [
        {
          "tid": 5705,
          "date": 1373123005,
          "type": "sell",
          "price": 196.52,
          "amount": 0.01,
        },
        {
          "tid": 5706,
          "date": 1373124523,
          "type": "buy",
          "price": 200,
          "amount": 0.3,
        }
      ];

      it('should update request id on each requests', async () => {
        const pagination = new Pagination();
        sandbox.stub(
          Pagination,
          Pagination.sleep.name,
        ).resolves();
        
        sandbox.stub(
          pagination,
          pagination.handleRequest.name,
        ).onCall(0).resolves([responseMock[0]])
          .onCall(1).resolves([responseMock[1]])
          .onCall(2).resolves([]);

        sandbox.spy(pagination, pagination.getPaginated.name);

        const data = { url: 'https://google.com', page: 1 };

        const secondCallExpectation = {
          ...data,
          page: responseMock[0].tid,
        };

        const thirdCallExpectation = {
          ...secondCallExpectation,
          page: responseMock[1].tid,
        };

        /**
         * para chamar uma função que é um generator
         * Array.from(pagination.getPaginated()) => dessa forma ele não espera os dados sob demanda!
         * ele vai guardar tudo em memória e só depois jogar no array
         * const r = pagination.getPaginated()
         * r.next() 0> { done: true | false, value: {} }
         * a melhor forma é usar o for..of
         */
        const gen = pagination.getPaginated(data);
        for await (const result of gen) {}

        const getFirstArgFromCall = value => pagination.handleRequest.getCall(value).firstArg;

        assert.deepStrictEqual(getFirstArgFromCall(0), data);
        assert.deepStrictEqual(getFirstArgFromCall(1), secondCallExpectation);
        assert.deepStrictEqual(getFirstArgFromCall(2), thirdCallExpectation);
      });

      it('should stop requesting when request return an empty array', async () => {
        const expectedThreshold = 20;
        const pagination = new Pagination();
        pagination.threshold = expectedThreshold;

        sandbox.stub(
          Pagination,
          Pagination.sleep.name,
        ).resolves();
        
        sandbox.stub(
          pagination,
          pagination.handleRequest.name,
        ).onCall(0).resolves([responseMock[0]])
          .onCall(1).resolves([])

        sandbox.spy(pagination, pagination.getPaginated.name);

        const data = { url: 'https://google.com', page: 1 };
        const iterator = await pagination.getPaginated(data);
        const [firstResult, secondResult] = await Promise.all([
          iterator.next(),
          iterator.next(),
        ]);

        const expectedFisrtCall = { done: false, value: [responseMock[0]] };
        assert.deepStrictEqual(firstResult, expectedFisrtCall);

        const expectedSecondtCall = { done: true, value: undefined };
        assert.deepStrictEqual(secondResult, expectedSecondtCall);

        assert.deepStrictEqual(Pagination.sleep.callCount, 1);
        assert.ok(Pagination.sleep.calledWithExactly(expectedThreshold));
      });
    });
  });
});
