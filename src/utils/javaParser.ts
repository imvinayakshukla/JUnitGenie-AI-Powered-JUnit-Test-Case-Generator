import { JavaClass, JavaMethod, JavaField, JavaParameter } from '../types';

export class JavaParser {
    /**
     * Extracts the class name from Java code
     */
    static extractClassName(javaCode: string): string | null {
        const classMatch = javaCode.match(/(?:public\s+)?class\s+(\w+)/);
        return classMatch ? classMatch[1] : null;
    }

    /**
     * Extracts the package name from Java code
     */
    static extractPackageName(javaCode: string): string | null {
        const packageMatch = javaCode.match(/package\s+([\w.]+);/);
        return packageMatch ? packageMatch[1] : null;
    }

    /**
     * Checks if the code contains test-related imports or annotations
     */
    static isTestFile(javaCode: string): boolean {
        const testPatterns = [
            /import\s+org\.junit/,
            /@Test\b/,
            /@Before\b/,
            /@After\b/,
            /@BeforeEach\b/,
            /@AfterEach\b/,
            /extends\s+TestCase/
        ];

        return testPatterns.some(pattern => pattern.test(javaCode));
    }

    /**
     * Extracts public methods from Java code
     */
    static extractPublicMethods(javaCode: string): JavaMethod[] {
        const methods: JavaMethod[] = [];
        
        // Regex to match method declarations
        const methodRegex = /(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]*>)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g;
        
        let match;
        while ((match = methodRegex.exec(javaCode)) !== null) {
            const [fullMatch, returnType, methodName, parametersStr] = match;
            
            // Skip constructors
            if (methodName === this.extractClassName(javaCode)) {
                continue;
            }

            // Parse visibility
            const visibility = this.parseVisibility(fullMatch);
            
            // Parse static modifier
            const isStatic = /\bstatic\b/.test(fullMatch);
            
            // Parse parameters
            const parameters = this.parseParameters(parametersStr);

            methods.push({
                name: methodName,
                returnType: returnType.trim(),
                parameters,
                visibility,
                isStatic
            });
        }

        return methods;
    }

    /**
     * Determines the default test file path for a given Java file
     */
    static getTestFilePath(originalPath: string, className: string): string {
        // Convert src/main/java to src/test/java
        let testPath = originalPath.replace(/src[\/\\]main[\/\\]java/, 'src/test/java');
        
        // If no src/main/java pattern found, add to test directory
        if (testPath === originalPath) {
            testPath = originalPath.replace(/\.java$/, 'Test.java');
        } else {
            testPath = testPath.replace(/\.java$/, 'Test.java');
        }

        return testPath;
    }

    private static parseVisibility(methodDeclaration: string): 'public' | 'private' | 'protected' {
        if (methodDeclaration.includes('private')) return 'private';
        if (methodDeclaration.includes('protected')) return 'protected';
        return 'public'; // Default to public if not specified
    }

    private static parseParameters(parametersStr: string): JavaParameter[] {
        if (!parametersStr.trim()) {
            return [];
        }

        const parameters: JavaParameter[] = [];
        const paramParts = parametersStr.split(',');

        for (const param of paramParts) {
            const trimmed = param.trim();
            if (trimmed) {
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2) {
                    const type = parts.slice(0, -1).join(' ');
                    const name = parts[parts.length - 1];
                    parameters.push({ type, name });
                }
            }
        }

        return parameters;
    }

    /**
     * Validates if the provided code is valid Java syntax (basic check)
     */
    static isValidJavaCode(code: string): boolean {
        // Basic validation - check for balanced braces
        const openBraces = (code.match(/\{/g) || []).length;
        const closeBraces = (code.match(/\}/g) || []).length;
        
        // Check for class declaration
        const hasClassDeclaration = /(?:public\s+)?class\s+\w+/.test(code);
        
        return openBraces === closeBraces && hasClassDeclaration;
    }

    /**
     * Extracts imports from Java code
     */
    static extractImports(javaCode: string): string[] {
        const imports: string[] = [];
        const importRegex = /import\s+([\w.*]+);/g;
        
        let match;
        while ((match = importRegex.exec(javaCode)) !== null) {
            imports.push(match[1]);
        }
        
        return imports;
    }
}
