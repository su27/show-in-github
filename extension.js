const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

// 全局变量集中管理
let currentBlameDecorationType = null;
let currentBlameInfo = null;

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
    return new Promise((resolve, reject) => {
        exec('git config --get remote.origin.url', { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
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

            resolve(blameInfo);
        });
    });
}

function generateColorFromHash(hash, timestamp) {
    const baseColor = hash.substring(0, 6);
    const now = Date.now() / 1000;  // 当前时间戳（秒）
    const ageInDays = (now - timestamp) / (24 * 60 * 60);  // commit 的年龄（天）

    // 调整亮度范围：0.25-1.0，提高最暗的亮度
    const brightness = 0.25 + (0.75 / (1 + Math.exp(ageInDays / 180 - 2)));

    // 基础颜色，稍微提高基础亮度
    const r = parseInt(baseColor.substring(0, 2), 16) % 85 + 25;  // 25-110
    const g = parseInt(baseColor.substring(2, 4), 16) % 85 + 25;  // 25-110
    const b = parseInt(baseColor.substring(4, 6), 16) % 85 + 25;  // 25-110

    // 应用亮度系数，新的 commit 额外增加亮度
    const adjustedR = Math.min(255, r * brightness + (brightness > 0.7 ? 70 : 0));
    const adjustedG = Math.min(255, g * brightness + (brightness > 0.7 ? 70 : 0));
    const adjustedB = Math.min(255, b * brightness + (brightness > 0.7 ? 70 : 0));

    return `rgba(${adjustedR}, ${adjustedG}, ${adjustedB}, 0.7)`;
}

function getCommitDetails(commitHash, workspaceRoot) {
    return new Promise((resolve, reject) => {
        exec(`git show --patch --stat ${commitHash}`, { cwd: workspaceRoot }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });
}

function findLineInDiff(diffContent, targetLine, filePath) {
    const lines = diffContent.split('\n');
    let currentFile = null;
    let lineNumber = 0;
    let targetLineContent = null;

    // 首先获取目标行的内容
    try {
        targetLineContent = require('fs').readFileSync(filePath, 'utf8').split('\n')[targetLine].trim();
    } catch (error) {
        return 0;
    }

    // 遍历 diff 内容
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 查找文件头
        if (line.startsWith('diff --git')) {
            currentFile = null;
            lineNumber = 0;
            continue;
        }

        // 查找 +++ 行（新文件）
        if (line.startsWith('+++')) {
            currentFile = line;
            continue;
        }

        // 在找到文件头之后，开始计数
        if (currentFile) {
            if (line.startsWith('+') && line.substring(1).trim() === targetLineContent) {
                // 找到匹配的行
                return i;
            }
        }
    }

    return 0;
}

async function activate(context) {
    let disposable = vscode.commands.registerCommand('github-file-url.copyGitHubUrl', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('没有打开的文件');
                return;
            }

            // 检查是否在 diff 预览窗口中
            if (editor.document.uri.scheme === 'git-commit') {
                const commitHash = editor.document.uri.path.split('/').pop().replace('.diff', '');
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
                // 打开链接而不是复制
                await vscode.env.openExternal(vscode.Uri.parse(githubUrl));
                return;
            }

            // 对于普通文件，使用 checkEditorAndWorkspace
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

    let blameDisposable = vscode.commands.registerCommand('github-file-url.showGitBlame', async () => {
        try {
            const check = checkEditorAndWorkspace();
            if (!check) return;
            const { editor, workspaceRoot } = check;

            if (currentBlameDecorationType) {
                currentBlameDecorationType.dispose();
                currentBlameDecorationType = null;
                currentBlameInfo = null;
                return;
            }

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

                // 从时间字符串解析时间戳
                const timestamp = new Date(info.time).getTime() / 1000;

                return {
                    range: new vscode.Range(index, 0, index, 0),
                    renderOptions: {
                        before: {
                            margin: '0 1em 0 0',
                            backgroundColor: generateColorFromHash(info.commit, timestamp),
                            color: '#aaa',
                            contentText: `${shortHash} ${author} ${time}`
                        }
                    }
                };
            });

            currentBlameDecorationType = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
            });

            editor.setDecorations(currentBlameDecorationType, decorations);
            currentBlameInfo = blameInfo;

        } catch (error) {
            vscode.window.showErrorMessage(`Git blame 错误: ${error.message}`);
            if (currentBlameDecorationType) {
                currentBlameDecorationType.dispose();
                currentBlameDecorationType = null;
                currentBlameInfo = null;
            }
        }
    });

    let showCommitDisposable = vscode.commands.registerCommand('github-file-url.showCommit', async () => {
        try {
            const check = checkEditorAndWorkspace();
            if (!check) return;
            const { editor, workspaceRoot } = check;

            if (!currentBlameInfo || !currentBlameDecorationType) return;

            const line = editor.selection.active.line;
            const lineBlame = currentBlameInfo[line];
            if (!lineBlame) return;

            const commitDetails = await getCommitDetails(lineBlame.commit, workspaceRoot);
            const uri = vscode.Uri.parse(`git-commit:${lineBlame.commit}.diff`);

            const provider = {
                provideTextDocumentContent(uri) {
                    return commitDetails;
                }
            };

            context.subscriptions.push(
                vscode.workspace.registerTextDocumentContentProvider('git-commit', provider)
            );

            const doc = await vscode.workspace.openTextDocument(uri);
            const diffEditor = await vscode.window.showTextDocument(doc, {
                preview: true,
                viewColumn: vscode.ViewColumn.Beside
            });

            await vscode.languages.setTextDocumentLanguage(doc, 'diff');

            // 找到对应的改动行
            const diffLine = findLineInDiff(commitDetails, line, editor.document.uri.fsPath);

            // 创建一个选择，定位到对应行
            const position = new vscode.Position(diffLine, 0);
            diffEditor.selection = new vscode.Selection(position, position);

            // 确保该行在编辑器的可见区域内
            diffEditor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

        } catch (error) {
            vscode.window.showErrorMessage(`无法显示 commit 信息: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable, blameDisposable, showCommitDisposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};