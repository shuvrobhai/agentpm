import type { ConversionContext, TransformStepResult } from './context.js';

export interface ConversionStep {
  name: string;
  transform(context: ConversionContext): Promise<TransformStepResult>;
}
