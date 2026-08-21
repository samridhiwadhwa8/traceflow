const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();
const INGESTION_URL = 'http://localhost:4000/ingest';

function traceflow(req, res, next) {
  const traceId = crypto.randomUUID();
  const start = Date.now();

  storage.run({ traceId }, () => {
    res.on('finish', async () => {
      const duration = Date.now() - start;

      const trace = {
        traceId,
        method: req.method,
        route: req.originalUrl,
        status: res.statusCode,
        duration
      };

      try {
        const response = await fetch(INGESTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(trace)
        });
        
        if (!response.ok) {
          console.error('Failed to send trace:', response.status, response.statusText);
        } else {
          console.log('Trace sent successfully');
        }
      } catch (error) {
        console.error('Failed to send trace:', error.message);
      }
    });

    next();
  });
}

module.exports = {
  traceflow,
  storage
};
