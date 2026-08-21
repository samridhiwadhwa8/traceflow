const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();

function traceflow(req, res, next) {
  const traceId = crypto.randomUUID();
  const start = Date.now();

  storage.run({ traceId }, () => {
    res.on('finish', () => {
      const duration = Date.now() - start;

      const trace = {
        traceId,
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode,
        duration
      };

      console.log(trace);
    });

    next();
  });
}

module.exports = {
  traceflow,
  storage
};
