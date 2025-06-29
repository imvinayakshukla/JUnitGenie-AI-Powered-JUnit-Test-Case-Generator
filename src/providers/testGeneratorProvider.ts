import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { OpenAIService } from '../services/openaiService';
import { JavaParser } from '../utils/javaParser';
import { WebviewMessage } from '../types';

export class TestGeneratorProvider {
    private openaiService: OpenAIService;

    constructor(private context: vscode.ExtensionContext) {
        this.openaiService = new OpenAIService();
    }

    async showTestGeneratorPanel(uri?: vscode.Uri): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'junitTestGenerator',
            'JUnit Test Generator',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
                ],
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getWebviewContent(panel.webview);
        this.setupWebviewMessageHandler(panel);
        await this.preloadFileContent(panel, uri);
    }

    private getWebviewContent(webview: vscode.Webview): string {
        const htmlPath = path.join(this.context.extensionPath, 'resources', 'webview', 'index.html');
        
        if (!fs.existsSync(htmlPath)) {
            // Fallback to inline HTML if file doesn't exist
            return this.getInlineHTML(webview);
        }

        let html = fs.readFileSync(htmlPath, 'utf8');

        // Replace resource URIs with webview URIs
        const resourceUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
        );
        
        html = html.replace(/\{\{resourceUri\}\}/g, resourceUri.toString());
        return html;
    }

    private getInlineHTML(webview: vscode.Webview): string {
        const nonce = this.getNonce();
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>JUnit Test Generator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            overflow: hidden;
        }
        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: 16px;
        }
        .header {
            margin-bottom: 16px;
        }
        .header h1 {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .input-section {
            margin-bottom: 16px;
        }
        .input-section label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
        }
        .code-input {
            width: 100%;
            height: 200px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 12px;
            resize: vertical;
        }
        .button-section {
            margin-bottom: 16px;
        }
        .generate-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
        }
        .generate-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .generate-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .output-section {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .output-section label {
            margin-bottom: 8px;
            font-weight: 500;
        }
        .code-output {
            flex: 1;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-editor-foreground);
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 12px;
            resize: none;
            overflow-y: auto;
        }
        .save-btn {
            margin-top: 8px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
        }
        .save-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .loading {
            text-align: center;
            padding: 20px;
            font-style: italic;
        }
        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 8px;
            border-radius: 2px;
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 JUnit Test Generator</h1>
        </div>
        
        <div class="input-section">
            <label for="javaCode">Java Code:</label>
            <textarea id="javaCode" class="code-input" placeholder="Paste your Java code here..."></textarea>
        </div>
        
        <div class="button-section">
            <button id="generateBtn" class="generate-btn">Generate Tests</button>
        </div>
        
        <div class="output-section">
            <label for="generatedTests">Generated Tests:</label>
            <textarea id="generatedTests" class="code-output" readonly placeholder="Generated test code will appear here..."></textarea>
            <button id="saveBtn" class="save-btn" style="display: none;">Save Test File</button>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const generateBtn = document.getElementById('generateBtn');
        const saveBtn = document.getElementById('saveBtn');
        const javaCodeInput = document.getElementById('javaCode');
        const generatedTestsOutput = document.getElementById('generatedTests');

        generateBtn.addEventListener('click', () => {
            const code = javaCodeInput.value.trim();
            if (!code) {
                alert('Please enter some Java code first.');
                return;
            }

            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
            generatedTestsOutput.value = 'Generating tests, please wait...';
            saveBtn.style.display = 'none';

            vscode.postMessage({
                command: 'generateTests',
                code: code
            });
        });

        saveBtn.addEventListener('click', () => {
            const tests = generatedTestsOutput.value;
            const code = javaCodeInput.value;
            
            // Extract class name for default filename
            const classMatch = code.match(/(?:public\\s+)?class\\s+(\\w+)/);
            const className = classMatch ? classMatch[1] : 'Unknown';

            vscode.postMessage({
                command: 'saveTests',
                tests: tests,
                className: className
            });
        });

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'preloadCode':
                    javaCodeInput.value = message.code;
                    break;
                    
                case 'testsGenerated':
                    generatedTestsOutput.value = message.tests;
                    generateBtn.disabled = false;
                    generateBtn.textContent = 'Generate Tests';
                    saveBtn.style.display = 'inline-block';
                    break;
                    
                case 'error':
                    generatedTestsOutput.value = 'Error: ' + message.message;
                    generateBtn.disabled = false;
                    generateBtn.textContent = 'Generate Tests';
                    saveBtn.style.display = 'none';
                    break;
                    
                case 'generationStarted':
                    // Already handled in click event
                    break;
            }
        });
    </script>
</body>
</html>`;
    }

    private setupWebviewMessageHandler(panel: vscode.WebviewPanel): void {
        panel.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'generate':
                        if (message.text) {
                            await this.handleGenerateTests(panel, message.text);
                        }
                        break;
                    case 'generateTests':
                        if (message.code) {
                            await this.handleGenerateTests(panel, message.code);
                        }
                        break;
                    case 'saveTests':
                        if (message.tests && message.className) {
                            await this.handleSaveTests(message.tests, message.className);
                        }
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async handleGenerateTests(panel: vscode.WebviewPanel, code: string): Promise<void> {
        try {
            panel.webview.postMessage({ command: 'generationStarted' });
            
            // Validate Java code
            if (!JavaParser.isValidJavaCode(code)) {
                throw new Error('Invalid Java code structure. Please check your code syntax.');
            }

            // Check if it's already a test file
            if (JavaParser.isTestFile(code)) {
                const proceed = await vscode.window.showWarningMessage(
                    'This appears to be a test file. Do you want to generate tests anyway?',
                    'Yes', 'No'
                );
                if (proceed !== 'Yes') {
                    panel.webview.postMessage({ 
                        command: 'error', 
                        message: 'Test generation cancelled.'
                    });
                    return;
                }
            }

            const className = JavaParser.extractClassName(code);
            const tests = await this.openaiService.generateTests(code, className || undefined);
            
            panel.webview.postMessage({ 
                command: 'response', 
                text: tests 
            });

        } catch (error) {
            console.error('Error generating tests:', error);
            panel.webview.postMessage({ 
                command: 'error', 
                text: error instanceof Error ? error.message : 'Unknown error occurred'
            });
        }
    }

    private async preloadFileContent(panel: vscode.WebviewPanel, uri?: vscode.Uri): Promise<void> {
        let content: string = '';
        let fileName: string = '';
        
        if (uri) {
            // File was right-clicked, load its content
            try {
                const document = await vscode.workspace.openTextDocument(uri);
                if (document.languageId === 'java') {
                    content = document.getText();
                    fileName = path.basename(uri.fsPath);
                }
            } catch (error) {
                console.error('Error reading file from URI:', error);
                vscode.window.showErrorMessage(`Failed to read file: ${path.basename(uri.fsPath)}`);
            }
        } else {
            // No URI provided, check active editor
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'java') {
                content = editor.document.getText();
                fileName = path.basename(editor.document.fileName);
            }
        }
        
        // Only preload if it's valid Java content and not already a test file
        if (content && !JavaParser.isTestFile(content)) {
            panel.webview.postMessage({
                command: 'preloadCode',
                code: content,
                fileName: fileName
            });
            
            // Show notification to user
            if (fileName) {
                vscode.window.showInformationMessage(`Java code from ${fileName} loaded automatically`);
            }
        } else if (content && JavaParser.isTestFile(content)) {
            vscode.window.showWarningMessage(`${fileName} appears to be a test file. Please select a source Java file instead.`);
        }
    }

    private async handleSaveTests(tests: string, className: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const testFileName = `${className}Test.java`;
            const defaultPath = path.join(workspaceFolder.uri.fsPath, 'src', 'test', 'java');
            
            // Ensure test directory exists
            if (!fs.existsSync(defaultPath)) {
                fs.mkdirSync(defaultPath, { recursive: true });
            }

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(path.join(defaultPath, testFileName)),
                filters: { 'Java files': ['java'] }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(tests));
                vscode.window.showInformationMessage(`Test file saved: ${path.basename(uri.fsPath)}`);
                
                // Open the generated test file
                const document = await vscode.workspace.openTextDocument(uri);
                vscode.window.showTextDocument(document);
            }
        } catch (error) {
            console.error('Error saving test file:', error);
            vscode.window.showErrorMessage(
                `Failed to save test file: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
