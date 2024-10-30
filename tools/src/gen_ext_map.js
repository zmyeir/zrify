import fs from 'fs';
import path from 'path';
import { logError, logMessage } from './logger.js';

const zrmExtMap = {};
const readZrmExtMap = () => {
    const filePath = path.resolve('./res/zrmdb.txt');
    if (!fs.existsSync(filePath)) {
        logError(`${filePath} 文件不存在`);
        return;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    data.split('\n').forEach(line => {
        const [character, extCode] = line.split(' ');
        if (character && extCode) {
            if (!zrmExtMap[character]) {
                zrmExtMap[character] = [];
            }
            zrmExtMap[character].push(extCode);
        }
    });
};

const generateZrmExtMapFile = () => {
    const outputFilePath = path.resolve('./src/zrm_ext_map.js');
    const formattedEntries = Object.entries(zrmExtMap)
        .map(([key, value]) => `"${key}": [  ${value.map(v => `"${v}"`).join(', ')}  ]`)
        .join(',\n');

    const content = `export const ZRM_EXT_MAP = {\n${formattedEntries}\n};\n`;
    fs.writeFileSync(outputFilePath, content);
    logMessage(`映射表已生成: ${outputFilePath}`);
};

const main = () => {
    logMessage("###########");

    logMessage("读取辅助码");
    readZrmExtMap();
    
    logMessage("生成 zrm_ext_map.js");
    generateZrmExtMapFile();

    logMessage("###########");
};

main();