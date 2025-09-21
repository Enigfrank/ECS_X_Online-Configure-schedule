class ConfigParser {
    static parseJS(content) {
        try {
            console.log('开始解析配置文件...');

            // 查找配置对象的开始位置
            const startIndex = content.indexOf('const _scheduleConfig =');
            if (startIndex === -1) {
                throw new Error('未找到 const _scheduleConfig =');
            }

            // 从开始位置查找整个对象
            const objectStart = content.indexOf('{', startIndex);
            if (objectStart === -1) {
                throw new Error('未找到配置对象开始 {');
            }

            // 使用更可靠的括号匹配算法
            let braceCount = 1;
            let endIndex = objectStart + 1;

            for (let i = objectStart + 1; i < content.length; i++) {
                const char = content[i];
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        endIndex = i + 1;
                        break;
                    }
                }
            }

            if (braceCount !== 0) {
                throw new Error('配置对象括号不匹配，braceCount=' + braceCount);
            }

            // 提取配置对象字符串
            const configStr = content.substring(objectStart, endIndex);
            console.log('提取的配置字符串长度:', configStr.length);

            // 清理注释
            const cleanConfigStr = this.removeComments(configStr);

            // 移除尾部逗号等格式问题
            const fixedConfigStr = this.fixConfigFormat(cleanConfigStr);

            console.log('清理后的配置字符串:', fixedConfigStr.substring(0, 200));

            // 安全解析
            const result = new Function(`return (${fixedConfigStr})`)();
            console.log('解析成功');
            return result;

        } catch (error) {
            console.error('解析失败:', error);
            throw new Error('解析失败: ' + error.message);
        }
    }

    static removeComments(str) {
        // 移除单行注释
        let result = str.replace(/\/\/.*$/gm, '');
        // 移除多行注释
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        return result;
    }

    static fixConfigFormat(str) {
        return str
            // 移除尾部逗号
            .replace(/,\s*([}\]])/g, '$1')
            // 修复多余的逗号
            .replace(/,,/g, ',')
            .trim();
    }

    // 判断数组是否应该横向格式化
    static shouldFormatHorizontal(arr) {
        // 数组长度<=12且元素都是简单类型时横向排列
        if (arr.length <= 12) {
            return arr.every(item => 
                typeof item === 'string' || 
                typeof item === 'number' || 
                typeof item === 'boolean' ||
                item === null ||
                (Array.isArray(item) && 
                 item.length <= 3 && 
                 item.every(sub => typeof sub === 'string'))
            );
        }
        return false;
    }

    // 格式化配置对象
    static formatConfig(obj, indent = 0) {
        const spaces = '    '.repeat(indent);
        const nextSpaces = '    '.repeat(indent + 1);
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]';
            
            // 检查是否应该横向排列
            const shouldHorizontal = this.shouldFormatHorizontal(obj);
            
            if (shouldHorizontal) {
                // 横向排列
                const items = obj.map(item => {
                    if (item && typeof item === 'object') {
                        return this.formatConfig(item, 0); // 横向时不需要额外缩进
                    } else if (typeof item === 'string') {
                        return `'${item}'`;
                    } else {
                        return String(item);
                    }
                });
                return `[${items.join(', ')}]`;
            } else {
                // 竖直排列
                const items = obj.map(item => {
                    if (item && typeof item === 'object') {
                        return this.formatConfig(item, indent + 1);
                    } else if (typeof item === 'string') {
                        return `'${item}'`;
                    } else {
                        return String(item);
                    }
                });
                return `[\n${nextSpaces}${items.join(`,\n${nextSpaces}`)}\n${spaces}]`;
            }
        }
        
        if (obj && typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '{}';
            
            const items = keys.map(key => {
                const value = obj[key];
                // key格式化
                const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
                // value格式化
                let formattedValue;
                if (value && typeof value === 'object') {
                    formattedValue = this.formatConfig(value, indent + 1);
                } else if (typeof value === 'string') {
                    if (value === 'hidden') {
                        formattedValue = "'hidden'";
                    } else {
                        formattedValue = `'${value}'`;
                    }
                } else {
                    formattedValue = String(value);
                }
                return `${nextSpaces}${formattedKey}: ${formattedValue}`;
            });
            
            return `{\n${items.join(',\n')}\n${spaces}}`;
        }
        
        return String(obj);
    }

    // 最终推荐的generateJS函数 - 保持格式化
    static generateJS(config) {
        const formattedConfig = this.formatConfig(config);
        
        return `const _scheduleConfig = ${formattedConfig};

var scheduleConfig = JSON.parse(JSON.stringify(_scheduleConfig));`;
    }
}