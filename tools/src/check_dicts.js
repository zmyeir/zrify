import fs from 'fs/promises';
import path from 'path';
import { logError, logMessage } from './logger.js';

const checkCharacterPinyinCount = async (filePath) => {
    try {
        logMessage(`开始检查 ${filePath}`);
        const data = await fs.readFile(filePath, 'utf-8');
        const lines = data.split('\n');
        const validLines = [];
        let inCommentBlock = false;
        let hasMismatch = false; 

        lines.forEach((line, index) => {
            if (line.trim() === '---') {
                inCommentBlock = true;
                validLines.push(line);
                return;
            } else if (line.trim() === '...') {
                inCommentBlock = false;
                validLines.push(line);
                return;
            }

            if (inCommentBlock) {
                validLines.push(line);
                return;
            }

            if (line.startsWith('#') || line.trim() === '') {
                validLines.push(line);
                return;
            }

            const [chars, pinyins] = line.split('\t');
            if (chars && pinyins) {
                const charCount = Array.from(chars).length;
                const pinyinCount = pinyins.split(' ').length;

                if (charCount === pinyinCount) {
                    validLines.push(line);
                } else {
                    hasMismatch = true;
                    logMessage(`行 ${index + 1} 不匹配: 字符 "${chars}" 与拼音 "${pinyins}" 不匹配`);
                }
            }
        });

        if (hasMismatch) {
            await fs.writeFile(filePath, validLines.join('\n'), 'utf-8');
            logMessage(`已更新文件 ${filePath}，无效数据已删除`);
        } else {
            logMessage(`文件 ${filePath} 检查完成,无需修改`);
        }

    } catch (error) {
        logError(`读取文件出错: ${filePath}, 错误: ${error.message}`);
    }
};

const processInputPath = async (inputPath) => {
    const stats = await fs.stat(inputPath);
    
    if (stats.isDirectory()) {
        const files = await fs.readdir(inputPath);
        for (const file of files) {
            const filePath = path.join(inputPath, file);
            if (filePath.endsWith('.dict.yaml')) {
                await checkCharacterPinyinCount(filePath);
            }
        }
    } else if (stats.isFile()) {
        await checkCharacterPinyinCount(inputPath);
    } else {
        logError(`${inputPath}`);
    }
};

const main = async () => {
    const inputPath = './dicts';
    await processInputPath(inputPath);
};

main();