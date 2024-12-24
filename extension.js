const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

// 全局变量集中管理
let currentBlameDecorationType = null;
let currentBlameInfo = null;

// 添加缓存对象
const cache = {
    gitConfig: null,
    gitInfo: null,
    commitDetails: new Map(),
    blameInfo: new Map()
};

// 将装饰器类型定义移到全局
const decorationTypes = {
    added: null,
    removed: null,
    header: null
};

// 为每个编辑器维护显示状态
const editorBlameStates = new Map();  // key: editor.document.uri.toString(), value: { shouldShow: boolean }

function getDecorationTypes() {
    if (!decorationTypes.added) {
        decorationTypes.added = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(155, 185, 85, 0.1)',
            isWholeLine: true
        });
        decorationTypes.removed = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 117, 117, 0.1)',
            isWholeLine: true
        });
        decorationTypes.header = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(86, 156, 214, 0.1)',
            isWholeLine: true
        });
    }
    return decorationTypes;
}

// 工具函数：检查编辑器和工作区
function checkEditorAndWorkspace() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('没有打开的文件');
        return null;
    }

    const workspaceRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('无法确定工作区根目录');
        return null;
    }

    return { editor, workspaceRoot };
}

function getGitConfig(workspaceRoot) {
    if (cache.gitConfig) {
        return Promise.resolve(cache.gitConfig);
    }
    return new Promise((resolve, reject) => {
        exec('git config --get remote.origin.url', { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            cache.gitConfig = stdout.trim();
            resolve(cache.gitConfig);
        });
    });
}

function parseGitUrl(gitUrl) {
    const sshPattern = /git@([^:]+):([^/]+)\/(.+)\.git/;
    const httpsPattern = /https:\/\/([^/]+)\/([^/]+)\/(.+)\.git/;

    let match = gitUrl.match(sshPattern) || gitUrl.match(httpsPattern);
    if (!match) return null;

    return {
        domain: match[1],
        owner: match[2],
        repo: match[3]
    };
}

function getCurrentBranch(workspaceRoot) {
    return new Promise((resolve, reject) => {
        exec('git rev-parse --abbrev-ref HEAD', { cwd: workspaceRoot }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout.trim());
        });
    });
}

function getCurrentCommit(workspaceRoot) {
    return new Promise((resolve, reject) => {
        exec('git rev-parse HEAD', { cwd: workspaceRoot }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout.trim());
        });
    });
}

function isDetachedHead(workspaceRoot) {
    return new Promise((resolve) => {
        exec('git symbolic-ref -q HEAD', { cwd: workspaceRoot }, (error) => {
            resolve(!!error);
        });
    });
}

function getGitBlame(filePath, workspaceRoot) {
    const cacheKey = `${workspaceRoot}:${filePath}`;
    if (cache.blameInfo.has(cacheKey)) {
        return Promise.resolve(cache.blameInfo.get(cacheKey));
    }
    return new Promise((resolve, reject) => {
        exec(`git blame --line-porcelain "${filePath}"`, { cwd: workspaceRoot }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }

            const lines = stdout.split('\n');
            const blameInfo = [];
            let currentCommit = null;
            let currentLine = null;

            lines.forEach(line => {
                if (line.match(/^[0-9a-f]{40}/)) {
                    if (currentLine) {
                        blameInfo.push(currentLine);
                    }
                    currentCommit = {
                        commit: line.substring(0, 40),
                        author: '',
                        time: '',
                        summary: ''
                    };
                    currentLine = { ...currentCommit };
                } else if (line.startsWith('author ')) {
                    currentCommit.author = line.substring(7);
                    if (currentLine) {
                        currentLine.author = currentCommit.author;
                    }
                } else if (line.startsWith('author-time ')) {
                    const timestamp = parseInt(line.substring(12)) * 1000;
                    const date = new Date(timestamp);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');

                    currentCommit.time = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                    if (currentLine) {
                        currentLine.time = currentCommit.time;
                    }
                } else if (line.startsWith('summary ')) {
                    currentCommit.summary = line.substring(8);
                    if (currentLine) {
                        currentLine.summary = currentCommit.summary;
                    }
                } else if (line.startsWith('\t')) {
                    if (currentLine) {
                        currentLine.code = line.substring(1);
                    }
                }
            });

            if (currentLine) {
                blameInfo.push(currentLine);
            }

            cache.blameInfo.set(cacheKey, blameInfo);
            resolve(blameInfo);
        });
    });
}

function generateColorFromHash(hash, timestamp) {
    const baseColor = hash.substring(0, 6);
    const now = Date.now() / 1000;  // 当前时间戳（秒）
    const ageInDays = (now - timestamp) / (24 * 60 * 60);  // commit 的年龄（天）

    // 调整亮度范围：0.4-0.8，减少亮度差异
    const brightness = 0.4 + (0.4 / (1 + Math.exp(ageInDays / 180 - 2)));

    // 基础颜色，提高基础亮度
    const r = parseInt(baseColor.substring(0, 2), 16) % 85 + 85;  // 85-170
    const g = parseInt(baseColor.substring(2, 4), 16) % 85 + 85;  // 85-170
    const b = parseInt(baseColor.substring(4, 6), 16) % 85 + 85;  // 85-170

    // 计算饱和度增加量，新的 commit 有更高的饱和度
    const saturationBoost = 1 + (0.5 / (1 + Math.exp(ageInDays / 90 - 2)));  // 1.0-1.5

    // 应用亮度和饱和度
    const adjustedR = Math.min(255, r * brightness * (r > (g + b) / 2 ? saturationBoost : 1));
    const adjustedG = Math.min(255, g * brightness * (g > (r + b) / 2 ? saturationBoost : 1));
    const adjustedB = Math.min(255, b * brightness * (b > (r + g) / 2 ? saturationBoost : 1));

    return `rgba(${adjustedR}, ${adjustedG}, ${adjustedB}, 0.7)`;
}

function getCommitDetails(commitHash, filePath, workspaceRoot) {
    return new Promise((resolve, reject) => {
        exec(`git show ${commitHash}:${filePath}`, { cwd: workspaceRoot }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

function findLineInDiff(diffContent, targetLine, filePath) {
    const targetLineContent = require('fs').readFileSync(filePath, 'utf8')
        .split('\n')[targetLine]?.trim();

    if (!targetLineContent) return 0;

    const lines = diffContent.split('\n');
    let inCurrentFile = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('diff --git')) {
            inCurrentFile = false;
            continue;
        }
        if (line.startsWith('+++')) {
            inCurrentFile = true;
            continue;
        }
        if (inCurrentFile && line.startsWith('+') && line.substring(1).trim() === targetLineContent) {
            return i;
        }
    }
    return 0;
}

async function activate(context) {
    // 添加编辑器切换事件监听
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (!editor) return;

            // 如果切换到 diff 预览窗口，不做任何处理
            if (editor.document.uri.scheme === 'git-commit') return;

            const editorKey = editor.document.uri.toString();
            const currentState = editorBlameStates.get(editorKey);

            if (currentState?.shouldShow) {
                // 如果该编辑器应该显示 blame 信息
                const workspaceRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
                if (!workspaceRoot) return;

                // 重新获取并显示 blame 信息
                getGitBlame(editor.document.uri.fsPath, workspaceRoot).then(blameInfo => {
                    // 创建新的装饰器
                    if (currentBlameDecorationType) {
                        currentBlameDecorationType.dispose();
                    }
                    currentBlameDecorationType = vscode.window.createTextEditorDecorationType({
                        isWholeLine: true,
                    });

                    // 创建装饰
                    const decorations = blameInfo.map((info, index) => {
                        const shortHash = info.commit.substring(0, 6);
                        const authorName = info.author || 'Unknown';
                        const author = authorName.length > 9
                            ? authorName.substring(0, 9)
                            : authorName.padEnd(9, '\u202F');
                        const time = (info.time || 'Unknown');
                        const timestamp = new Date(info.time).getTime() / 1000;

                        return {
                            range: new vscode.Range(index, 0, index, 0),
                            renderOptions: {
                                before: {
                                    margin: '0 1em 0 0',
                                    backgroundColor: generateColorFromHash(info.commit, timestamp),
                                    color: '#aaa',
                                    contentText: `${shortHash} ${author} ${time}`,
                                    fontFamily: 'Iosevka Nerd Font'
                                }
                            }
                        };
                    });

                    // 应用装饰器
                    editor.setDecorations(currentBlameDecorationType, decorations);
                    currentBlameInfo = blameInfo;
                });
            } else {
                // 如果该编辑器不应该显示 blame 信息
                if (currentBlameDecorationType) {
                    currentBlameDecorationType.dispose();
                    currentBlameDecorationType = null;
                    currentBlameInfo = null;
                }
            }
        })
    );

    let showCommitDisposable = vscode.commands.registerCommand('showCommit', async () => {
        try {
            const check = checkEditorAndWorkspace();
            if (!check) return;
            const { editor, workspaceRoot } = check;

            if (!currentBlameInfo || !currentBlameDecorationType) return;

            const line = editor.selection.active.line;
            const lineBlame = currentBlameInfo[line];
            if (!lineBlame) return;

            // 获取当前行的内容
            const currentLineContent = editor.document.lineAt(line).text.trim();

            // 获取当前 commit 和父 commit 的文件内容
            const relativePath = path.relative(workspaceRoot, editor.document.uri.fsPath);
            const parentCommit = `${lineBlame.commit}^`;

            const [currentContent, parentContent] = await Promise.all([
                getCommitDetails(lineBlame.commit, relativePath, workspaceRoot),
                getCommitDetails(parentCommit, relativePath, workspaceRoot).catch(() => '')
            ]);

            // 创建临时文件 URI
            const currentUri = vscode.Uri.parse(`git-commit:${lineBlame.commit}/${relativePath}`);
            const parentUri = vscode.Uri.parse(`git-commit:${parentCommit}/${relativePath}`);

            const provider = {
                provideTextDocumentContent(uri) {
                    const isParent = uri.path.includes(parentCommit);
                    return isParent ? parentContent : currentContent;
                }
            };

            context.subscriptions.push(
                vscode.workspace.registerTextDocumentContentProvider('git-commit', provider)
            );

            // 使用 VS Code 的 diff 编辑器
            const diffEditor = await vscode.commands.executeCommand('vscode.diff',
                parentUri,                    // 左边：父 commit
                currentUri,                   // 右边：当前 commit
                `${lineBlame.commit.substring(0, 8)} - ${lineBlame.summary}` // 标题
            );

            // 等待右侧编辑器准备就绪
            const rightEditor = await new Promise(resolve => {
                const interval = setInterval(() => {
                    const editor = vscode.window.visibleTextEditors.find(e =>
                        e.document.uri.toString() === currentUri.toString()
                    );
                    if (editor) {
                        clearInterval(interval);
                        resolve(editor);
                    }
                }, 100);
            });

            // 定位到相应行并滚动到可见区域
            if (rightEditor) {
                // 在 commit 内容中查找匹配的行
                const lines = currentContent.split('\n');
                let targetLine = line;

                // 在当前行附近查找相同内容的行
                const searchRange = 50;  // 搜索范围
                const start = Math.max(0, line - searchRange);
                const end = Math.min(lines.length, line + searchRange);

                for (let i = start; i < end; i++) {
                    if (lines[i].trim() === currentLineContent) {
                        targetLine = i;
                        break;
                    }
                }

                const position = new vscode.Position(targetLine, 0);
                rightEditor.selection = new vscode.Selection(position, position);
                rightEditor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }

        } catch (error) {
            vscode.window.showErrorMessage(`无法显示 commit 信息: ${error.message}`);
        }
    });

    let disposable = vscode.commands.registerCommand('openGitHubUrl', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('没有打开的文件');
                return;
            }

            // 检查是否在 diff 预览窗口中
            if (editor.document.uri.scheme === 'git-commit') {
                // 从 URI 中提取 commit hash
                const pathParts = editor.document.uri.path.split('/');
                const commitHash = pathParts[0].replace('.diff', '');  // 使用第一个部分作为 commit hash

                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!workspaceRoot) {
                    vscode.window.showErrorMessage('无法确定工作区根目录');
                    return;
                }

                const gitUrl = await getGitConfig(workspaceRoot);
                const gitInfo = parseGitUrl(gitUrl);

                if (!gitInfo) {
                    vscode.window.showErrorMessage('无法解析 Git 仓库 URL');
                    return;
                }

                const githubUrl = `https://${gitInfo.domain}/${gitInfo.owner}/${gitInfo.repo}/commit/${commitHash}`;
                await vscode.env.openExternal(vscode.Uri.parse(githubUrl));
                return;
            }

            // 于普通文件，使用 checkEditorAndWorkspace
            const check = checkEditorAndWorkspace();
            if (!check) return;
            const { workspaceRoot } = check;

            const gitUrl = await getGitConfig(workspaceRoot);
            const gitInfo = parseGitUrl(gitUrl);

            if (!gitInfo) {
                vscode.window.showErrorMessage('无法解析 Git 仓库 URL');
                return;
            }

            const isDetached = await isDetachedHead(workspaceRoot);
            const ref = isDetached ? await getCurrentCommit(workspaceRoot) : await getCurrentBranch(workspaceRoot);
            const relativePath = path.relative(workspaceRoot, editor.document.uri.fsPath);

            const selection = editor.selection;
            let lineInfo = '';
            if (!selection.isEmpty) {
                lineInfo = selection.start.line === selection.end.line
                    ? `#L${selection.start.line + 1}`
                    : `#L${selection.start.line + 1}-L${selection.end.line + 1}`;
            }

            const githubUrl = `https://${gitInfo.domain}/${gitInfo.owner}/${gitInfo.repo}/blob/${ref}/${relativePath}${lineInfo}`;
            // 打开链接而不是复制
            await vscode.env.openExternal(vscode.Uri.parse(githubUrl));

        } catch (error) {
            vscode.window.showErrorMessage(`发生错误: ${error.message}`);
        }
    });

    let blameDisposable = vscode.commands.registerCommand('showGitBlame', async () => {
        try {
            const check = checkEditorAndWorkspace();
            if (!check) return;
            const { editor, workspaceRoot } = check;

            // 检查文件是否在 git 中
            const relativePath = path.relative(workspaceRoot, editor.document.uri.fsPath);
            const isInGit = await new Promise((resolve) => {
                exec(`git ls-files --error-unmatch "${relativePath}"`,
                    { cwd: workspaceRoot },
                    (error) => {
                        resolve(!error);
                    }
                );
            });

            if (!isInGit) {
                vscode.window.showWarningMessage('此文件不在 Git 仓库中，无法显示 blame 信息');
                return;
            }

            const editorKey = editor.document.uri.toString();
            const currentState = editorBlameStates.get(editorKey) || { shouldShow: false };

            if (currentState.shouldShow) {
                // 如果当前状态是显示，则隐藏
                if (currentBlameDecorationType) {
                    currentBlameDecorationType.dispose();
                    currentBlameDecorationType = null;
                    currentBlameInfo = null;
                }
                currentState.shouldShow = false;
            } else {
                // 如果当前状态是隐藏，则显示
                const blameInfo = await getGitBlame(editor.document.uri.fsPath, workspaceRoot);
                let maxAuthorWidth = 0;
                let maxTimeWidth = 0;

                blameInfo.forEach(info => {
                    const authorLen = (info.author || 'Unknown').length;
                    maxAuthorWidth = Math.max(maxAuthorWidth, authorLen);
                    maxTimeWidth = Math.max(maxTimeWidth, (info.time || 'Unknown').length);
                });

                const decorations = blameInfo.map((info, index) => {
                    const shortHash = info.commit.substring(0, 6);
                    const authorName = info.author || 'Unknown';
                    const author = authorName.length > 9
                        ? authorName.substring(0, 9)
                        : authorName.padEnd(9, '\u202F');
                    const time = (info.time || 'Unknown').padEnd(maxTimeWidth);

                    const timestamp = new Date(info.time).getTime() / 1000;

                    return {
                        range: new vscode.Range(index, 0, index, 0),
                        renderOptions: {
                            before: {
                                margin: '0 1em 0 0',
                                backgroundColor: generateColorFromHash(info.commit, timestamp),
                                color: '#aaa',
                                contentText: `${shortHash} ${author} ${time}`,
                                fontFamily: 'Iosevka Nerd Font'
                            }
                        }
                    };
                });

                currentBlameDecorationType = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                });

                editor.setDecorations(currentBlameDecorationType, decorations);
                currentBlameInfo = blameInfo;
                currentState.shouldShow = true;
            }

            editorBlameStates.set(editorKey, currentState);

        } catch (error) {
            vscode.window.showErrorMessage(`Git blame 错误: ${error.message}`);
            if (currentBlameDecorationType) {
                currentBlameDecorationType.dispose();
                currentBlameDecorationType = null;
                currentBlameInfo = null;
            }
        }
    });

    // 添加命令别名
    context.subscriptions.push(
        vscode.commands.registerCommand('github-file-url.openGitHubUrl', () =>
            vscode.commands.executeCommand('openGitHubUrl')),
        vscode.commands.registerCommand('github-file-url.showGitBlame', () =>
            vscode.commands.executeCommand('showGitBlame')),
        vscode.commands.registerCommand('github-file-url.showCommit', () =>
            vscode.commands.executeCommand('showCommit'))
    );

    context.subscriptions.push(disposable, blameDisposable, showCommitDisposable);
}

function deactivate() {
    // 清理所有编辑器的装饰器
    for (const state of editorBlameStates.values()) {
        state.decorationType.dispose();
    }
    editorBlameStates.clear();

    // 清理装饰器
    if (currentBlameDecorationType) {
        currentBlameDecorationType.dispose();
    }
    Object.values(decorationTypes).forEach(type => {
        if (type) type.dispose();
    });
    // 清理缓存
    cache.gitConfig = null;
    cache.gitInfo = null;
    cache.commitDetails.clear();
    cache.blameInfo.clear();
}

module.exports = {
    activate,
    deactivate
};