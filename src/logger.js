'use strict';

const fs = require('fs');
const path = require('path');

function writeLog(data) {
  try {
    const logDir = path.resolve(process.env.LOG_DIR || './logs');
    fs.mkdirSync(logDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logPath = path.join(logDir, `${date}.jsonl`);
    fs.appendFileSync(logPath, JSON.stringify(data) + '\n');
  } catch (err) {
    console.error('[logger] write failed:', err.message);
  }
}

module.exports = { writeLog };
