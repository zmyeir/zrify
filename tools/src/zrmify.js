import fs from 'fs/promises';
import path from 'path';
import { ZRM_EXT_MAP } from './zrm_ext_map.js';
import { SHENGMU_MAP, YUNMU_MAP, ZERO_SHENGMU_MAP } from './pinyn_map.js';
import { logError, logMessage } from './logger.js';

const VERSION_TIME = new Date().toISOString().slice(2, 10).replace(/-/g, '');
const TEMPLATE_FILE = './res/000.dict.yaml';

const isValidInput = (chars, pinyins, freq) => {
    if (!chars || !pinyins || (freq && !/^[0-9]+$/.test(freq))) {
        logError(`输入格式无效: ${chars}, ${pinyins}, ${freq}`);
        return false;
    }
    return true;
};

const convert = (inputText, skippedChars, onlyExtCode, onlyPinyin) => {
    let outputText = '';

    inputText.split('\n').forEach(line => {
        if (line.startsWith('#')) return;

        const [chars, pinyins, freq] = line.split('\t');
        if (!isValidInput(chars, pinyins, freq)) return;

        const charArray = Array.from(chars);
        const pinyinList = pinyins.split(' ');

        const frequency = freq || '';

        if (charArray.length === 1) {
            outputText += handleSingleCharacter(chars, pinyins, frequency, skippedChars, onlyExtCode, onlyPinyin);
        } else if (charArray.length === pinyinList.length) {
            outputText += handleMultipleCharacters(chars, pinyinList, frequency, skippedChars, onlyExtCode, onlyPinyin);
        } else {
            logError(`字符与拼音数量不匹配: ${chars}, ${pinyins}`);
        }
    });

    return outputText;
};

const handleSingleCharacter = (chars, pinyins, freq, skippedChars, onlyExtCode, onlyPinyin) => {
    const baseCode = zrmify(pinyins);
    const extCodes = ZRM_EXT_MAP[chars] || [];

    if (extCodes.length > 0) {
        if (onlyExtCode) {
            return extCodes.map(extCode => `${chars}\t${pinyins};${extCode}` + (freq ? `\t${freq}` : '')).join('\n') + '\n';
        } else if (onlyPinyin) {
            return `${chars}\t${baseCode}` + (freq ? `\t${freq}` : '') + '\n';
        } else {
            return extCodes.map(extCode => `${chars}\t${baseCode};${extCode}` + (freq ? `\t${freq}` : '')).join('\n') + '\n';
        }
    } else {
        skippedChars.add(chars);
        return '';
    }
};

const handleMultipleCharacters = (chars, pinyinList, freq, skippedChars, onlyExtCode, onlyPinyin) => {
    const charArray = Array.from(chars);

    let zrmResult = '';
    pinyinList.forEach((pinyin, index) => {
        const char = charArray[index];
        const baseCode = zrmify(pinyin);
        const extCodes = ZRM_EXT_MAP[char] || [];

        if (extCodes.length > 0) {
            if (onlyExtCode) {
                zrmResult += `${pinyin};${extCodes[0]} `;
            } else if (onlyPinyin) {
                zrmResult += `${baseCode} `;
            } else {
                zrmResult += `${baseCode};${extCodes[0]} `;
            }
        } else {
            skippedChars.add(char);
            logError(`词组 "${chars}" 中有字符没有找到拓展码。拼音: "${pinyin}"`);
        }
    });

    return `${chars}\t${zrmResult.trim()}` + (freq ? `\t${freq}` : '') + '\n';
};

const zrmify = (pinyin) => {
    if (!pinyin) {
        logError(`无效拼音: ${pinyin}`);
        return '';
    }

    if (pinyin === 'n') return 'en';
    
    if ('aeiou'.includes(pinyin[0])) {
        return zeroShengmuConvert(pinyin);
    }

    const shengmu = pinyin.length > 2 && ['zh', 'ch', 'sh'].includes(pinyin.slice(0, 2))
        ? pinyin.slice(0, 2)
        : pinyin[0];
    
    const yunmu = pinyin.slice(shengmu.length);
    return shengmuConvert(shengmu) + yunmuConvert(yunmu);
};

const zeroShengmuConvert = (pinyin) => {
    if (pinyin in ZERO_SHENGMU_MAP) {
        return ZERO_SHENGMU_MAP[pinyin];
    }
    logError(`无效零声母拼音: ${pinyin}`);
    return '';
};

const shengmuConvert = (pinyin) => {
    if (pinyin in SHENGMU_MAP) {
        return SHENGMU_MAP[pinyin];
    }
    logError(`无效拼音声母: ${pinyin}`);
    return '';
};

const yunmuConvert = (pinyin) => {
    if (pinyin in YUNMU_MAP) {
        return YUNMU_MAP[pinyin];
    }
    logError(`无效拼音韵母: ${pinyin}`);
    return '';
};

const checkFiles = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

const processInputFiles = async (inputFiles, skippedChars, onlyExtCode, onlyPinyin) => {
    let finalOutput = '';

    for (const input of inputFiles) {
        const inputPath = path.resolve(input);
        
        if (await checkFiles(inputPath)) {
            const stats = await fs.stat(inputPath);
            
            const processFile = async (filePath) => {
                try {
                    logMessage(`正在处理文件: ${filePath}`);
                    const inputData = await fs.readFile(filePath, 'utf-8');
                    finalOutput += convert(inputData, skippedChars, onlyExtCode, onlyPinyin);
                } catch (error) {
                    logError(`读取文件出错: ${filePath}, 错误: ${error.message}`);
                }
            };

            if (stats.isDirectory()) {
                const files = await fs.readdir(inputPath);
                for (const file of files) {
                    const filePath = path.join(inputPath, file);
                    if (filePath.endsWith('.dict.yaml')) {
                        await processFile(filePath);
                    }
                }
            } else if (stats.isFile() && inputPath.endsWith('.dict.yaml')) {
                await processFile(inputPath);
            } else {
                logError(`文件不是有效的字典文件: ${inputPath}`);
            }
        } else {
            logError(`词库文件不存在: ${inputPath}`);
        }
    }

    return finalOutput;
};

const checkTemplateFile = async () => {
    const templateFilePath = path.resolve(TEMPLATE_FILE);
    if (!await checkFiles(templateFilePath)) {
        logError(`模板文件 ${TEMPLATE_FILE} 不存在`);
        return false;
    }
    return true;
};

const createOutputFile = async (outputFile, name) => {
    try {
        const templateFilePath = path.resolve(TEMPLATE_FILE);
        const templateContent = await fs.readFile(templateFilePath, 'utf-8');
        const replaceContent = templateContent.replace(/{{version}}/g, VERSION_TIME).replace(/{{name}}/g, name);
        await fs.writeFile(outputFile, replaceContent);
    } catch (error) {
        logError(`创建输出文件出错: ${outputFile}, 错误: ${error.message}`);
    }
};


const parseArguments = (args) => {
    const inputFiles = [];
    let outputFile = '';
    let name = '';
    let onlyExtCode = false;
    let onlyPinyin= false;

    for (let i = 0; i < args.length; i++) {
        if (['--input', '-i'].includes(args[i])) {
            while (++i < args.length && !args[i].startsWith('-')) {
                inputFiles.push(args[i]);
            }
            i--;
        } else if (['--output', '-o'].includes(args[i])) {
            outputFile = args[++i];
        } else if (['--name', '-n'].includes(args[i])) {
            name = args[++i];
        } else if (['--only_extcode'].includes(args[i])) {
            onlyExtCode = true;
        } else if (['--only_pinyin'].includes(args[i])) {
            onlyPinyin = true;
        }
    }

    return { inputFiles, outputFile, name, onlyExtCode, onlyPinyin };
};

const main = async () => {
    const args = process.argv.slice(2);
    logMessage("###########");

    const { inputFiles, outputFile, name, onlyExtCode, onlyPinyin } = parseArguments(args);

    if (!outputFile || inputFiles.length === 0) {
        logError("请提供输入文件和输出文件。");
        logMessage("###########");
        return;
    }

    if (!await checkTemplateFile()) {
        return;
    }

    await createOutputFile(outputFile, name);
    const skippedChars = new Set();
    const finalOutput = await processInputFiles(inputFiles, skippedChars, onlyExtCode, onlyPinyin);

    if (finalOutput) {
        await fs.appendFile(outputFile, finalOutput);
    }

    logMessage(`处理完成，共有 ${skippedChars.size} 个字符无辅码：${Array.from(skippedChars).join(', ')}`);
    logMessage("###########");
};

main();
