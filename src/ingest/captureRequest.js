'use strict';

function captureRequest(req) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  return {
    received_at: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query_json: JSON.stringify(req.query),
    headers_json: JSON.stringify(req.headers),
    remote_ip: req.ip || '',
    content_type: req.headers['content-type'] || '',
    raw_body: rawBody,
  };
}

module.exports = { captureRequest };
