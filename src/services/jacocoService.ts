import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

export interface CoverageData {
    fileName: string;
    moduleName: string;
    uncoveredLines: number[];
    totalLines: number;
    coveredLines: number;
    coveragePercentage: number;
}

export interface ModuleCoverage {
    moduleName: string;
    files: CoverageData[];
    totalCoverage: number;
    modulePath?: string;
}

export interface ProjectModule {
    name: string;
    path: string;
    type: 'maven' | 'gradle';
    hasJacocoPlugin: boolean;
}

export class JacocoService {
    private coverageDecorations: Map<string, vscode.TextEditorDecorationType> = new Map();
    private uncoveredLineDecorationType: vscode.TextEditorDecorationType;

    constructor() {
        // Create decoration type for uncovered lines
        this.uncoveredLineDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid rgba(255, 0, 0, 0.5)',
            isWholeLine: true,
            overviewRulerColor: 'red',
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });
    }

    /**
     * Find all modules in the workspace
     */
    async findProjectModules(): Promise<ProjectModule[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const modules: ProjectModule[] = [];
        
        for (const folder of workspaceFolders) {
            await this.searchForModulesRecursively(folder.uri.fsPath, modules);
        }

        return modules;
    }

    private async searchForModulesRecursively(directory: string, modules: ProjectModule[], depth: number = 0): Promise<void> {
        // Limit recursion depth to avoid performance issues
        if (depth > 4) {
            return;
        }

        try {
            const items = fs.readdirSync(directory, { withFileTypes: true });
            
            // Check if current directory is a Maven or Gradle module
            const pomPath = path.join(directory, 'pom.xml');
            const gradlePath = path.join(directory, 'build.gradle');
            const gradleKtsPath = path.join(directory, 'build.gradle.kts');
            
            if (fs.existsSync(pomPath)) {
                const hasJacoco = await this.checkMavenJacocoPlugin(pomPath);
                modules.push({
                    name: path.basename(directory),
                    path: directory,
                    type: 'maven',
                    hasJacocoPlugin: hasJacoco
                });
            } else if (fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath)) {
                const buildFile = fs.existsSync(gradlePath) ? gradlePath : gradleKtsPath;
                const hasJacoco = await this.checkGradleJacocoPlugin(buildFile);
                modules.push({
                    name: path.basename(directory),
                    path: directory,
                    type: 'gradle',
                    hasJacocoPlugin: hasJacoco
                });
            }
            
            // Continue searching in subdirectories
            for (const item of items) {
                if (item.isDirectory() && !item.name.startsWith('.') && 
                    item.name !== 'node_modules' && item.name !== 'target' && item.name !== 'build') {
                    const subDir = path.join(directory, item.name);
                    await this.searchForModulesRecursively(subDir, modules, depth + 1);
                }
            }
        } catch (error) {
            // Ignore errors (permission issues, etc.)
        }
    }

    private async checkMavenJacocoPlugin(pomPath: string): Promise<boolean> {
        try {
            const pomContent = fs.readFileSync(pomPath, 'utf8');
            return pomContent.includes('jacoco-maven-plugin') || pomContent.includes('org.jacoco');
        } catch (error) {
            return false;
        }
    }

    private async checkGradleJacocoPlugin(buildFilePath: string): Promise<boolean> {
        try {
            const buildContent = fs.readFileSync(buildFilePath, 'utf8');
            return buildContent.includes('jacoco') || buildContent.includes('id "jacoco"') || buildContent.includes("id 'jacoco'");
        } catch (error) {
            return false;
        }
    }

    /**
     * Auto-configure JaCoCo for a module if not already configured
     */
    async autoConfigureJacoco(module: ProjectModule): Promise<boolean> {
        if (module.hasJacocoPlugin) {
            return true; // Already configured
        }

        const action = await vscode.window.showInformationMessage(
            `JaCoCo is not configured for ${module.name}. Would you like to auto-configure it?`,
            'Auto-Configure', 'Manual Setup', 'Skip'
        );

        if (action === 'Auto-Configure') {
            try {
                if (module.type === 'maven') {
                    await this.addJacocoToMaven(module);
                } else {
                    await this.addJacocoToGradle(module);
                }
                
                vscode.window.showInformationMessage(`JaCoCo has been configured for ${module.name}. Please rebuild your project.`);
                return true;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to configure JaCoCo: ${error}`);
                return false;
            }
        } else if (action === 'Manual Setup') {
            const setupGuide = module.type === 'maven' ? this.getMavenSetupInstructions() : this.getGradleSetupInstructions();
            const doc = await vscode.workspace.openTextDocument({
                content: setupGuide,
                language: module.type === 'maven' ? 'xml' : 'gradle'
            });
            vscode.window.showTextDocument(doc);
            return false;
        }

        return false;
    }

    private async addJacocoToMaven(module: ProjectModule): Promise<void> {
        const pomPath = path.join(module.path, 'pom.xml');
        let pomContent = fs.readFileSync(pomPath, 'utf8');

        const jacocoPlugin = `
            <plugin>
                <groupId>org.jacoco</groupId>
                <artifactId>jacoco-maven-plugin</artifactId>
                <version>0.8.11</version>
                <executions>
                    <execution>
                        <goals>
                            <goal>prepare-agent</goal>
                        </goals>
                    </execution>
                    <execution>
                        <id>report</id>
                        <phase>test</phase>
                        <goals>
                            <goal>report</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>`;

        if (pomContent.includes('<plugins>')) {
            pomContent = pomContent.replace('</plugins>', `${jacocoPlugin}\n        </plugins>`);
        } else if (pomContent.includes('<build>')) {
            pomContent = pomContent.replace('<build>', `<build>\n        <plugins>${jacocoPlugin}\n        </plugins>`);
        } else {
            // Add build section before </project>
            const buildSection = `\n    <build>\n        <plugins>${jacocoPlugin}\n        </plugins>\n    </build>`;
            pomContent = pomContent.replace('</project>', `${buildSection}\n</project>`);
        }

        fs.writeFileSync(pomPath, pomContent, 'utf8');
    }

    private async addJacocoToGradle(module: ProjectModule): Promise<void> {
        const buildPath = path.join(module.path, 'build.gradle');
        const buildKtsPath = path.join(module.path, 'build.gradle.kts');
        const buildFile = fs.existsSync(buildPath) ? buildPath : buildKtsPath;
        
        let buildContent = fs.readFileSync(buildFile, 'utf8');

        const jacocoConfig = buildFile.endsWith('.kts') ? `
plugins {
    jacoco
}

jacoco {
    toolVersion = "0.8.11"
}

tasks.jacocoTestReport {
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}

tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}` : `
plugins {
    id 'jacoco'
}

jacoco {
    toolVersion = '0.8.11'
}

jacocoTestReport {
    reports {
        xml.required = true
        html.required = true
    }
}

test {
    useJUnitPlatform()
    finalizedBy jacocoTestReport
}`;

        if (buildContent.includes('plugins {')) {
            // Add jacoco to existing plugins block
            if (buildFile.endsWith('.kts')) {
                buildContent = buildContent.replace('plugins {', 'plugins {\n    jacoco');
            } else {
                buildContent = buildContent.replace('plugins {', "plugins {\n    id 'jacoco'");
            }
            
            // Add jacoco configuration at the end
            buildContent += '\n' + jacocoConfig.split('\n').slice(4).join('\n');
        } else {
            // Add full jacoco configuration at the beginning
            buildContent = jacocoConfig + '\n\n' + buildContent;
        }

        fs.writeFileSync(buildFile, buildContent, 'utf8');
    }

    private getMavenSetupInstructions(): string {
        return `<!-- Add this JaCoCo plugin configuration to your pom.xml -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>

<!-- Then run: mvn clean test jacoco:report -->`;
    }

    private getGradleSetupInstructions(): string {
        return `// Add this JaCoCo configuration to your build.gradle
plugins {
    id 'jacoco'
}

jacoco {
    toolVersion = '0.8.11'
}

jacocoTestReport {
    reports {
        xml.required = true
        html.required = true
    }
}

test {
    useJUnitPlatform()
    finalizedBy jacocoTestReport
}

// Then run: ./gradlew clean test jacocoTestReport`;
    }
    async findJacocoReports(): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const reportPaths: string[] = [];
        
        for (const folder of workspaceFolders) {
            const possiblePaths = [
                'target/site/jacoco/jacoco.xml',
                'build/reports/jacoco/test/jacocoTestReport.xml',
                'build/reports/jacoco/jacoco.xml',
                'target/jacoco.xml',
                'jacoco.xml'
            ];

            for (const possiblePath of possiblePaths) {
                const fullPath = path.join(folder.uri.fsPath, possiblePath);
                if (fs.existsSync(fullPath)) {
                    reportPaths.push(fullPath);
                }
            }

            // Also search for reports in subdirectories (for multi-module projects)
            await this.searchForJacocoReportsRecursively(folder.uri.fsPath, reportPaths);
        }

        return reportPaths;
    }

    private async searchForJacocoReportsRecursively(directory: string, reportPaths: string[], depth: number = 0): Promise<void> {
        // Limit recursion depth to avoid performance issues
        if (depth > 3) {
            return;
        }

        try {
            const items = fs.readdirSync(directory, { withFileTypes: true });
            
            for (const item of items) {
                if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
                    const subDir = path.join(directory, item.name);
                    
                    // Check for jacoco reports in common locations within this subdirectory
                    const possiblePaths = [
                        path.join(subDir, 'target', 'site', 'jacoco', 'jacoco.xml'),
                        path.join(subDir, 'build', 'reports', 'jacoco', 'test', 'jacocoTestReport.xml'),
                        path.join(subDir, 'build', 'reports', 'jacoco', 'jacoco.xml'),
                        path.join(subDir, 'target', 'jacoco.xml')
                    ];

                    for (const possiblePath of possiblePaths) {
                        if (fs.existsSync(possiblePath)) {
                            reportPaths.push(possiblePath);
                        }
                    }

                    // Continue recursively
                    await this.searchForJacocoReportsRecursively(subDir, reportPaths, depth + 1);
                }
            }
        } catch (error) {
            // Ignore errors (permission issues, etc.)
        }
    }

    /**
     * Parse JaCoCo XML report and extract coverage data
     */
    async parseCoverageReport(reportPath: string): Promise<ModuleCoverage[]> {
        try {
            const xmlContent = fs.readFileSync(reportPath, 'utf8');
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_"
            });
            
            const result = parser.parse(xmlContent);
            const report = result.report;
            
            const modulesCoverage: ModuleCoverage[] = [];
            
            if (!report || !report.package) {
                return modulesCoverage;
            }

            // Handle both single package and multiple packages
            const packages = Array.isArray(report.package) ? report.package : [report.package];
            
            for (const pkg of packages) {
                const moduleName = pkg["@_name"] || "default";
                const files: CoverageData[] = [];
                
                if (pkg.sourcefile) {
                    const sourceFiles = Array.isArray(pkg.sourcefile) ? pkg.sourcefile : [pkg.sourcefile];
                    
                    for (const sourceFile of sourceFiles) {
                        const fileName = sourceFile["@_name"];
                        const lines = sourceFile.line || [];
                        const linesArray = Array.isArray(lines) ? lines : [lines];
                        
                        const uncoveredLines: number[] = [];
                        let totalLines = 0;
                        let coveredLines = 0;
                        
                        for (const line of linesArray) {
                            const lineNumber = parseInt(line["@_nr"]);
                            const coveredInstructions = parseInt(line["@_ci"] || "0");
                            const missedInstructions = parseInt(line["@_mi"] || "0");
                            
                            totalLines++;
                            
                            if (coveredInstructions > 0) {
                                coveredLines++;
                            } else if (missedInstructions > 0) {
                                uncoveredLines.push(lineNumber);
                            }
                        }
                        
                        const coveragePercentage = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
                        
                        files.push({
                            fileName,
                            moduleName,
                            uncoveredLines,
                            totalLines,
                            coveredLines,
                            coveragePercentage
                        });
                    }
                }
                
                const totalCoverage = files.length > 0 
                    ? files.reduce((sum, file) => sum + file.coveragePercentage, 0) / files.length 
                    : 0;
                
                modulesCoverage.push({
                    moduleName,
                    files,
                    totalCoverage
                });
            }
            
            return modulesCoverage;
        } catch (error) {
            console.error('Error parsing JaCoCo report:', error);
            throw new Error(`Failed to parse JaCoCo report: ${error}`);
        }
    }

    /**
     * Run JaCoCo coverage analysis for a specific module
     */
    async runCoverageAnalysisForModule(module: ProjectModule): Promise<ModuleCoverage[]> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Running JaCoCo Coverage for ${module.name}`,
            cancellable: true
        }, async (progress, token) => {
            
            // Step 1: Check if JaCoCo is configured or auto-configure
            if (!module.hasJacocoPlugin) {
                const configured = await this.autoConfigureJacoco(module);
                if (!configured) {
                    return [];
                }
            }

            // Step 2: Run tests with JaCoCo
            progress.report({ increment: 20, message: `Running tests for ${module.name}...` });
            
            const terminal = vscode.window.createTerminal({
                name: `JaCoCo Coverage - ${module.name}`,
                cwd: module.path
            });
            
            if (token.isCancellationRequested) {
                return [];
            }
            
            let command: string;
            if (module.type === 'maven') {
                command = module.hasJacocoPlugin ? 
                    "mvn clean test jacoco:report" : 
                    "mvn clean test org.jacoco:jacoco-maven-plugin:prepare-agent org.jacoco:jacoco-maven-plugin:report";
            } else {
                command = module.hasJacocoPlugin ?
                    "./gradlew clean test jacocoTestReport" :
                    "./gradlew clean test --init-script jacoco-init.gradle";
            }
            
            terminal.sendText(command);
            terminal.show();
            
            // Wait for the command to complete
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            if (token.isCancellationRequested) {
                return [];
            }
            
            // Step 3: Find and parse JaCoCo reports in this module
            progress.report({ increment: 40, message: `Searching for JaCoCo reports in ${module.name}...` });
            
            const reportPaths = await this.findJacocoReportsInModule(module);
            if (reportPaths.length === 0) {
                throw new Error(`No JaCoCo reports found in ${module.name}. Make sure tests have been run successfully.`);
            }
            
            progress.report({ increment: 20, message: "Parsing coverage reports..." });
            
            const modulesCoverage: ModuleCoverage[] = [];
            
            for (const reportPath of reportPaths) {
                if (token.isCancellationRequested) {
                    break;
                }
                
                try {
                    const coverage = await this.parseCoverageReport(reportPath);
                    // Add module path information
                    coverage.forEach(c => c.modulePath = module.path);
                    modulesCoverage.push(...coverage);
                } catch (error) {
                    console.error(`Error parsing report ${reportPath}:`, error);
                }
            }
            
            progress.report({ increment: 20, message: "Applying coverage decorations..." });
            
            // Apply decorations to open editors
            await this.applyCoverageDecorations(modulesCoverage);
            
            return modulesCoverage;
        });
    }

    private async findJacocoReportsInModule(module: ProjectModule): Promise<string[]> {
        const reportPaths: string[] = [];
        
        const possiblePaths = module.type === 'maven' ? [
            'target/site/jacoco/jacoco.xml',
            'target/jacoco.xml'
        ] : [
            'build/reports/jacoco/test/jacocoTestReport.xml',
            'build/reports/jacoco/jacoco.xml'
        ];

        for (const possiblePath of possiblePaths) {
            const fullPath = path.join(module.path, possiblePath);
            if (fs.existsSync(fullPath)) {
                reportPaths.push(fullPath);
            }
        }

        return reportPaths;
    }
    async runCoverageAnalysis(workspaceFolder?: string): Promise<ModuleCoverage[]> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Running JaCoCo Coverage Analysis",
            cancellable: true
        }, async (progress, token) => {
            
            // Step 1: Run tests with JaCoCo
            progress.report({ increment: 20, message: "Running tests with JaCoCo..." });
            
            const terminal = vscode.window.createTerminal({
                name: "JaCoCo Coverage",
                cwd: workspaceFolder
            });
            
            // Try different build commands based on the project type
            const mavenCommand = "mvn clean test jacoco:report";
            const gradleCommand = "./gradlew clean test jacocoTestReport";
            
            // Check if it's a Maven or Gradle project
            const workspaceRoot = workspaceFolder || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error("No workspace folder found");
            }
            
            const isMaven = fs.existsSync(path.join(workspaceRoot, 'pom.xml'));
            const isGradle = fs.existsSync(path.join(workspaceRoot, 'build.gradle')) || 
                            fs.existsSync(path.join(workspaceRoot, 'build.gradle.kts'));
            
            if (token.isCancellationRequested) {
                return [];
            }
            
            if (isMaven) {
                terminal.sendText(mavenCommand);
            } else if (isGradle) {
                terminal.sendText(gradleCommand);
            } else {
                throw new Error("No supported build system (Maven/Gradle) found");
            }
            
            terminal.show();
            
            // Wait for the command to complete (simplified - in real implementation, you'd monitor the terminal)
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            if (token.isCancellationRequested) {
                return [];
            }
            
            // Step 2: Find and parse JaCoCo reports
            progress.report({ increment: 40, message: "Searching for JaCoCo reports..." });
            
            const reportPaths = await this.findJacocoReports();
            if (reportPaths.length === 0) {
                throw new Error("No JaCoCo reports found. Make sure tests have been run with JaCoCo enabled.");
            }
            
            progress.report({ increment: 20, message: "Parsing coverage reports..." });
            
            const allModulesCoverage: ModuleCoverage[] = [];
            
            for (const reportPath of reportPaths) {
                if (token.isCancellationRequested) {
                    break;
                }
                
                try {
                    const modulesCoverage = await this.parseCoverageReport(reportPath);
                    allModulesCoverage.push(...modulesCoverage);
                } catch (error) {
                    console.error(`Error parsing report ${reportPath}:`, error);
                }
            }
            
            progress.report({ increment: 20, message: "Applying coverage decorations..." });
            
            // Apply decorations to open editors
            await this.applyCoverageDecorations(allModulesCoverage);
            
            return allModulesCoverage;
        });
    }

    /**
     * Apply coverage decorations to open editors
     */
    async applyCoverageDecorations(modulesCoverage: ModuleCoverage[]): Promise<void> {
        // Clear existing decorations
        this.clearDecorations();
        
        for (const module of modulesCoverage) {
            for (const file of module.files) {
                // Find corresponding open editor
                const openEditors = vscode.window.visibleTextEditors;
                
                for (const editor of openEditors) {
                    const editorFileName = path.basename(editor.document.fileName);
                    
                    if (editorFileName === file.fileName && editor.document.languageId === 'java') {
                        // Apply uncovered line decorations
                        const decorationRanges = file.uncoveredLines.map(lineNumber => {
                            const line = Math.max(0, lineNumber - 1); // Convert to 0-based
                            return new vscode.Range(line, 0, line, 0);
                        });
                        
                        editor.setDecorations(this.uncoveredLineDecorationType, decorationRanges);
                        
                        // Store decoration for this file
                        this.coverageDecorations.set(editor.document.fileName, this.uncoveredLineDecorationType);
                    }
                }
            }
        }
    }

    /**
     * Clear all coverage decorations
     */
    clearDecorations(): void {
        for (const [fileName, decoration] of this.coverageDecorations) {
            // Find editor for this file and clear decorations
            const editor = vscode.window.visibleTextEditors.find(
                e => e.document.fileName === fileName
            );
            if (editor) {
                editor.setDecorations(decoration, []);
            }
        }
        this.coverageDecorations.clear();
    }

    /**
     * Show coverage summary in a webview
     */
    async showCoverageSummary(modulesCoverage: ModuleCoverage[], context: vscode.ExtensionContext): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'jacocoCoverage',
            'JaCoCo Coverage Report',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'resources'))
                ]
            }
        );

        panel.webview.html = this.getCoverageWebviewContent(modulesCoverage, panel.webview, context);
    }

    private getCoverageWebviewContent(modulesCoverage: ModuleCoverage[], webview: vscode.Webview, context: vscode.ExtensionContext): string {
        const resourceUri = webview.asWebviewUri(
            vscode.Uri.file(path.join(context.extensionPath, 'resources'))
        );

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>JaCoCo Coverage Report</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    margin: 0;
                    padding: 20px;
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                .module {
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
                }
                .module-name {
                    font-weight: bold;
                    font-size: 1.1em;
                }
                .coverage-percentage {
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-weight: bold;
                }
                .coverage-high { background-color: #28a745; color: white; }
                .coverage-medium { background-color: #ffc107; color: black; }
                .coverage-low { background-color: #dc3545; color: white; }
                .file-list {
                    margin-top: 10px;
                }
                .file-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    border-bottom: 1px solid var(--vscode-widget-border);
                }
                .file-name {
                    flex: 1;
                }
                .file-coverage {
                    margin-left: 10px;
                    font-family: monospace;
                }
                .uncovered-lines {
                    color: var(--vscode-errorForeground);
                    font-size: 0.9em;
                }
                .summary {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-left: 4px solid var(--vscode-textBlockQuote-border);
                    padding: 15px;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📊 JaCoCo Coverage Report</h1>
                <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="summary">
                <h2>Summary</h2>
                <p><strong>Total Modules:</strong> ${modulesCoverage.length}</p>
                <p><strong>Overall Coverage:</strong> ${this.calculateOverallCoverage(modulesCoverage).toFixed(2)}%</p>
            </div>

            ${modulesCoverage.map(module => `
                <div class="module">
                    <div class="module-header">
                        <div class="module-name">📦 ${module.moduleName}</div>
                        <div class="coverage-percentage ${this.getCoverageClass(module.totalCoverage)}">
                            ${module.totalCoverage.toFixed(2)}%
                        </div>
                    </div>
                    
                    <div class="file-list">
                        ${module.files.map(file => `
                            <div class="file-item">
                                <div class="file-name">📄 ${file.fileName}</div>
                                <div class="file-coverage">
                                    <span class="${this.getCoverageClass(file.coveragePercentage)}">
                                        ${file.coveragePercentage.toFixed(2)}%
                                    </span>
                                    (${file.coveredLines}/${file.totalLines} lines)
                                </div>
                            </div>
                            ${file.uncoveredLines.length > 0 ? `
                                <div class="uncovered-lines">
                                    ❌ Uncovered lines: ${file.uncoveredLines.join(', ')}
                                </div>
                            ` : ''}
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </body>
        </html>
        `;
    }

    private calculateOverallCoverage(modulesCoverage: ModuleCoverage[]): number {
        if (modulesCoverage.length === 0) return 0;
        
        const total = modulesCoverage.reduce((sum, module) => sum + module.totalCoverage, 0);
        return total / modulesCoverage.length;
    }

    private getCoverageClass(percentage: number): string {
        if (percentage >= 80) return 'coverage-high';
        if (percentage >= 60) return 'coverage-medium';
        return 'coverage-low';
    }

    dispose(): void {
        this.clearDecorations();
        this.uncoveredLineDecorationType.dispose();
    }
}
