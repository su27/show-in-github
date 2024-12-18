const vscode = require('vscode');
const { exec } = require('child_process');
const path = require('path');

// 添加全局变量
let currentBlameDecorationType = null;

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
    // 支持 SSH 和 HTTPS 格式的 URL
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
        exec('git rev-parse --abbrev-ref HEAD', { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

function getCurrentCommit(workspaceRoot) {
    return new Promise((resolve, reject) => {
        exec('git rev-parse HEAD', { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
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
        exec(`git blame --line-porcelain "${filePath}"`, { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }

            // 解析 git blame 输出
            const lines = stdout.split('\n');
            const blameInfo = [];
            let currentCommit = null;
            let currentLine = null;

            lines.forEach(line => {
                if (line.match(/^[0-9a-f]{40}/)) {
                    // 新的 blame 条目开始
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
                    // 手动格式化时间为 YYYY-MM-DD HH:mm:ss
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

            // 确保最后一行也被添加
            if (currentLine) {
                blameInfo.push(currentLine);
            }

            resolve(blameInfo);
        });
    });
}

// 修改颜色生成函数
function generateColorFromHash(hash) {
    // 使用 hash 的前 6 位作为颜色基础
    const baseColor = hash.substring(0, 6);
    // 调整颜色范围，使背景色更深
    const r = parseInt(baseColor.substring(0, 2), 16) % 100 + 30;  // 30-130
    const g = parseInt(baseColor.substring(2, 4), 16) % 100 + 30;  // 30-130
    const b = parseInt(baseColor.substring(4, 6), 16) % 100 + 30;  // 30-130
    // 使用更低的透明度使颜色更鲜明
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
}

// 加一个函数来获取 commit 的详细信息
function getCommitDetails(commitHash, workspaceRoot) {
    return new Promise((resolve, reject) => {
        exec(`git show ${commitHash}`, { cwd: workspaceRoot }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

async function activate(context) {
    console.log('插件 "github-file-url" 已激活');

    let disposable = vscode.commands.registerCommand('github-file-url.copyGitHubUrl', async () => {
        try {
            // 获取当前文件
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('没有打开的文件');
                return;
            }

            // 检查是否在 diff 预览窗口中
            if (editor.document.uri.scheme === 'git-commit') {
                // 从 URI 中提取 commit hash
                const commitHash = editor.document.uri.path.split('/').pop().replace('.diff', '');

                // 获取任意一个工作区的根目录
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!workspaceRoot) {
                    vscode.window.showErrorMessage('无法确定工作区根目录');
                    return;
                }

                // 获取 Git 配置
                const gitUrl = await getGitConfig(workspaceRoot);
                const gitInfo = parseGitUrl(gitUrl);

                if (!gitInfo) {
                    vscode.window.showErrorMessage('无法解析 Git 仓库 URL');
                    return;
                }

                // 构建 commit URL
                const githubUrl = `https://${gitInfo.domain}/${gitInfo.owner}/${gitInfo.repo}/commit/${commitHash}`;
                await vscode.env.clipboard.writeText(githubUrl);
                vscode.window.showInformationMessage('Commit 链接已复制到剪贴板！');
                return;
            }

            // 原有的文件 URL 复制逻辑
            const workspaceRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('无法确定工作区根目录');
                return;
            }

            // 获取 Git 配置
            const gitUrl = await getGitConfig(workspaceRoot);
            const gitInfo = parseGitUrl(gitUrl);

            if (!gitInfo) {
                vscode.window.showErrorMessage('无法解析 Git 仓库 URL');
                return;
            }

            // 获取当前分支或 commit
            const isDetached = await isDetachedHead(workspaceRoot);
            let ref;
            if (isDetached) {
                ref = await getCurrentCommit(workspaceRoot);
            } else {
                ref = await getCurrentBranch(workspaceRoot);
            }

            // 获取相对路径
            const relativePath = path.relative(
                workspaceRoot,
                editor.document.uri.fsPath
            );

            // 获取选中的行号
            const selection = editor.selection;
            let lineInfo = '';
            if (!selection.isEmpty) {
                if (selection.start.line === selection.end.line) {
                    lineInfo = `#L${selection.start.line + 1}`;
                } else {
                    lineInfo = `#L${selection.start.line + 1}-L${selection.end.line + 1}`;
                }
            }

            // 构建 GitHub URL
            const githubUrl = `https://${gitInfo.domain}/${gitInfo.owner}/${gitInfo.repo}/blob/${ref}/${relativePath}${lineInfo}`;

            // 复制到剪贴板
            await vscode.env.clipboard.writeText(githubUrl);
            vscode.window.showInformationMessage('GitHub 链接已复制到剪贴板！');

        } catch (error) {
            vscode.window.showErrorMessage(`发生错误: ${error.message}`);
        }
    });

    // 添加一个变量来存储当前的 blame 信息
    let currentBlameInfo = null;

    // 修改 showGitBlame 命令
    let blameDisposable = vscode.commands.registerCommand('github-file-url.showGitBlame', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('没有打开的文件');
                return;
            }

            // 如果已经显示了 blame 信息，则清除它
            if (currentBlameDecorationType) {
                currentBlameDecorationType.dispose();
                currentBlameDecorationType = null;
                currentBlameInfo = null;
                return;
            }

            const workspaceRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('无法确定工作区根目录');
                return;
            }

            // 获取 git blame 信息
            const blameInfo = await getGitBlame(editor.document.uri.fsPath, workspaceRoot);

            // 计算最大宽度
            let maxAuthorWidth = 0;
            let maxTimeWidth = 0;

            // 找出最长的作者名长度
            blameInfo.forEach(info => {
                const authorLen = (info.author || 'Unknown').length;
                maxAuthorWidth = Math.max(maxAuthorWidth, authorLen);
                maxTimeWidth = Math.max(maxTimeWidth, (info.time || 'Unknown').length);
            });

            // 应用装饰器
            const decorations = blameInfo.map((info, index) => {
                const shortHash = info.commit.substring(0, 8);
                const authorName = info.author || 'Unknown';
                const author = authorName.length > maxAuthorWidth
                    ? authorName.substring(0, maxAuthorWidth)
                    : authorName.padEnd(maxAuthorWidth, '\u202F');  // 使用窄空格
                const time = (info.time || 'Unknown').padEnd(maxTimeWidth);

                // 为每个 commit 生成一个颜色
                const backgroundColor = generateColorFromHash(info.commit);

                return {
                    range: new vscode.Range(index, 0, index, 0),
                    renderOptions: {
                        before: {
                            margin: '0 1em 0 0',
                            backgroundColor,
                            color: '#aaa',
                            contentText: `${shortHash} ${author} ${time}`
                        }
                    }
                };
            });

            // 修改装饰器类型定义，移除通用的背景色
            currentBlameDecorationType = vscode.window.createTextEditorDecorationType({
                isWholeLine: true,
            });

            editor.setDecorations(currentBlameDecorationType, decorations);

            // 保存 blame 信息以供后续使用
            currentBlameInfo = blameInfo;

        } catch (error) {
            console.error('Git blame 错误:', error);
            vscode.window.showErrorMessage(`Git blame 错误: ${error.message}`);
            if (currentBlameDecorationType) {
                currentBlameDecorationType.dispose();
                currentBlameDecorationType = null;
                currentBlameInfo = null;
            }
        }
    });

    // 添加处理 commit 显示的命令
    let showCommitDisposable = vscode.commands.registerCommand('github-file-url.showCommit', async () => {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !currentBlameInfo || !currentBlameDecorationType) {
                return;
            }

            // 获取当前行号
            const line = editor.selection.active.line;

            // 获取对应的 blame 信息
            const lineBlame = currentBlameInfo[line];
            if (!lineBlame) {
                return;
            }

            const workspaceRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            if (!workspaceRoot) {
                return;
            }

            // 获取 commit 详细信息
            const commitDetails = await new Promise((resolve, reject) => {
                exec(`git show --patch --stat ${lineBlame.commit}`, { cwd: workspaceRoot }, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(stdout);
                });
            });

            // 创建一个临时的 URI 来显示 commit 信息
            const uri = vscode.Uri.parse(`git-commit:${lineBlame.commit}.diff`);

            // 注册一个文本文档内容提供器
            const provider = {
                provideTextDocumentContent(uri) {
                    return commitDetails;
                }
            };

            // 注册提供器
            context.subscriptions.push(
                vscode.workspace.registerTextDocumentContentProvider('git-commit', provider)
            );

            // 打开文档
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, {
                preview: true,  // 使用预览模式
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true,  // 保持焦点在原文件
                preview: true  // 确保是预览模式
            });

            // 设置为只读模式
            await vscode.languages.setTextDocumentLanguage(doc, 'diff');

        } catch (error) {
            vscode.window.showErrorMessage(`无法显示 commit 信息: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(blameDisposable);
    context.subscriptions.push(showCommitDisposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};