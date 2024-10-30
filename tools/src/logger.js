import fs from 'fs';

export const logError = (message) => {
    const logMessage = `ERROR: ${message}\n`;
    fs.appendFileSync('run.log', logMessage);
    console.error(logMessage);
};

export const logMessage = (message) => {
    const logMessage = `INFO: ${message}\n`;
    fs.appendFileSync('run.log', logMessage);
    console.log(logMessage);
};
