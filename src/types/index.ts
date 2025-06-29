export interface TestGenerationConfig {
  apiKey: string;
  model: string;
  framework: 'junit4' | 'junit5';
  maxTokens?: number;
  temperature?: number;
}

export interface WebviewMessage {
  command: string;
  code?: string;
  tests?: string;
  className?: string;
  message?: string;
}

export interface JavaClass {
  className: string;
  packageName?: string;
  methods: JavaMethod[];
  fields: JavaField[];
}

export interface JavaMethod {
  name: string;
  returnType: string;
  parameters: JavaParameter[];
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
}

export interface JavaParameter {
  name: string;
  type: string;
}

export interface JavaField {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isFinal: boolean;
}
