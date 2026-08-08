import { ConversionOptions, ConversionResult } from '../converter.js';

export interface ConversionContext {
  srcPath: string;
  destPath: string;
  sourceRoot: string;
  targetRoot: string;
  ext: string;
  basename: string;
  content: string;
  options: Required<ConversionOptions>;
  result: ConversionResult;
}

export interface TransformStepResult {
  content: string;
  modified: boolean;
}
