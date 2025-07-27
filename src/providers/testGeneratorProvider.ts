import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { OpenAIService } from '../services/openaiService';
import { WebviewMessage, ChatMessage } from '../types';

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
                    case 'chat':
                        await this.handleChatMessage(panel, message);
                        break;
                    case 'generate':
                        if (message.text) {
                            await this.handleGenerateTests(panel, message.text, message.conversationHistory);
                        }
                        break;
                    case 'generateTests':
                        if (message.code) {
                            await this.handleGenerateTests(panel, message.code, message.conversationHistory);
                        }
                        break;
                    case 'saveTests':
                        if (message.tests && message.className) {
                            await this.handleSaveTests(message.tests, message.className);
                        }
                        break;
                    case 'copyToClipboard':
                        if (message.text) {
                            await this.handleCopyToClipboard(message.text);
                        }
                        break;
                    case 'openSettings':
                        await this.handleOpenSettings();
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async handleChatMessage(panel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            const content = message.content;
            const type = message.type || 'text';
            const conversationHistory = message.conversationHistory || [];

            // Determine the type of request with priority order
            const isCodeRequest = this.isCodeGenerationRequest(content);
            const isErrorFix = type === 'error' || (!isCodeRequest && this.isErrorFixRequest(content));

            let response: string;

            console.log('Request analysis:', { isCodeRequest, isErrorFix, type, contentLength: content.length });

            if (isCodeRequest) {
                // PRIORITY: Code generation request
                const javaCode = this.extractJavaCode(content);
                
                if (javaCode) {
                    console.log('Extracted Java code, generating tests...');
                    response = await this.openaiService.generateTests(javaCode, undefined, conversationHistory);
                } else {
                    console.log('No Java code found, treating as general request...');
                    response = await this.openaiService.generateTests(content, undefined, conversationHistory);
                }
            } else if (isErrorFix && conversationHistory.length > 0) {
                // SECONDARY: Error fix request (only if there's conversation history)
                console.log('Processing error fix request...');
                const { originalCode, errorMessage } = this.extractErrorContext(content, conversationHistory);
                
                if (originalCode && errorMessage) {
                    response = await this.openaiService.fixTestsWithError(
                        originalCode, 
                        this.extractGeneratedTests(conversationHistory),
                        errorMessage, 
                        conversationHistory
                    );
                } else {
                    console.log('Insufficient context for error fix, falling back to general generation...');
                    response = await this.openaiService.generateTests(content, undefined, conversationHistory);
                }
            } else {
                // DEFAULT: General test generation
                console.log('Processing as general test generation request...');
                response = await this.openaiService.generateTests(content, undefined, conversationHistory);
            }
            
            // Validate that the response contains actual test code
            if (this.isValidJUnitResponse(response)) {
                panel.webview.postMessage({ 
                    command: 'response', 
                    text: response 
                });
            } else {
                // If response doesn't look like test code, send error message
                panel.webview.postMessage({ 
                    command: 'error', 
                    text: 'Failed to generate proper JUnit test code. Please try again with clear Java source code.'
                });
            }

        } catch (error) {
            console.error('Error handling chat message:', error);
            panel.webview.postMessage({ 
                command: 'error', 
                text: error instanceof Error ? error.message : 'Unknown error occurred'
            });
        }
    }

    private isCodeGenerationRequest(content: string): boolean {
        // Check for explicit test generation requests
        const testKeywords = ['generate test', 'create test', 'junit test', 'test case', 'unit test', 'write test'];
        const hasTestKeywords = testKeywords.some(keyword => content.toLowerCase().includes(keyword));
        
        // Check if content contains Java code patterns
        const javaPatterns = [
            /class\s+\w+/i,           // Java class declaration
            /public\s+class/i,        // Public class
            /import\s+java/i,         // Java imports
            /public\s+void/i,         // Public methods
            /private\s+\w+/i,         // Private fields
            /```java/i                // Java code blocks
        ];
        
        const hasJavaCode = javaPatterns.some(pattern => pattern.test(content));
        
        // If it has Java code OR explicit test keywords, consider it a code generation request
        return hasTestKeywords || hasJavaCode;
    }

    private isErrorFixRequest(content: string): boolean {
        // Only consider it an error fix request if it explicitly mentions fixing/correcting previous responses
        const errorKeywords = [
            'fix this test',
            'correct the test',
            'error in the test',
            'test is failing',
            'compilation error',
            'runtime error',
            'fix the junit',
            'test has error',
            'error message:',
            'exception in test',
            'broken test'
        ];
        
        const lowerContent = content.toLowerCase();
        return errorKeywords.some(keyword => lowerContent.includes(keyword));
    }

    private extractJavaCode(content: string): string | null {
        // Extract code from markdown code blocks
        const codeBlockMatch = content.match(/```(?:java)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Check if the entire content looks like Java code
        if (content.includes('class ') || content.includes('public ') || content.includes('import ')) {
            return content.trim();
        }

        return null;
    }

    private extractErrorContext(content: string, conversationHistory: ChatMessage[]): { originalCode: string; errorMessage: string } {
        let originalCode = '';
        let errorMessage = '';

        // Extract error from current message
        const errorMatch = content.match(/```\s*([\s\S]*?)```/);
        if (errorMatch) {
            errorMessage = errorMatch[1].trim();
        } else {
            errorMessage = content;
        }

        // Find the most recent code generation in conversation history
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const message = conversationHistory[i];
            if (message.role === 'user' && message.type === 'text') {
                const code = this.extractJavaCode(message.content);
                if (code) {
                    originalCode = code;
                    break;
                }
            }
        }

        return { originalCode, errorMessage };
    }

    private extractGeneratedTests(conversationHistory: ChatMessage[]): string {
        // Find the most recent assistant message with code
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const message = conversationHistory[i];
            if (message.role === 'assistant' && message.type === 'code') {
                return message.content;
            }
        }
        return '';
    }

    private isValidJUnitResponse(response: string): boolean {
        const trimmed = response.trim();
        
        // Must start with import, package, or class
        if (!/^\s*(import|package|class)/i.test(trimmed)) {
            return false;
        }
        
        // Check for essential JUnit patterns
        const essentialPatterns = [
            /import.*junit/i,           // JUnit import
            /@Test/,                    // Test annotation  
            /class\s+\w+Test/i,         // Test class
            /void\s+test\w+/i,          // Test method
            /assert\w+/i                // Assertions
        ];
        
        const foundPatterns = essentialPatterns.filter(pattern => pattern.test(response)).length;
        
        // Check for explanation text that shouldn't be there
        const explanationPatterns = [
            /^(Here|This|I|The|Let|Now|You|We)\s/i,
            /However, I can generate/i,
            /This is a basic test/i,
            /More tests can be added/i,
            /```/,
            /misunderstanding/i,
            /provided code is/i,
            /basic test class/i,
            /example/i
        ];
        
        const hasExplanation = explanationPatterns.some(pattern => pattern.test(response));
        
        return foundPatterns >= 4 && !hasExplanation && response.length > 300;
    }

    private async handleCopyToClipboard(text: string): Promise<void> {
        try {
            await vscode.env.clipboard.writeText(text);
            vscode.window.showInformationMessage('Code copied to clipboard!');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            vscode.window.showErrorMessage('Failed to copy to clipboard');
        }
    }

    private async handleOpenSettings(): Promise<void> {
        vscode.commands.executeCommand('workbench.action.openSettings', 'junit-test-generator');
    }

    private async handleGenerateTests(panel: vscode.WebviewPanel, code: string, conversationHistory?: ChatMessage[]): Promise<void> {
        try {
            panel.webview.postMessage({ command: 'generationStarted' });
            
            // Send code directly to AI without validation
            const tests = await this.openaiService.generateTests(code, undefined, conversationHistory);
            
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
        
        // Only preload if content exists (removed test file validation)
        if (content) {
            panel.webview.postMessage({
                command: 'preloadCode',
                code: content,
                fileName: fileName
            });
            
            // Show notification to user
            if (fileName) {
                vscode.window.showInformationMessage(`Java code from ${fileName} loaded automatically`);
            }
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

    public refreshApiKey(): void {
        this.openaiService.refreshApiKey();
    }

    public checkServiceStatus(): void {
        const status = this.openaiService.getServiceStatus();
        const statusMessage = status.isConfigured 
            ? `✅ ${status.provider} is configured and ready${status.model ? ` (Model: ${status.model})` : ''}`
            : `❌ ${status.provider} is not properly configured. Please check your settings.`;
        
        vscode.window.showInformationMessage(statusMessage);
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
