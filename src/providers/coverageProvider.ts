import * as vscode from 'vscode';
import * as path from 'path';
import { JacocoService, ModuleCoverage, ProjectModule } from '../services/jacocoService';

export class CoverageProvider {
    private jacocoService: JacocoService;

    constructor(private context: vscode.ExtensionContext) {
        this.jacocoService = new JacocoService();
    }

    async showCoveragePanel(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'coverageAnalysis',
            'Code Coverage Analysis',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
                ],
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getCoverageWebviewContent(panel.webview);
        this.setupCoverageWebviewMessageHandler(panel);
    }

    private getCoverageWebviewContent(webview: vscode.Webview): string {
        const resourceUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
        );

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Coverage Analysis</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 100%;
                }
                .header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .header-icon {
                    width: 24px;
                    height: 24px;
                    margin-right: 10px;
                    color: var(--vscode-foreground);
                }
                .header-title {
                    font-size: 1.4em;
                    font-weight: bold;
                }
                .actions {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .btn:disabled {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    cursor: not-allowed;
                }
                .btn-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .btn-secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .loading {
                    display: none;
                    text-align: center;
                    padding: 40px;
                    color: var(--vscode-descriptionForeground);
                }
                .loading.show {
                    display: block;
                }
                .spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--vscode-progressBar-background);
                    border-radius: 50%;
                    border-top-color: var(--vscode-progressBar-foreground);
                    animation: spin 1s ease-in-out infinite;
                    margin-right: 10px;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .coverage-results {
                    display: none;
                }
                .coverage-results.show {
                    display: block;
                }
                .module-card {
                    background-color: var(--vscode-editor-selectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    margin-bottom: 15px;
                    padding: 15px;
                }
                .module-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    cursor: pointer;
                }
                .module-name {
                    font-weight: bold;
                    font-size: 1.1em;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .expand-icon {
                    transition: transform 0.2s;
                }
                .expand-icon.expanded {
                    transform: rotate(90deg);
                }
                .coverage-badge {
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-weight: bold;
                    font-size: 0.9em;
                }
                .coverage-high { background-color: #28a745; color: white; }
                .coverage-medium { background-color: #ffc107; color: black; }
                .coverage-low { background-color: #dc3545; color: white; }
                .file-details {
                    margin-top: 10px;
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease-out;
                }
                .file-details.expanded {
                    max-height: 1000px;
                }
                .file-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid var(--vscode-widget-border);
                }
                .file-name {
                    flex: 1;
                    font-family: monospace;
                }
                .file-stats {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.9em;
                }
                .uncovered-lines {
                    color: var(--vscode-errorForeground);
                    font-size: 0.8em;
                    margin-top: 4px;
                    font-family: monospace;
                }
                .no-coverage {
                    text-align: center;
                    padding: 40px;
                    color: var(--vscode-descriptionForeground);
                }
                .summary {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding: 15px;
                    margin-bottom: 20px;
                    border-radius: 0 4px 4px 0;
                }
                .summary-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 10px;
                }
                .stat-item {
                    text-align: center;
                }
                .stat-value {
                    font-size: 1.5em;
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }
                .stat-label {
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <svg class="header-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L13.5 9H21L15.5 13.5L17 21L12 16L7 21L8.5 13.5L3 9H10.5L12 2Z"/>
                    </svg>
                    <span class="header-title">📊 Code Coverage Analysis</span>
                </div>

                <div class="actions">
                    <button class="btn" id="run-coverage-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 4.42 3.58 8 8 8 4.42 0 8-3.58 8-8 0-4.42-3.58-8-8-8zM6 12L2 8l1.41-1.41L6 9.17 12.59 2.58 14 4l-8 8z"/>
                        </svg>
                        Run Coverage Analysis
                    </button>
                    <button class="btn" id="select-module-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM11 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 17 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 11a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 15.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
                        </svg>
                        Select Module
                    </button>
                    <button class="btn btn-secondary" id="clear-coverage-btn" disabled>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
                        </svg>
                        Clear Coverage
                    </button>
                    <button class="btn btn-secondary" id="refresh-btn">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                        Refresh
                    </button>
                </div>

                <div class="loading" id="loading">
                    <div class="spinner"></div>
                    Running JaCoCo coverage analysis...
                </div>

                <div class="coverage-results" id="coverage-results">
                    <div class="summary" id="summary" style="display: none;">
                        <h3>📈 Coverage Summary</h3>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <div class="stat-value" id="total-modules">0</div>
                                <div class="stat-label">Modules</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" id="total-files">0</div>
                                <div class="stat-label">Files</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" id="overall-coverage">0%</div>
                                <div class="stat-label">Overall Coverage</div>
                            </div>
                        </div>
                    </div>

                    <div id="modules-container"></div>
                    
                    <div class="no-coverage" id="no-coverage">
                        <p>No coverage data available.</p>
                        <p>Click "Run Coverage Analysis" to generate a JaCoCo report.</p>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                // DOM elements
                const runCoverageBtn = document.getElementById('run-coverage-btn');
                const selectModuleBtn = document.getElementById('select-module-btn');
                const clearCoverageBtn = document.getElementById('clear-coverage-btn');
                const refreshBtn = document.getElementById('refresh-btn');
                const loading = document.getElementById('loading');
                const coverageResults = document.getElementById('coverage-results');
                const summary = document.getElementById('summary');
                const modulesContainer = document.getElementById('modules-container');
                const noCoverage = document.getElementById('no-coverage');

                // Event listeners
                runCoverageBtn.addEventListener('click', () => {
                    showLoading();
                    vscode.postMessage({ command: 'runCoverage' });
                });

                selectModuleBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'selectModule' });
                });

                clearCoverageBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'clearCoverage' });
                    clearResults();
                });

                refreshBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'refreshCoverage' });
                });

                // Message handler
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'coverageResults':
                            hideLoading();
                            displayCoverageResults(message.data);
                            break;
                        case 'coverageError':
                            hideLoading();
                            showError(message.error);
                            break;
                        case 'coverageCleared':
                            clearResults();
                            break;
                    }
                });

                function showLoading() {
                    loading.classList.add('show');
                    coverageResults.classList.remove('show');
                    runCoverageBtn.disabled = true;
                }

                function hideLoading() {
                    loading.classList.remove('show');
                    coverageResults.classList.add('show');
                    runCoverageBtn.disabled = false;
                }

                function clearResults() {
                    modulesContainer.innerHTML = '';
                    summary.style.display = 'none';
                    noCoverage.style.display = 'block';
                    clearCoverageBtn.disabled = true;
                    coverageResults.classList.add('show');
                }

                function displayCoverageResults(modules) {
                    if (!modules || modules.length === 0) {
                        noCoverage.style.display = 'block';
                        summary.style.display = 'none';
                        return;
                    }

                    noCoverage.style.display = 'none';
                    clearCoverageBtn.disabled = false;

                    // Calculate summary stats
                    const totalModules = modules.length;
                    const totalFiles = modules.reduce((sum, module) => sum + module.files.length, 0);
                    const overallCoverage = modules.reduce((sum, module) => sum + module.totalCoverage, 0) / totalModules;

                    // Update summary
                    document.getElementById('total-modules').textContent = totalModules;
                    document.getElementById('total-files').textContent = totalFiles;
                    document.getElementById('overall-coverage').textContent = overallCoverage.toFixed(1) + '%';
                    summary.style.display = 'block';

                    // Display modules
                    modulesContainer.innerHTML = modules.map(module => createModuleCard(module)).join('');

                    // Add click handlers for expandable modules
                    document.querySelectorAll('.module-header').forEach(header => {
                        header.addEventListener('click', () => {
                            const moduleCard = header.parentElement;
                            const fileDetails = moduleCard.querySelector('.file-details');
                            const expandIcon = header.querySelector('.expand-icon');
                            
                            fileDetails.classList.toggle('expanded');
                            expandIcon.classList.toggle('expanded');
                        });
                    });
                }

                function createModuleCard(module) {
                    return \`
                        <div class="module-card">
                            <div class="module-header">
                                <div class="module-name">
                                    <span class="expand-icon">▶</span>
                                    📦 \${module.moduleName}
                                </div>
                                <div class="coverage-badge \${getCoverageClass(module.totalCoverage)}">
                                    \${module.totalCoverage.toFixed(1)}%
                                </div>
                            </div>
                            <div class="file-details">
                                \${module.files.map(file => createFileItem(file)).join('')}
                            </div>
                        </div>
                    \`;
                }

                function createFileItem(file) {
                    return \`
                        <div class="file-item">
                            <div class="file-name">📄 \${file.fileName}</div>
                            <div class="file-stats">
                                <span class="coverage-badge \${getCoverageClass(file.coveragePercentage)}">
                                    \${file.coveragePercentage.toFixed(1)}%
                                </span>
                                <span>(\${file.coveredLines}/\${file.totalLines} lines)</span>
                            </div>
                        </div>
                        \${file.uncoveredLines.length > 0 ? \`
                            <div class="uncovered-lines">
                                ❌ Uncovered lines: \${file.uncoveredLines.join(', ')}
                            </div>
                        \` : ''}
                    \`;
                }

                function getCoverageClass(percentage) {
                    if (percentage >= 80) return 'coverage-high';
                    if (percentage >= 60) return 'coverage-medium';
                    return 'coverage-low';
                }

                function showError(error) {
                    modulesContainer.innerHTML = \`
                        <div style="background-color: var(--vscode-inputValidation-errorBackground); 
                                    border: 1px solid var(--vscode-inputValidation-errorBorder); 
                                    color: var(--vscode-inputValidation-errorForeground); 
                                    padding: 15px; border-radius: 4px;">
                            <strong>❌ Error:</strong> \${error}
                        </div>
                    \`;
                    noCoverage.style.display = 'none';
                    summary.style.display = 'none';
                }

                // Initialize
                clearResults();
            </script>
        </body>
        </html>
        `;
    }

    private setupCoverageWebviewMessageHandler(panel: vscode.WebviewPanel): void {
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'runCoverage':
                        try {
                            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                            const coverageData = await this.jacocoService.runCoverageAnalysis(workspaceFolder);
                            
                            panel.webview.postMessage({
                                command: 'coverageResults',
                                data: coverageData
                            });
                            
                            // Also show the detailed coverage summary
                            if (coverageData.length > 0) {
                                await this.jacocoService.showCoverageSummary(coverageData, this.context);
                            }
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'coverageError',
                                error: error instanceof Error ? error.message : 'Unknown error occurred'
                            });
                        }
                        break;

                    case 'selectModule':
                        try {
                            const modules = await this.jacocoService.findProjectModules();
                            if (modules.length === 0) {
                                vscode.window.showInformationMessage('No Maven or Gradle modules found in the workspace.');
                                return;
                            }

                            // Show module selection QuickPick
                            const moduleItems = modules.map(module => ({
                                label: `📦 ${module.name}`,
                                description: `${module.type.toUpperCase()} - ${module.path}`,
                                detail: module.hasJacocoPlugin ? '✅ JaCoCo configured' : '⚠️ JaCoCo not detected',
                                module: module
                            }));

                            const selectedItem = await vscode.window.showQuickPick(moduleItems, {
                                placeHolder: 'Select a module to run coverage analysis',
                                ignoreFocusOut: true
                            });

                            if (selectedItem) {
                                const coverageData = await this.jacocoService.runCoverageAnalysisForModule(selectedItem.module);
                                
                                panel.webview.postMessage({
                                    command: 'coverageResults',
                                    data: coverageData
                                });
                                
                                if (coverageData.length > 0) {
                                    await this.jacocoService.showCoverageSummary(coverageData, this.context);
                                }
                            }
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'coverageError',
                                error: error instanceof Error ? error.message : 'Unknown error occurred'
                            });
                        }
                        break;
                        
                    case 'clearCoverage':
                        this.jacocoService.clearDecorations();
                        panel.webview.postMessage({
                            command: 'coverageCleared'
                        });
                        break;
                        
                    case 'refreshCoverage':
                        try {
                            const reports = await this.jacocoService.findJacocoReports();
                            if (reports.length > 0) {
                                const allModulesCoverage: ModuleCoverage[] = [];
                                for (const reportPath of reports) {
                                    const modulesCoverage = await this.jacocoService.parseCoverageReport(reportPath);
                                    allModulesCoverage.push(...modulesCoverage);
                                }
                                
                                panel.webview.postMessage({
                                    command: 'coverageResults',
                                    data: allModulesCoverage
                                });
                                
                                await this.jacocoService.applyCoverageDecorations(allModulesCoverage);
                            } else {
                                panel.webview.postMessage({
                                    command: 'coverageError',
                                    error: 'No existing JaCoCo reports found. Please run coverage analysis first.'
                                });
                            }
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'coverageError',
                                error: error instanceof Error ? error.message : 'Unknown error occurred'
                            });
                        }
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    dispose(): void {
        this.jacocoService.dispose();
    }
}
